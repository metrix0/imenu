import { query, withAdvisoryLock, withTransaction } from "@/lib/database/sql";
import { getWhatsAppAiReply } from "@/lib/services/whatsappAi";
import { getCrmReply } from "@/lib/services/crmAutomations";
import { sendWahaText, sendWahaList, startWahaTyping, stopWahaTyping, resolveWahaChatPhone } from "@/lib/services/wahaClient";
import { DEFAULT_WHATSAPP_MESSAGE_TEMPLATES, getWhatsAppBotSettings } from "@/lib/services/whatsappMessageTemplates";
import { sendOwnerPush } from "@/lib/push/server";
import { isRecentWahaMessage, processIncomingWhatsAppMessage } from "./whatsappAutomation";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withAdvisoryLock: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/services/whatsappAi", () => ({ getWhatsAppAiReply: jest.fn() }));
jest.mock("@/lib/services/crmAutomations", () => ({ getCrmReply: jest.fn() }));
jest.mock("@/lib/services/whatsappNotification", () => ({ handleOrderNotificationReply: jest.fn().mockResolvedValue(false) }));
jest.mock("@/lib/push/server", () => ({ sendOwnerPush: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({ sendWahaText: jest.fn(), sendWahaList: jest.fn(), startWahaTyping: jest.fn(), stopWahaTyping: jest.fn(), resolveWahaChatPhone: jest.fn() }));
jest.mock("@/lib/services/whatsappMessageTemplates", () => {
    const actual = jest.requireActual("@/lib/services/whatsappMessageTemplates");
    return { ...actual, getRestaurantTemplateData: jest.fn().mockResolvedValue({ name: "Loja" }),
        getWhatsAppBotSettings: jest.fn(),
        getWhatsAppTemplates: jest.fn().mockResolvedValue(actual.DEFAULT_WHATSAPP_MESSAGE_TEMPLATES),
        buildRestaurantTemplateVariables: jest.fn().mockReturnValue({ NOME_DO_RESTAURANTE: "Loja", LINK_DO_CARDAPIO: "https://example.com/loja" }) };
});
const input = { restaurantId: "restaurant", sessionName: "session", chatId: "chat", messageId: "message", body: "Qual sabor você recomenda?", hasMedia: false };
let welcome: boolean, mode: string, aiEnabled: boolean;
beforeEach(() => {
    jest.clearAllMocks();
    welcome = false; mode = "bot"; aiEnabled = true;
    (getWhatsAppBotSettings as jest.Mock).mockImplementation(async () => ({
        templates: DEFAULT_WHATSAPP_MESSAGE_TEMPLATES, aiEnabled,
    }));
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
    await processIncomingWhatsAppMessage({ ...input, body: "Oi" });
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
test.each([false, true])("retains the original fallback when the AI is enabled=%s and there is no AI reply", async (enabled) => {
    aiEnabled = enabled;
    await processIncomingWhatsAppMessage(input);
    expect(getWhatsAppAiReply).toHaveBeenCalledTimes(enabled ? 1 : 0);
    expect(sendWahaText).toHaveBeenCalledWith("session", "chat", "Não entendi essa mensagem.");
    expect(sendWahaList).toHaveBeenCalled();
});
test.each([
    [true, "Quero dois hambúrgueres", "welcome"],
    [false, "quero pedir", "menu_link"],
    [false, "CONFIRMAR 123456", null],
] as const)("keeps the original reply with AI off (new chat=%s, message=%s)", async (newChat, body, template) => {
    welcome = newChat;
    aiEnabled = false;
    await processIncomingWhatsAppMessage({ ...input, body });
    expect(getWhatsAppAiReply).not.toHaveBeenCalled();
    const text = template ? DEFAULT_WHATSAPP_MESSAGE_TEMPLATES[template].split("{{")[0] : "Não entendi essa mensagem.";
    expect(sendWahaText).toHaveBeenCalledWith("session", "chat", expect.stringContaining(text));
    if (template !== "menu_link") expect(sendWahaList).toHaveBeenCalled();
});
test.each([
    [true, "Quero dois hambúrgueres"],
    [false, "quero pedir"],
] as const)("lets the AI handle early ordering messages when on (new chat=%s)", async (newChat, body) => {
    welcome = newChat;
    (getWhatsAppAiReply as jest.Mock).mockResolvedValue({ text: "Qual tamanho?" });
    await processIncomingWhatsAppMessage({ ...input, body });
    expect(getWhatsAppAiReply).toHaveBeenCalledWith(expect.objectContaining({ body, orderingOnly: true }));
    expect(sendWahaText).toHaveBeenCalledWith("session", "chat", "Qual tamanho?");
});
test("does not answer if the owner takes over during inference", async () => {
    (getWhatsAppAiReply as jest.Mock).mockImplementation(async () => { mode = "human"; return { text: "Resposta" }; });
    await processIncomingWhatsAppMessage(input);
    expect(sendWahaText).not.toHaveBeenCalled();
    expect(stopWahaTyping).toHaveBeenCalled();
});


test("ignores historical WAHA messages delivered after reconnection", () => {
    const now = Date.parse("2026-11-09T06:13:00Z");
    expect(isRecentWahaMessage(1794181313, now)).toBe(false); // Sent hours before the 03:13 replay.
    expect(isRecentWahaMessage(Math.floor(now / 1000), now)).toBe(true);
    expect(isRecentWahaMessage(now - 60_000, now)).toBe(true); // Millisecond timestamps.
    expect(isRecentWahaMessage(Math.floor((now + 3 * 60_000) / 1000), now)).toBe(false);
    expect(isRecentWahaMessage(undefined, now)).toBe(false);
});

test("serializes concurrent messages from the same WhatsApp chat", async () => {
    const tails = new Map<string, Promise<unknown>>();
    (withAdvisoryLock as jest.Mock).mockImplementation((key: string, fn: () => Promise<unknown>) => {
        const previous = tails.get(key) ?? Promise.resolve();
        const current = previous.catch(() => undefined).then(fn);
        tails.set(key, current.catch(() => undefined));
        return current;
    });
    let active = 0;
    let maxActive = 0;
    (sendWahaText as jest.Mock).mockImplementation(async () => {
        active++;
        maxActive = Math.max(active, maxActive);
        await new Promise((resolve) => setTimeout(resolve, 10));
        active--;
        return { id: "provider" };
    });
    await Promise.all([
        processIncomingWhatsAppMessage({ ...input, messageId: "first" }),
        processIncomingWhatsAppMessage({ ...input, messageId: "second" }),
    ]);
    expect(sendWahaText).toHaveBeenCalledTimes(2);
    expect(maxActive).toBe(1);
});
