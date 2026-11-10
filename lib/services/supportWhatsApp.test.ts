import { isSupportContactExcluded } from "@/lib/services/supportExclusions";
import { query } from "@/lib/database/sql";
import { resolveWahaChatPhone, sendWahaText } from "@/lib/services/wahaClient";
import { isSecondaryBlastRecipient, sendTrackedSupportText } from "./supportWhatsApp";

jest.mock("@/lib/services/supportExclusions", () => ({ isSupportContactExcluded: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({
    query: jest.fn(),
    withAdvisoryLock: jest.fn(async (_key: string, run: () => Promise<unknown>) => run()),
}));
jest.mock("@/lib/services/supportAgent", () => ({
    analyzeSupportImage: jest.fn(),
    generateSupportReply: jest.fn(),
    classifySupportFollowup: jest.fn(),
    transcribeSupportAudio: jest.fn(),
}));
jest.mock("@/lib/services/wahaClient", () => ({
    resolveWahaChatPhone: jest.fn(),
    sendWahaText: jest.fn(),
    SUPPORT_WAHA_SESSION_NAME: "imenu-support",
}));

beforeEach(() => {
    jest.clearAllMocks();
    (isSupportContactExcluded as jest.Mock).mockResolvedValue(false);
    (resolveWahaChatPhone as jest.Mock).mockResolvedValue("5511999999999");
});

test("secondary WhatsApp accepts sent 20:00 recovery blasts and ordinary blasts", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

    await expect(isSecondaryBlastRecipient({
        sessionName: "imenu-blast",
        chatId: "5511999999999@s.whatsapp.net",
    })).resolves.toBe(true);

    const [sql, params] = (query as jest.Mock).mock.calls[0];
    expect(sql).toContain("status = 'sent'");
    expect(sql).toContain("dedupe_key LIKE 'support:bulk:blast:%'");
    expect(sql).toContain("dedupe_key LIKE 'support:bulk:abandoned:%'");
    expect(sql).not.toContain("dedupe_key LIKE 'support:bulk:%'");
    expect(sql).toContain("dedupe_key LIKE 'support:payout:%'");
    expect(sql).toContain("support_blast_recipients");
    expect(sql).toContain("c.sender = 'blast'");
    expect(sql).toContain("support_conversations");
    expect(params).toHaveLength(3);
    expect(params[0]).toContain("5511999999999@c.us");
    expect(params[1]).toContain("5511999999999");
    expect(params[2]).toBe("imenu-blast:5511999999999@s.whatsapp.net");
});

test("secondary WhatsApp rejects a contact without any qualifying sent blast", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });

    await expect(isSecondaryBlastRecipient({
        sessionName: "imenu-blast",
        chatId: "5511999999999@c.us",
    })).resolves.toBe(false);
});

