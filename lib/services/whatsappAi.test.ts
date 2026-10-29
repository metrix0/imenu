import OpenAI from "openai";
import { query } from "@/lib/database/sql";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { getWahaRecentTextHistory, startWahaTyping } from "@/lib/services/wahaClient";
import { getWhatsAppAiReply } from "./whatsappAi";

jest.mock("openai", () => ({ __esModule: true, default: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/addons/access", () => ({ hasIMenuPlusAccess: jest.fn() }));
jest.mock("@/lib/services/wahaClient", () => ({ getWahaRecentTextHistory: jest.fn(), startWahaTyping: jest.fn() }));
const input = { restaurantId: "restaurant", sessionName: "session", chatId: "chat", messageId: "message", body: "Vocês têm pizza?", variables: { NOME_DO_RESTAURANTE: "Loja" } };
const create = jest.fn();
let enabled: boolean, counts: { chat_count: number; restaurant_count: number };
const call = (name: string, args = {}) => ({ output_text: "", output: [{ type: "function_call", name, arguments: JSON.stringify(args), call_id: "call" }] });
beforeEach(() => {
    jest.clearAllMocks();
    process.env.OPENAI_API_KEY = "test-key";
    enabled = true;
    counts = { chat_count: 0, restaurant_count: 0 };
    (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(true);
    (OpenAI as unknown as jest.Mock).mockImplementation(() => ({ responses: { create } }));
    create.mockReset().mockResolvedValue({ output_text: "Olá! Como posso ajudar?", output: [] });
    (getWahaRecentTextHistory as jest.Mock).mockResolvedValue([]);
    (startWahaTyping as jest.Mock).mockResolvedValue(undefined);
    (query as jest.Mock).mockImplementation(async (sql: string) => ({ rows: sql.includes("whatsapp_bot_settings") ? [{ enabled }] : [counts], rowCount: 1 }));
});
afterEach(() => { jest.useRealTimers(); });
test.each(["disabled", "expired Plus", "missing key"])("does not call AI when %s", async (reason) => {
    if (reason === "disabled") enabled = false;
    if (reason === "expired Plus") (hasIMenuPlusAccess as jest.Mock).mockResolvedValue(false);
    if (reason === "missing key") delete process.env.OPENAI_API_KEY;
    expect(await getWhatsAppAiReply(input)).toBeNull();
    expect(create).not.toHaveBeenCalled();
});
test.each([{ chat_count: 10, restaurant_count: 10 }, { chat_count: 0, restaurant_count: 100 }])("avoids model costs at outbound limits %j", async (limit) => {
    counts = limit;
    expect(await getWhatsAppAiReply(input)).toBeNull();
    expect(create).not.toHaveBeenCalled();
});
test.each(["menu_link", "order_status", "delivery", "payment", "handoff"])("returns the existing %s action without a second model call", async (flow) => {
    create.mockResolvedValue(call(flow));
    expect(await getWhatsAppAiReply(input)).toEqual({ flow });
    expect(create).toHaveBeenCalledTimes(1);
});
test("retrieves only scoped, available menu data and limits its size", async () => {
    create.mockResolvedValueOnce(call("search_menu", { query: "pizza" })).mockResolvedValueOnce({ output_text: "Temos pizza a partir de R$ 30.", output: [] });
    (query as jest.Mock).mockImplementation(async (sql: string, params: unknown[]) => {
        if (!sql.includes("FROM items")) return { rows: sql.includes("whatsapp_bot_settings") ? [{ enabled }] : [counts] };
        expect(params).toEqual(["restaurant", "pizza"]);
        expect(sql).toMatch(/i.restaurant_id=\$1 AND i.is_available/);
        expect(sql).toMatch(/stock_quantity/);
        return { rows: [{ name: "Oculto", availability_schedule: [] }, ...Array.from({ length: 30 }, () => ({ name: "Pizza", price_cents: 3000, availability_schedule: null }))] };
    });
    expect(await getWhatsAppAiReply(input)).toEqual({ text: "Temos pizza a partir de R$ 30." });
    const sent = create.mock.calls[1][0].input.find((item: any) => item.type === "function_call_output");
    const data = JSON.parse(sent.output);
    expect(data.items).toHaveLength(16);
    expect(data.items.every((item: any) => item.name === "Pizza")).toBe(true);
});
test("bounds history, input, output and search rounds", async () => {
    (getWahaRecentTextHistory as jest.Mock).mockResolvedValue([
        { fromMe: false, body: "old", timestamp: Date.now() / 1000 - 3600 },
        { fromMe: true, body: "x".repeat(5000), timestamp: Date.now() / 1000 },
    ]);
    await getWhatsAppAiReply({ ...input, body: "q".repeat(5000) });
    const request = create.mock.calls[0][0];
    expect(request.input).toHaveLength(2);
    expect(request.input[0].content).toHaveLength(800);
    expect(request.input[1].content).toHaveLength(2000);
    expect(request).toMatchObject({ max_output_tokens: 400, store: false, parallel_tool_calls: false });
    expect(create.mock.calls[0][1].signal).toBeInstanceOf(AbortSignal);
    expect(OpenAI).toHaveBeenCalledWith(expect.objectContaining({ maxRetries: 0 }));
    create.mockReset().mockResolvedValue(call("search_menu", { query: "pizza" }));
    await getWhatsAppAiReply(input);
    expect(create).toHaveBeenCalledTimes(3);
    expect(create.mock.calls[2][0].tool_choice).toBe("none");
});
test("falls back on provider failure or an invalid tool", async () => {
    create.mockRejectedValueOnce(new Error("unavailable"));
    expect(await getWhatsAppAiReply(input)).toBeNull();
    create.mockResolvedValueOnce(call("delete_order"));
    expect(await getWhatsAppAiReply(input)).toBeNull();
});
test("refreshes typing during inference and clears its timer", async () => {
    jest.useFakeTimers();
    create.mockImplementationOnce(async () => {
        await jest.advanceTimersByTimeAsync(8_001);
        return { output_text: "Olá!", output: [] };
    });
    expect(await getWhatsAppAiReply(input)).toEqual({ text: "Olá!" });
    expect(startWahaTyping).toHaveBeenCalledWith("session", "chat");
    const count = (startWahaTyping as jest.Mock).mock.calls.length;
    await jest.advanceTimersByTimeAsync(30_000);
    expect(startWahaTyping).toHaveBeenCalledTimes(count);
});
