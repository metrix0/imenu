import { query } from "@/lib/database/sql";
import { getMercadoPagoPixPayment } from "@/lib/mercadoPagoPix";
import { createPayoutPlan } from "./payouts";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/mercadoPagoPix", () => ({ getMercadoPagoPixPayment: jest.fn() }));
beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue({ rows: [{ restaurant_id: "r", restaurant_name: "R", payment_info: "pix@example.com", payment_info_type: "EMAIL", gross_cents: 10000, pix_order_count: 2,
        payments: [{ id: "legacy", payment_ref: "PIX1", total_cents: 5000 }, { id: "new", payment_ref: "123", total_cents: 5000 }] }] });
    (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({ id: "123", externalReference: "new", status: "approved", paymentMethodId: "pix", amount: 50, feeCents: 50 });
});
it("combines historical PayZu and actual Mercado Pago fees without changing the restaurant's 1% total deduction", async () => {
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true });
    expect(plan).toMatchObject({ grossCents: 10000, payzuFeeCents: 60, discountCents: 40, totalNetCents: 9900 });
    expect(getMercadoPagoPixPayment).toHaveBeenCalledTimes(1);
});
it("blocks a payout if the actual Mercado Pago fee cannot be verified", async () => {
    (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({ id: "123", feeCents: null });
    await expect(createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true })).rejects.toThrow("confirmar a taxa");
});
