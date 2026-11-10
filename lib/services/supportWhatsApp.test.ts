import { isSupportContactExcluded } from "@/lib/services/supportExclusions";
import { classifySupportFollowup, generateSupportReply } from "@/lib/services/supportAgent";
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
    startWahaTyping: jest.fn().mockResolvedValue(undefined),
    stopWahaTyping: jest.fn().mockResolvedValue(undefined),
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

describe("short confirmation while human handoff is pending", () => {
    const conversation = {
        id: "conversation-handoff", chat_id: "5511999999999@c.us",
        phone: "5511999999999", customer_name: null, restaurant_id: null,
        mode: "ai" as const, handoff_prompted_at: "2026-11-10T20:28:09Z",
    };
    const incoming = {
        sessionName: "imenu-support",
        chatId: conversation.chat_id,
        body: "sim",
        hasMedia: false,
        messageId: "provider-second-sim",
        customerName: null,
        botEnabled: true,
    };

    test.each([
        [true, true],
        [false, false],
    ])("pending handoff=%s: second 'sim' reaches AI=%s", async (pending, reachesAi) => {
        (generateSupportReply as jest.Mock).mockResolvedValue({
            text: "Encaminhamento confirmado.",
            handoffState: "handed_off",
            model: "test-model",
            inputTokens: 5,
            outputTokens: 5,
        });
        (sendWahaText as jest.Mock).mockResolvedValue(undefined);
        (query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.startsWith("SELECT phone FROM support_conversations")) return { rows: [{ phone: conversation.phone }], rowCount: 1 };
            if (sql.includes("bool_or(blacklisted)")) return { rows: [{ blacklisted: false, blocked_handoff: false }], rowCount: 1 };
            if (sql.includes("SELECT id, chat_id, phone") && sql.includes("support_conversations"))
                return { rows: [{ ...conversation, handoff_prompted_at: pending ? conversation.handoff_prompted_at : null }], rowCount: 1 };
            if (sql.startsWith("UPDATE support_conversations SET phone"))
                return { rows: [{ ...conversation, handoff_prompted_at: pending ? conversation.handoff_prompted_at : null }], rowCount: 1 };
            if (sql.startsWith("SELECT mode, last_inbound_at::text AS last_inbound_at, handoff_prompted_at"))
                return { rows: [{ mode: "ai", last_inbound_at: "2026-11-10T20:28:39Z",
                    handoff_prompted_at: pending ? conversation.handoff_prompted_at : null }], rowCount: 1 };
            if (sql.startsWith("SELECT provider_message_id FROM support_messages"))
                return { rows: [{ provider_message_id: incoming.messageId }], rowCount: 1 };
            // Model the historical bug: a previous "sim" was already answered.
            if (sql.includes("AS already_answered"))
                return { rows: [{ already_answered: true }], rowCount: 1 };
            if (sql.startsWith("SELECT phone, blacklisted"))
                return { rows: [{ phone: conversation.phone, blacklisted: false }], rowCount: 1 };
            if (sql.startsWith("INSERT INTO support_messages") && sql.includes("'outbound'"))
                return { rows: [{ id: "outbound-message" }], rowCount: 1 };
            return { rows: [], rowCount: 0 };
        });

        const { processSupportIncomingWhatsAppMessage } = await import("./supportWhatsApp");
        await processSupportIncomingWhatsAppMessage(incoming);

        expect((generateSupportReply as jest.Mock).mock.calls.length > 0).toBe(reachesAi);
        expect((sendWahaText as jest.Mock).mock.calls.length > 0).toBe(reachesAi);
        const repeatedChecks = (query as jest.Mock).mock.calls.filter(([sql]) =>
            sql.includes("AS already_answered"));
        expect(repeatedChecks).toHaveLength(pending ? 0 : 1);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("ON CONFLICT (provider_message_id)"),
            [conversation.id, "sim", incoming.messageId],
        );
    });
});

test("preserves PostgreSQL microseconds when classifying a sent AI reply", async () => {
    const inboundAt = "2026-11-10 17:45:01.576728+00";
    const conversation = {
        id: "conversation-followup", chat_id: "5511999999999@c.us",
        phone: "5511999999999", customer_name: null, restaurant_id: null,
        mode: "ai" as const, handoff_prompted_at: null,
    };
    const messageId = "provider-followup-1";
    (generateSupportReply as jest.Mock).mockResolvedValue({
        text: "Qual parte do cardápio precisa de ajuda?", handoffState: null,
        model: "test-model", inputTokens: 5, outputTokens: 8,
    });
    (classifySupportFollowup as jest.Mock).mockResolvedValue("awaiting_customer");
    (sendWahaText as jest.Mock).mockResolvedValue({ id: "sent" });
    (query as jest.Mock).mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.startsWith("SELECT phone FROM support_conversations"))
            return { rows: [{ phone: conversation.phone }], rowCount: 1 };
        if (sql.includes("bool_or(blacklisted)"))
            return { rows: [{ blacklisted: false, blocked_handoff: false }], rowCount: 1 };
        if (sql.startsWith("SELECT id, chat_id, phone") && sql.includes("support_conversations"))
            return { rows: [conversation], rowCount: 1 };
        if (sql.startsWith("UPDATE support_conversations SET phone"))
            return { rows: [conversation], rowCount: 1 };
        if (sql.startsWith("SELECT mode, last_inbound_at")) {
            // Emulate node-postgres: timestamptz -> Date truncates microseconds;
            // ::text returns all six digits and allows the atomic equality check.
            const precise = sql.includes("last_inbound_at::text AS last_inbound_at");
            return { rows: [{
                mode: "ai",
                last_inbound_at: precise ? inboundAt : new Date(inboundAt).toISOString(),
                handoff_prompted_at: null,
            }], rowCount: 1 };
        }
        if (sql.startsWith("SELECT provider_message_id FROM support_messages"))
            return { rows: [{ provider_message_id: messageId }], rowCount: 1 };
        if (sql.startsWith("SELECT phone, blacklisted"))
            return { rows: [{ phone: conversation.phone, blacklisted: false }], rowCount: 1 };
        if (sql.startsWith("SELECT id, body, send_status"))
            return { rows: [], rowCount: 0 };
        if (sql.startsWith("INSERT INTO support_messages") && sql.includes("'outbound'"))
            return { rows: [{ id: "outbound-followup" }], rowCount: 1 };
        if (sql.includes("SET followup_state = $3")) {
            return { rows: [], rowCount: params?.[1] === inboundAt ? 1 : 0 };
        }
        return { rows: [], rowCount: 0 };
    });

    const { processSupportIncomingWhatsAppMessage } = await import("./supportWhatsApp");
    await processSupportIncomingWhatsAppMessage({
        sessionName: "imenu-support", chatId: conversation.chat_id,
        body: "Preciso de ajuda com meu cardápio", hasMedia: false,
        messageId, customerName: null, botEnabled: true,
    });

    expect(sendWahaText).toHaveBeenCalledTimes(1);
    expect(classifySupportFollowup).toHaveBeenCalledWith(conversation.id);
    const stateRead = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).startsWith("SELECT mode, last_inbound_at"));
    expect(stateRead?.[0]).toContain("last_inbound_at::text AS last_inbound_at");
    const classificationWrite = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).includes("SET followup_state = $3"));
    expect(classificationWrite?.[1]).toEqual([conversation.id, inboundAt, "awaiting_customer"]);
});
