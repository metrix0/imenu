import { query } from "@/lib/database/sql";
import { activateMercadoPagoQrTablePrepaid, markMercadoPagoQrTablePaymentFailure } from "./mercadoPagoBilling";
import { sendAddonPurchaseWhatsApp } from "@/lib/services/addonPurchaseWhatsApp";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/services/addonPurchaseWhatsApp", () => ({
    sendAddonPurchaseWhatsApp: jest.fn(),
}));

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

const activationInput = {
    addonId: "10000000-0000-4000-8000-000000000001",
    paymentId: "123",
    status: "approved",
    paidAt: "2026-10-17T16:43:34.000Z",
};

it("does not re-send a welcome after a previously approved Pix payment", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [], rowCount: 0 });
    await activateMercadoPagoQrTablePrepaid(activationInput);
    expect(sendAddonPurchaseWhatsApp).not.toHaveBeenCalled();
});

it("sends a welcome exactly once when a payment transitions to approved", async () => {
    (query as jest.Mock)
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    await activateMercadoPagoQrTablePrepaid(activationInput);
    await activateMercadoPagoQrTablePrepaid(activationInput);
    expect(sendAddonPurchaseWhatsApp).toHaveBeenCalledTimes(1);
});
