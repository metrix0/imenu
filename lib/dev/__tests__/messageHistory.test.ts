import { getMessageHistory } from "../messageHistory";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

beforeEach(() => { jest.clearAllMocks(); });

test("combines follow-ups, Plus welcomes, and customer automations, never order notifications", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
    await getMessageHistory(new URLSearchParams());
    const sql = String((query as jest.Mock).mock.calls[0][0]);
    expect(sql).toContain("support:followup:%");
    expect(sql).toContain("support:addon-purchase:%");
    expect(sql).toContain("o.automation_type IN ('cart', 'reactivation', 'habit')");
    expect(sql).not.toContain("dedupe_key LIKE 'order:%'");
    expect(sql).toContain("NULLIF(o.context->>'message', '')");
});

test("type filters are parameterized and pagination uses the shared 25-row limit", async () => {
    (query as jest.Mock).mockImplementation(async (sql: string) =>
        sql.includes("COUNT(*)") ? { rows: [{ total: 36 }] } : { rows: [] }
    );
    const result = await getMessageHistory(new URLSearchParams({ type: "automation", page: "1" }));
    expect(result).toMatchObject({ page: 1, pageCount: 2, total: 36 });
    expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT $2 OFFSET $3"), ["automation", 25, 25]);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("COUNT(*)::int"), ["automation"]);
    await getMessageHistory(new URLSearchParams({ type: "order", page: "-1" }));
    expect(query).toHaveBeenCalledWith(expect.stringContaining("LIMIT $2 OFFSET $3"), ["all", 25, 0]);
});
