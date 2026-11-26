import { GET } from "./route";

jest.mock("@/lib/dev/authorize", () => ({ authorize: jest.fn().mockResolvedValue(null) }));
jest.mock("@/lib/ia-vendas/creditPricing", () => ({ getUsdBrlRate: jest.fn().mockResolvedValue(5) }));

test("attributes identical models to distinct features without double counting shared costs", async () => {
    const originalFetch = global.fetch, originalKey = process.env.OPENAI_ADMIN_KEY;
    process.env.OPENAI_ADMIN_KEY = "test-admin";
    const yesterday = Math.floor(Date.now() / 86400000) * 86400 - 86400;
    global.fetch = jest.fn(async (input: string | URL) => {
        const url = new URL(String(input));
        if (url.pathname.endsWith("/projects")) return Response.json({ data: [{ id: "proj" }], has_more: false });
        if (url.pathname.endsWith("/api_keys")) return Response.json({ data: [{ id: "key-a", name: "imenu-assistant" }, { id: "key-s", name: "imenu-support" }], has_more: false });
        expect(url.searchParams.getAll("group_by")).toEqual(["line_item", "api_key_id"]);
        return Response.json({ has_more: false, data: [{ start_time: yesterday, results: [
            { line_item: "gpt-6-luna, input", api_key_id: "key-a", amount: { value: 1, currency: "usd" } },
            { line_item: "gpt-6-luna, output", api_key_id: "key-a", amount: { value: 2, currency: "usd" } },
            { line_item: "gpt-6-luna, input", api_key_id: "key-s", amount: { value: 4, currency: "usd" } },
            { line_item: "gpt-6-luna, input", api_key_id: "old", amount: { value: 5, currency: "usd" } },
        ] }] });
    }) as typeof fetch;
    try {
        const payload = await (await GET(new Request("https://localhost/api/dev/quality-assurance/costs"))).json();
        expect(payload.status).toBe("ok");
        expect(payload.totalUsd).toBe(12);
        expect(payload.breakdown).toEqual(expect.arrayContaining([
            expect.objectContaining({ label: "OpenAI · Assistente IA — Chat", usd: 3 }),
            expect.objectContaining({ label: "OpenAI · Suporte Chatbot IA — Chat e visão de imagens", usd: 4 }),
            expect.objectContaining({ label: "Sem atribuição · gpt-6-luna, input", usd: 5 }),
        ]));
        expect(payload.features.map((f: { id: string; dailyUsd: number[] }) => [f.id, f.dailyUsd.at(-1)])).toEqual(expect.arrayContaining([
            ["Assistente IA — Chat", 3], ["Suporte Chatbot IA — Chat e visão de imagens", 4], ["Sem atribuição", 5],
        ]));
    } finally {
        global.fetch = originalFetch;
        if (originalKey === undefined) delete process.env.OPENAI_ADMIN_KEY;
        else process.env.OPENAI_ADMIN_KEY = originalKey;
    }
});
