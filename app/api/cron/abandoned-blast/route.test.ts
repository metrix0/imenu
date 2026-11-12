import { GET } from "./route";
import { query } from "@/lib/database/sql";
import { createSupportBlast } from "@/lib/services/supportBlast";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/supportBlast", () => ({
    createSupportBlast: jest.fn(),
    normalizeBlastPhone: (phone: string) => phone,
}));

const phone = "5511999999999";
const request = () => new Request("https://example.com/api/cron/abandoned-blast", {
    headers: { authorization: "Bearer test-secret" },
});
const mockQuery = query as jest.Mock;
const mockBlast = createSupportBlast as jest.Mock;

beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date("2026-10-22T22:00:00Z"));
    process.env.CRON_SECRET = "test-secret";
    mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("AS total FROM support_blast_recipients")) return { rows: [{ total: 0 }] };
        if (sql.includes("WITH first_month AS")) return { rows: [] };
        if (sql.includes("SELECT DISTINCT phone FROM support_blast_recipients")) {
            return { rows: sql.includes("INTERVAL '60 days'") ? [{ phone }] : [] };
        }
        if (sql.includes("completed AS (")) {
            return { rows: [{ account_id: "account-1", restaurant_name: "Loja", owner_phone: phone, has_plus: false }] };
        }
        return { rows: [] };
    });
    mockBlast.mockResolvedValue("campaign-id");
});

afterEach(() => {
    jest.useRealTimers();
    delete process.env.CRON_SECRET;
    jest.clearAllMocks();
});

test("recovery keeps the 60-day cooldown including historical sends", async () => {
    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
        day: "2026-10-22", eligible: 1, queued: 0, feedbackQueued: 0,
    });
    expect(mockBlast).not.toHaveBeenCalled();

    const historySql = mockQuery.mock.calls.find(([sql]) =>
        String(sql).includes("SELECT DISTINCT phone FROM support_blast_recipients")
    )?.[0] as string;
    expect(historySql).toContain("sent_at >= NOW() - INTERVAL '60 days'");
    expect(historySql).toContain("updated_at >= NOW() - INTERVAL '60 days'");
    expect(historySql).toContain("status IN ('pending', 'processing')");
    const eligibilitySql = mockQuery.mock.calls.find(([sql]) => String(sql).includes("completed AS ("))?.[0] as string;
    expect(eligibilitySql).toContain("o.created_at >= clock.as_of - INTERVAL '30 days'");
});

test("recovery selects only the 13 highest-GMV accounts across Plus and iMenu", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("AS total FROM support_blast_recipients")) return { rows: [{ total: 0 }] };
        if (sql.includes("WITH first_month AS")) return { rows: [] };
        if (sql.includes("completed AS (")) return { rows: Array.from({ length: 22 }, (_, i) => ({
            account_id: `account-${i + 1}`,
            restaurant_name: `Loja ${i + 1}`,
            owner_phone: `551199999${String(i + 1).padStart(4, "0")}`,
            has_plus: i < 12,
        })) };
        if (sql.includes("AS gmv_cents")) return { rows: Array.from({ length: 22 }, (_, i) => ({
            account_id: `account-${i + 1}`, gmv_cents: (i + 1) * 10000,
        })) };
        return { rows: [] };
    });

    const response = await GET(request());
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ queued: 13, eligible: 22 });
    const calls = mockBlast.mock.calls.map(([arg]) => arg);
    expect(calls.reduce((sum, arg) => sum + arg.recipients.length, 0)).toBe(13);
    expect(calls.every(arg => arg.dailyLimit === 13 && arg.skipRecent === true && arg.sender === "blast")).toBe(true);
    const allMessages = calls.flatMap(arg => arg.recipients.map((row: { message: string }) => row.message));
    expect(allMessages.some(message => message.includes("Loja 22"))).toBe(true);
    expect(allMessages.some(message => message.includes("Loja 1."))).toBe(false);
});

test("recovery does not replenish its daily limit after campaigns are queued", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("AS total FROM support_blast_recipients")) return { rows: [{ total: 13 }] };
        if (sql.includes("WITH first_month AS")) return { rows: [] };
        if (sql.includes("completed AS (")) return { rows: [{ account_id: "account-1", restaurant_name: "Loja", owner_phone: phone }] };
        return { rows: [] };
    });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ queued: 0 });
    expect(mockBlast).not.toHaveBeenCalled();
});

test("first-month feedback queues at most five customers with Pix before card", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("AS total FROM support_blast_recipients")) return { rows: [{ total: 0 }] };
        if (sql.includes("WITH first_month AS")) return { rows: [
            ...Array.from({ length: 6 }, (_, i) => ({
                addon_id: `addon-pix-${i}`, account_id: `pix-${i}`,
                restaurant_name: `Pix ${i}`, owner_phone: `551188888${String(i).padStart(4, "0")}`, pix_first: true,
            })),
            ...Array.from({ length: 2 }, (_, i) => ({
                addon_id: `addon-card-${i}`, account_id: `card-${i}`,
                restaurant_name: `Cartao ${i}`, owner_phone: `551177777${String(i).padStart(4, "0")}`, pix_first: false,
            })),
        ] };
        return { rows: [] };
    });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ feedbackQueued: 5, queued: 0, feedbackError: false });
    expect(mockBlast).toHaveBeenCalledTimes(1);
    const args = mockBlast.mock.calls[0][0];
    expect(args).toMatchObject({ sender: "support", dailyLimit: 5, skipRecent: true });
    expect(args.recipients).toHaveLength(5);
    expect(args.recipients.every((r: { message: string }) => r.message.includes("Pix"))).toBe(true);
});

test("feedback honors already reserved slots and previous contacts", async () => {
    mockQuery.mockImplementation(async (sql: string) => {
        if (sql.includes("AS total FROM support_blast_recipients")) return { rows: [{ total: 3 }] };
        if (sql.includes("WITH first_month AS")) return { rows: Array.from({ length: 6 }, (_, i) => ({
            addon_id: `addon-${i}`, account_id: `acc-${i}`,
            restaurant_name: `Restaurante ${i}`, owner_phone: `551166666${String(i).padStart(4, "0")}`, pix_first: true,
        })) };
        if (sql.includes("SELECT DISTINCT recipient.phone")) return { rows: [{ phone: "5511666660000" }] };
        return { rows: [] };
    });
    const body = await (await GET(request())).json();
    expect(body).toMatchObject({ feedbackQueued: 2 });
    const args = mockBlast.mock.calls[0][0];
    expect(args.recipients.map((r: { phone: string }) => r.phone)).toEqual(["5511666660001", "5511666660002"]);
});

test("outside 19h São Paulo does not schedule messages", async () => {
    jest.setSystemTime(new Date("2026-10-22T23:00:00Z"));
    expect(await (await GET(request())).json()).toMatchObject({ skipped: "outside_sending_hour" });
    expect(mockQuery).not.toHaveBeenCalled();
    expect(mockBlast).not.toHaveBeenCalled();
});
