import { query } from "@/lib/database/sql";
import { getMercadoPagoPixPayment } from "@/lib/payments/mercadoPagoPix";
import { createPayoutPlan } from "./payouts";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/payments/mercadoPagoPix", () => ({ getMercadoPagoPixPayment: jest.fn() }));
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
it("excludes a restaurant if the actual Mercado Pago fee cannot be verified", async () => {
    (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({
        id: "123", externalReference: "new", status: "approved", paymentMethodId: "pix", amount: 50, feeCents: null,
    });
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true });
    expect(plan.sendable).toHaveLength(0);
    expect(plan.validationErrors).toMatchObject([{ restaurantId: "r", message: expect.stringContaining("confirmar a taxa") }]);
});

it("keeps another restaurant payable when one Mercado Pago payment is pending", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [
        { restaurant_id: "bad", restaurant_name: "Bad", payment_info: "bad@example.com", payment_info_type: "EMAIL",
          gross_cents: 200, pix_order_count: 1,
          payments: [{ id: "pending-order", payment_ref: "111", total_cents: 200 }] },
        { restaurant_id: "good", restaurant_name: "Good", payment_info: "good@example.com", payment_info_type: "EMAIL",
          gross_cents: 5000, pix_order_count: 1,
          payments: [{ id: "good-order", payment_ref: "222", total_cents: 5000 }] },
    ] });
    (getMercadoPagoPixPayment as jest.Mock).mockImplementation(async ({ id }: { id: string }) =>
        id === "111"
            ? { id, externalReference: "pending-order", status: "pending", paymentMethodId: "pix", amount: 2, feeCents: 0 }
            : { id, externalReference: "good-order", status: "approved", paymentMethodId: "pix", amount: 50, feeCents: 50 }
    );
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true });
    expect(plan.validationErrors).toMatchObject([{ restaurantId: "bad", grossCents: 200, message: expect.stringContaining("não aprovado (pending)") }]);
    expect(plan.sendable).toHaveLength(1);
    expect(plan.sendable[0].row.restaurant_id).toBe("good");
    expect(plan.totalNetCents).toBe(4950);
});
