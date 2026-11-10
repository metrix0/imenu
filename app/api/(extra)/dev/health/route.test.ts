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
