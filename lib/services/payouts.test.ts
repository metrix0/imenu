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
it("excludes only an unverified payment while retaining a verified PayZu order", async () => {
    (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({
        id: "123", externalReference: "new", status: "approved", paymentMethodId: "pix", amount: 50, feeCents: null,
    });
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true });
    expect(plan).toMatchObject({ grossCents: 5000, payzuFeeCents: 10, totalNetCents: 4950 });
    expect(plan.sendable).toHaveLength(1);
    expect(plan.sendable[0].row.payments).toMatchObject([{ id: "legacy" }]);
    expect(plan.sendable[0].orderCount).toBe(1);
    expect(plan.validationErrors).toMatchObject([{ restaurantId: "r", orderId: "new", paymentRef: "123", grossCents: 5000, message: expect.stringContaining("confirmar a taxa") }]);
});

it("keeps verified Mercado Pago orders from the SAME restaurant when one is pending", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{
        restaurant_id: "r", restaurant_name: "R", payment_info: "pix@example.com", payment_info_type: "EMAIL",
        gross_cents: 7000, pix_order_count: 2,
        payments: [{ id: "pending", payment_ref: "111", total_cents: 2000 }, { id: "approved", payment_ref: "222", total_cents: 5000 }],
    }] });
    (getMercadoPagoPixPayment as jest.Mock).mockImplementation(async ({ id }: { id: string }) =>
        id === "111"
            ? { id, externalReference: "pending", status: "pending", paymentMethodId: "pix", amount: 20, feeCents: 0 }
            : { id, externalReference: "approved", status: "approved", paymentMethodId: "pix", amount: 50, feeCents: 50 }
    );
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true, restaurantIds: ["r"] });
    expect(plan).toMatchObject({ grossCents: 5000, payzuFeeCents: 50, totalNetCents: 4950 });
    expect(plan.sendable).toHaveLength(1);
    expect(plan.sendable[0].row.payments).toEqual([{ id: "approved", payment_ref: "222", total_cents: 5000 }]);
    expect(plan.sendable[0].orderCount).toBe(1);
    expect(plan.validationErrors).toMatchObject([{ restaurantId: "r", orderId: "pending", grossCents: 2000, message: expect.stringContaining("não aprovado (pending)") }]);
});

it("excludes multiple failed orders of one restaurant without discarding verified orders", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{
        restaurant_id: "r", restaurant_name: "R", payment_info: "pix@example.com", payment_info_type: "EMAIL",
        gross_cents: 12000, pix_order_count: 3,
        payments: [
            { id: "bad1", payment_ref: "111", total_cents: 2000 },
            { id: "bad2", payment_ref: "222", total_cents: 5000 },
            { id: "good", payment_ref: "333", total_cents: 5000 },
        ],
    }] });
    (getMercadoPagoPixPayment as jest.Mock).mockImplementation(async ({ id }: { id: string }) => {
        if (id === "111") throw new Error("API indisponível");
        return { id, externalReference: id === "222" ? "bad2" : "good",
            status: id === "222" ? "rejected" : "approved", paymentMethodId: "pix",
            amount: 50, feeCents: 50 };
    });
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true, restaurantIds: ["r"] });
    expect(plan.sendable).toHaveLength(1);
    expect(plan.totalNetCents).toBe(4950);
    expect(plan.validationErrors.map(error => error.orderId)).toEqual(["bad1", "bad2"]);
    expect(plan.sendable[0].row.payments.map(payment => payment.id)).toEqual(["good"]);
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
