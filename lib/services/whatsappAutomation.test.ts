import { query, withAdvisoryLock, withTransaction } from "@/lib/database/sql";
import { getWhatsAppAiReply } from "@/lib/services/whatsappAi";
import { getCrmReply } from "@/lib/services/crmAutomations";
import { sendWahaText, sendWahaList, startWahaTyping, stopWahaTyping, resolveWahaChatPhone } from "@/lib/services/wahaClient";
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATES } from "@/lib/services/whatsappMessageTemplates";
import { sendOwnerPush } from "@/lib/push/server";
import { processIncomingWhatsAppMessage } from "./whatsappAutomation";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withAdvisoryLock: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/services/whatsappAi", () => ({ getWhatsAppAiReply: jest.fn() }));
jest.mock("@/lib/services/crmAutomations", () => ({ getCrmReply: jest.fn() }));
jest.mock("@/lib/services/whatsappNotification", () => ({ handleOrderNotificationReply: jest.fn().mockResolvedValue(false) }));
jest.mock("@/lib/push/server", () => ({ sendOwnerPush: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({ sendWahaText: jest.fn(), sendWahaList: jest.fn(), startWahaTyping: jest.fn(), stopWahaTyping: jest.fn(), resolveWahaChatPhone: jest.fn() }));
jest.mock("@/lib/services/whatsappMessageTemplates", () => {
    const actual = jest.requireActual("@/lib/services/whatsappMessageTemplates");
    return { ...actual, getRestaurantTemplateData: jest.fn().mockResolvedValue({ name: "Loja" }),
        getWhatsAppTemplates: jest.fn().mockResolvedValue(actual.DEFAULT_WHATSAPP_MESSAGE_TEMPLATES),
        buildRestaurantTemplateVariables: jest.fn().mockReturnValue({ NOME_DO_RESTAURANTE: "Loja", LINK_DO_CARDAPIO: "https://example.com/loja" }) };
});
const input = { restaurantId: "restaurant", sessionName: "session", chatId: "chat", messageId: "message", body: "Qual sabor você recomenda?", hasMedia: false };
let welcome: boolean, mode: string;
beforeEach(() => {
    jest.clearAllMocks();
    welcome = false; mode = "bot";
    (withAdvisoryLock as jest.Mock).mockImplementation((_: string, fn: () => unknown) => fn());
    (withTransaction as jest.Mock).mockImplementation((fn: (client: unknown) => unknown) => fn({ query }));
    (getWhatsAppAiReply as jest.Mock).mockResolvedValue(null);
    (getCrmReply as jest.Mock).mockResolvedValue(null);
    (resolveWahaChatPhone as jest.Mock).mockResolvedValue("5511888888888");
    (sendWahaText as jest.Mock).mockResolvedValue({ id: "provider" });
    (sendWahaList as jest.Mock).mockResolvedValue({ id: "provider" });
    (startWahaTyping as jest.Mock).mockResolvedValue(undefined);
    (stopWahaTyping as jest.Mock).mockResolvedValue(undefined);
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        const conversation = { mode, human_until: null, last_inbound_at: new Date().toISOString(), customer_name: "Ana" };
        if (sql.includes("SELECT mode")) return { rows: welcome ? [] : [conversation], rowCount: 1 };
        if (sql.includes("INSERT INTO whatsapp_conversations")) return { rows: [conversation], rowCount: 1 };
        return { rows: [], rowCount: 1 };
    });
});
test.each(["menu", "cardapio", "onde esta meu pedido", "entrega", "pagamento", "atendente"])("keeps deterministic '%s' ahead of AI", async (body) => {
    await processIncomingWhatsAppMessage({ ...input, body });
    expect(getWhatsAppAiReply).not.toHaveBeenCalled();
});
test("keeps welcome, media, CRM and human/storm suppression ahead of AI", async () => {
    welcome = true;
    await processIncomingWhatsAppMessage(input);
    welcome = false;
    await processIncomingWhatsAppMessage({ ...input, body: "", hasMedia: true });
    for (mode of ["human", "storm"]) await processIncomingWhatsAppMessage(input);
    mode = "bot";
    (getCrmReply as jest.Mock).mockResolvedValue({ text: "Oferta", rows: [] });
    await processIncomingWhatsAppMessage(input);
    expect(getWhatsAppAiReply).not.toHaveBeenCalled();
});
test("replaces only the unrecognized-message reply and keeps typing", async () => {
    (getWhatsAppAiReply as jest.Mock).mockResolvedValue({ text: "Temos opções no cardápio!" });
    await processIncomingWhatsAppMessage(input);
    expect(sendWahaText).toHaveBeenCalledWith("session", "chat", "Temos opções no cardápio!");
    expect(sendWahaList).not.toHaveBeenCalled();
    expect(startWahaTyping).toHaveBeenCalled();
    expect(stopWahaTyping).toHaveBeenCalled();
});
test.each(["menu_link", "order_status", "delivery", "payment", "handoff"])("executes the same %s flow when AI requests it", async (flow) => {
    (getWhatsAppAiReply as jest.Mock).mockResolvedValue({ flow });
    await processIncomingWhatsAppMessage(input);
    expect(sendWahaText).toHaveBeenCalledTimes(1);
    const text = (sendWahaText as jest.Mock).mock.calls[0][2];
    if (flow === "order_status") expect(text).toContain("Envie o telefone com DDD");
    else expect(text).toContain(DEFAULT_WHATSAPP_MESSAGE_TEMPLATES[flow as "menu_link" | "delivery" | "payment" | "handoff"].split("{{")[0]);
    if (flow === "handoff") expect(sendOwnerPush).toHaveBeenCalled();
});
test("retains the original fallback when AI is disabled or fails", async () => {
    await processIncomingWhatsAppMessage(input);
    expect(sendWahaText).toHaveBeenCalledWith("session", "chat", "Não entendi essa mensagem.");
    expect(sendWahaList).toHaveBeenCalled();
});
test("does not answer if the owner takes over during inference", async () => {
    (getWhatsAppAiReply as jest.Mock).mockImplementation(async () => { mode = "human"; return { text: "Resposta" }; });
    await processIncomingWhatsAppMessage(input);
    expect(sendWahaText).not.toHaveBeenCalled();
    expect(stopWahaTyping).toHaveBeenCalled();
});
