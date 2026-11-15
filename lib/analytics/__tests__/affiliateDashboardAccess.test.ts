import { GET } from "@/app/api/(extra)/afiliados/[code]/route";
import { affiliateDashboardToken } from "../affiliateDashboardAccess";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

const queryMock = jest.mocked(query);
const originalSecret = process.env.CRON_SECRET;

beforeEach(() => { process.env.CRON_SECRET = "isolated-dashboard-test-secret"; });
afterEach(() => {
    if (originalSecret === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = originalSecret;
});

function dashboard(code: string, token?: string | null) {
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
    const request = new Request(`http://localhost/api/afiliados/${code}?page=2&purchases=3`, { headers });
    return GET(request, { params: Promise.resolve({ code }) });
}

test("public codes and another affiliate's private token cannot query the dashboard", async () => {
    expect((await dashboard("jonatas")).status).toBe(403);
    expect((await dashboard("jonatas", affiliateDashboardToken("test"))).status).toBe(403);
    expect((await dashboard("jonatas", "x".repeat(64))).status).toBe(403);
    const token = affiliateDashboardToken("jonatas");
    delete process.env.CRON_SECRET;
    expect((await dashboard("jonatas", token)).status).toBe(403);
    expect(queryMock).not.toHaveBeenCalled();
});

test("the authorized dashboard queries only its code, with independent pagination", async () => {
    queryMock.mockResolvedValue({ rows: [{
        referrals: 22, purchases: 35, commission_cents: 1825,
        referral_rows: [{ position: 1, restaurant_name: null, referred_at: "2026-11-15", has_purchase: false }],
        purchase_rows: [{ position: 1, restaurant_name: "Restaurante", paid_at: "2026-11-15", commission_cents: 750 }],
    }], rowCount: 1 });

    const response = await dashboard("jonatas", affiliateDashboardToken("jonatas"));
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("private, no-store");
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["jonatas", 10, 20, 30]);
    expect(await response.json()).toMatchObject({
        referrals: { page: 2, total: 22, pageCount: 3 },
        purchases: { page: 3, total: 35, pageCount: 4 },
        commissionCents: 1825,
    });
});
