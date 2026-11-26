import { GET, POST } from "./route";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/dev/authorize", () => ({ authorize: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

beforeEach(() => {
    jest.resetAllMocks();
    (authorize as jest.Mock).mockResolvedValue(null);
    (query as jest.Mock).mockResolvedValue({ rows: [{ total: 0 }], rowCount: 1 });
});

test.each(["unread", "history"])("%s alerts exclude individual Gemini fallbacks, not recurring notifications", async view => {
    const response = await GET(new Request(`https://example.com/api/dev/health?section=alerts&view=${view}`));
    expect(response.status).toBe(200);
    expect(query).toHaveBeenCalledTimes(2);
    for (const [sql] of (query as jest.Mock).mock.calls) {
        expect(sql).toContain("source IS DISTINCT FROM 'gemini'");
        expect(sql).toContain("operation IS DISTINCT FROM 'Importação de cardápio: fallback OpenAI'");
        expect(sql).toContain("severity IS DISTINCT FROM 'info'");
        expect(sql).toContain("trigger_type IS DISTINCT FROM 'none'");
    }
});

test("mark-all only acknowledges visible alerts", async () => {
    const response = await POST(new Request("https://example.com/api/dev/health?section=alerts", {
        method: "POST", body: JSON.stringify({ all: true }),
    }));
    expect(response.status).toBe(200);
    expect((query as jest.Mock).mock.calls[0][0]).toContain("source IS DISTINCT FROM 'gemini'");
});

test("shows the local IBGE check in the existing Health connections", async () => {
    const response = await GET(new Request("https://example.com/api/dev/health"));
    expect(response.status).toBe(200);
    const result = await response.json();
    expect(result.connections).toEqual(expect.arrayContaining([
        expect.objectContaining({
            id: "ibge", name: "IBGE / CNEFE",
            observation: expect.objectContaining({ operation: "Geocodificação local" }),
        }),
    ]));
});


test.each([undefined, "openai", "gemini"])("Gemini health reflects the scan provider (%s)", async provider => {
    const previous = process.env.MENU_SCAN_PROVIDER;
    try {
        if (provider === undefined) delete process.env.MENU_SCAN_PROVIDER;
        else process.env.MENU_SCAN_PROVIDER = provider;
        (query as jest.Mock).mockImplementation(async (sql: string) => ({ rows: sql.includes("FROM public.dev_integration_status") ? [{ source: "gemini", check_kind: "probe", state: "degraded", http_status: 200, checked_at: new Date().toISOString(), operation: "Modelo de importação de cardápio", detail: "6 fallback(s)" }] : [] }));
        const response = await GET(new Request("https://example.com/api/dev/health"));
        expect(response.status).toBe(200);
        const gemini = (await response.json()).connections.find((item: { id: string }) => item.id === "gemini");
        expect(gemini.observation).toMatchObject(provider === "gemini"
            ? { state: "degraded", status: 200, detail: "6 fallback(s)" }
            : { state: "disabled", status: null, checkedAt: null, detail: "Importação de cardápio utiliza OpenAI." });
    } finally {
        if (previous === undefined) delete process.env.MENU_SCAN_PROVIDER;
        else process.env.MENU_SCAN_PROVIDER = previous;
    }
});
