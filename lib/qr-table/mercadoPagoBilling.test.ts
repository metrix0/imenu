import { query } from "@/lib/database/sql";
import { markMercadoPagoQrTablePaymentFailure } from "./mercadoPagoBilling";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue({ rows: [] });
});

it("expires QR Mesa access immediately for refunded or canceled Mercado Pago payments", async () => {
    await markMercadoPagoQrTablePaymentFailure({
        addonId: "10000000-0000-4000-8000-000000000001",
        paymentId: "123",
        status: "refunded",
        expireAccess: true,
    });

    const [sql, values] = (query as jest.Mock).mock.calls[0];
    expect(String(sql)).toMatch(/WHEN\s+\$4\s+THEN NOW\(\)/);
    expect(String(sql)).not.toContain("current_period_ends_at <= NOW()");
    expect(values[3]).toBe(true);
});
