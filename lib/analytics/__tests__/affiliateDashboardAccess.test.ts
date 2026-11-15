import { GET } from "@/app/api/(extra)/afiliados/[code]/route";
import { affiliateDashboardLink, affiliateReferralLink } from "../affiliateCode";
import { query } from "@/lib/database/sql";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

const queryMock = jest.mocked(query);

function dashboard(code: string) {
    const request = new Request(`http://localhost/api/afiliados/${encodeURIComponent(code)}?page=2&purchases=3`);
    return GET(request, { params: Promise.resolve({ code }) });
}

test("invalid affiliate codes return 404 without querying the database", async () => {
    expect((await dashboard("invalid code")).status).toBe(404);
    expect(queryMock).not.toHaveBeenCalled();
});

test("unknown affiliate codes return 404", async () => {
    queryMock.mockResolvedValueOnce({ rows: [], rowCount: 0 });
    expect((await dashboard("unknown")).status).toBe(404);
});

test("the dashboard opens using just the code, with independent pagination", async () => {
    queryMock.mockResolvedValue({ rows: [{
        referrals: 22, purchases: 35, commission_cents: 1825,
        referral_rows: [{ position: 1, restaurant_name: null, referred_at: "2026-11-15", has_purchase: false }],
        purchase_rows: [{ position: 1, restaurant_name: "Restaurante", paid_at: "2026-11-15", commission_cents: 750 }],
    }], rowCount: 1 });

    const response = await dashboard("jonatas");
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(queryMock).toHaveBeenCalledWith(expect.any(String), ["jonatas", 10, 20, 30]);
    expect(await response.json()).toMatchObject({
        referrals: { page: 2, total: 22, pageCount: 3 },
        purchases: { page: 3, total: 35, pageCount: 4 },
        commissionCents: 1825,
    });
});

test("both affiliate links use the production origin", () => {
    expect(affiliateReferralLink("jonatas")).toBe("https://www.imenuapp.com.br/?af=jonatas");
    expect(affiliateDashboardLink("jonatas")).toBe("https://www.imenuapp.com.br/afiliados/jonatas");
});
