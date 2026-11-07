import { GET } from "./route";
import { query } from "@/lib/database/sql";
import { authorize } from "@/lib/dev/authorize";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/dev/authorize", () => ({ authorize: jest.fn() }));

const mockQuery = query as jest.Mock;
const mockAuthorize = authorize as jest.Mock;

beforeEach(() => {
    jest.clearAllMocks();
    mockAuthorize.mockResolvedValue(null);
});

it("lists confirmed Plus payments including renewals and aggregates Pix and card revenue", async () => {
    mockQuery
        .mockResolvedValueOnce({ rows: [{ purchases30: 2, new30: 1, renewals30: 1, gross30: "9998", pix30: 1, pix_gross30: "4999", card30: 1, card_gross30: "4999", other30: 0 }] })
        .mockResolvedValueOnce({ rows: [{ id: "payment-2", restaurant_id: "restaurant-1", restaurant_name: "Exemplo", paid_at: "2026-11-06T12:00:00Z", amount_cents: 4999, method: "Pix", payment_provider: "mercadopago", purchase_rank: 2, total: 2 }] });

    const response = await GET(new Request("https://example.com/api/dev/revenue?page=0"));
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.summary).toMatchObject({ purchases30: 2, new30: 1, renewals30: 1, gross30: 9998, pix30: 1, card30: 1 });
    expect(body.purchases).toMatchObject({ total: 2, page: 0, pageCount: 1 });
    expect(body.purchases.rows[0]).toMatchObject({ restaurantId: "restaurant-1", amountCents: 4999, method: "Pix", isRenewal: true });
    const [summarySql] = mockQuery.mock.calls[0];
    const [purchasesSql, params] = mockQuery.mock.calls[1];
    for (const sql of [summarySql, purchasesSql]) {
        expect(sql).toContain("addon.product_key = 'ia_plus'");
        expect(sql).toContain("PARTITION BY payment.addon_id");
        expect(sql).toContain("ROW_NUMBER() OVER");
        expect(sql).toContain("FROM paid");
        expect(sql).not.toContain("FROM first_purchases");
        expect(sql).toContain("payment.paid_at IS NOT NULL");
        expect(sql).toContain("UPPER(payment.status) IN");
    }
    expect(summarySql).toContain("purchase_rank > 1");
    expect(purchasesSql).toContain("purchase_rank, COUNT(*)");
    expect(params).toEqual([10, 0]);
});

it("rejects unauthorized requests without querying payments", async () => {
    const { NextResponse } = await import("next/server");
    mockAuthorize.mockResolvedValue(NextResponse.json({ error: "Acesso negado." }, { status: 403 }));
    const response = await GET(new Request("https://example.com/api/dev/revenue"));
    expect(response.status).toBe(403);
    expect(mockQuery).not.toHaveBeenCalled();
});

it("rejects invalid pages", async () => {
    const response = await GET(new Request("https://example.com/api/dev/revenue?page=-1"));
    expect(response.status).toBe(400);
    expect(mockQuery).not.toHaveBeenCalled();
});