test("secondary WhatsApp recognizes a recipient from a resolved LID", async () => {
    (resolveWahaChatPhone as jest.Mock).mockResolvedValue("5511999999999");
    (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

    await expect(isSecondaryBlastRecipient({
        sessionName: "imenu-blast",
        chatId: "123456789@lid",
    })).resolves.toBe(true);

    const [, params] = (query as jest.Mock).mock.calls[0];
    expect(params[0]).toContain("5511999999999@c.us");
});

test("keeps an established LID conversation eligible after the outbound history cleanup", async () => {
    (resolveWahaChatPhone as jest.Mock).mockResolvedValue("5581992345056");
    (query as jest.Mock).mockResolvedValue({ rows: [{ id: 1 }], rowCount: 1 });

    await expect(isSecondaryBlastRecipient({
        sessionName: "imenu-blast",
        chatId: "209862940172373@lid",
    })).resolves.toBe(true);

    const [, params] = (query as jest.Mock).mock.calls[0];
    expect(params[1]).toContain("5581992345056");
    expect(params[2]).toBe("imenu-blast:209862940172373@lid");
});


describe("approved draft delivery",()=>{
 const input={conversationId:"conversation",sessionName:"imenu-support",chatId:"5511999999999@c.us",text:"Resposta revisada",dedupeKey:"support:draft:id",replaceUnsentText:true};
 function mockDelivery(status:string|null){
  (query as jest.Mock).mockImplementation(async(sql:string)=>{
   if(sql.startsWith("SELECT phone, blacklisted"))return {rows:[{phone:"5511999999999",blacklisted:false}],rowCount:1};
   if(sql.includes("WHERE blacklisted"))return {rows:[],rowCount:0};
   if(sql.startsWith("SELECT id, body, send_status"))return {rows:status?[{id:"message",body:"Texto anterior",send_status:status}]:[],rowCount:status?1:0};
   return {rows:[{id:"message"}],rowCount:1};
  });
  (sendWahaText as jest.Mock).mockResolvedValue(undefined);
 }
 test.each([null,"failed"])("sends and records latest saved text after status %s",async status=>{
  mockDelivery(status);
  await expect(sendTrackedSupportText(input)).resolves.toBe(true);
  expect(sendWahaText).toHaveBeenCalledWith(input.sessionName,input.chatId,input.text);
  expect(query).toHaveBeenCalledWith(expect.stringContaining("send_status = 'sent'"),["message"]);
  if(status)expect(query).toHaveBeenCalledWith(expect.stringContaining("SET body=$2"),["message",input.text]);
 });
 test("a delivered approval is not resent after retry",async()=>{
  mockDelivery("sent");
  await expect(sendTrackedSupportText(input)).resolves.toBe(true);
  expect(sendWahaText).not.toHaveBeenCalled();
 });
 test("provider failure is tracked and propagated to the review action",async()=>{
  mockDelivery(null);
  (sendWahaText as jest.Mock).mockRejectedValue(new Error("offline"));
  await expect(sendTrackedSupportText(input)).rejects.toThrow("offline");
  expect(query).toHaveBeenCalledWith(expect.stringContaining("send_status = 'failed'"),["message","offline"]);
 });
});

test("excluded blast contact still accepts incoming messages for history", async () => {
    (isSupportContactExcluded as jest.Mock).mockResolvedValue(true);
    await expect(isSecondaryBlastRecipient({
        sessionName: "imenu-blast", chatId: "99389989204047@lid",
    })).resolves.toBe(true);
    expect(query).not.toHaveBeenCalled();
});

test("excluded blacklisted contact saves incoming history but never sends replies", async () => {
    const { processSupportIncomingWhatsAppMessage } = await import("./supportWhatsApp");
    (isSupportContactExcluded as jest.Mock).mockResolvedValue(true);
    const row = {
        id: "conversation-test", chat_id: "imenu-blast:99389989204047@lid",
        phone: "5511988576886", customer_name: null, restaurant_id: "restaurant-test",
        mode: "human", handoff_prompted_at: null,
    };
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.startsWith("SELECT phone FROM support_conversations")) return { rows: [{ phone: row.phone }], rowCount: 1 };
        if (sql.includes("bool_or(blacklisted)")) return { rows: [{ blacklisted: true, blocked_handoff: true }], rowCount: 1 };
        if (sql.includes("SELECT id, chat_id, phone") && sql.includes("support_conversations")) return { rows: [row], rowCount: 1 };
        if (sql.startsWith("UPDATE support_conversations SET phone")) return { rows: [row], rowCount: 1 };
        return { rows: [], rowCount: 0 };
    });
    await processSupportIncomingWhatsAppMessage({
        sessionName: "imenu-blast", chatId: "99389989204047@lid",
        body: "mensagem recebida", hasMedia: false, messageId: "provider-1",
        customerName: null, botEnabled: true,
    });
    expect(query).toHaveBeenCalledWith(
        expect.stringContaining("INSERT INTO support_messages"),
        [row.id, "mensagem recebida", "imenu-blast:provider-1"],
    );
    expect(sendWahaText).not.toHaveBeenCalled();
});
