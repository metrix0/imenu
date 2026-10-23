import { GET } from "./route";
import { query } from "@/lib/database/sql";
import { createSupportBlast } from "@/lib/services/supportBlast";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/supportBlast", () => ({
    createSupportBlast: jest.fn(),
    normalizeBlastPhone: (phone: string) => phone,
}));

const phone = "5511999999999";

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-22T23:00:00Z"));
    process.env.CRON_SECRET = "test-secret";
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("SELECT DISTINCT phone FROM support_blast_recipients")) {
            // A prior send 45 days ago is returned only by the longer cooldown.
            return { rows: sql.includes("INTERVAL '60 days'") ? [{ phone }] : [] };
        }
        if (sql.includes("completed AS (")) {
            return { rows: [{ account_id: "account-1", restaurant_name: "Loja", owner_phone: phone }] };
        }
        return { rows: [] };
    });
    (createSupportBlast as jest.Mock).mockResolvedValue("campaign-id");
});

afterEach(() => {
    jest.useRealTimers();
    delete process.env.CRON_SECRET;
    jest.clearAllMocks();
});

test("the 20h recovery snapshot also blocks recipients of older (31-60 day) blasts", async () => {
    const response = await GET(new Request("https://example.com/api/cron/abandoned-blast", {
        headers: { authorization: "Bearer test-secret" },
    }));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ day: "2026-10-22", eligible: 1, queued: 0 });
    expect(createSupportBlast).not.toHaveBeenCalled();

    const historySql = (query as jest.Mock).mock.calls.find(([sql]) =>
        String(sql).includes("SELECT DISTINCT phone FROM support_blast_recipients")
    )?.[0] as string;
    expect(historySql).toContain("sent_at >= NOW() - INTERVAL '60 days'");
    expect(historySql).toContain("updated_at >= NOW() - INTERVAL '60 days'");
    expect(historySql).toContain("status IN ('pending', 'processing')");
    const eligibilitySql = (query as jest.Mock).mock.calls[0][0] as string;
    expect(eligibilitySql).toContain("o.created_at >= clock.as_of - INTERVAL '30 days'");
});
