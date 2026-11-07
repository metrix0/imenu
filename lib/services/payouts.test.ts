import { query } from "@/lib/database/sql";
import { getMercadoPagoPixPayment } from "@/lib/payments/mercadoPagoPix";
import { createPayoutPlan, retryFailedPayout } from "./payouts";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/payments/mercadoPagoPix", () => ({ getMercadoPagoPixPayment: jest.fn() }));
beforeEach(() => {
    jest.clearAllMocks();
    (query as jest.Mock).mockResolvedValue({ rows: [{ restaurant_id: "r", restaurant_name: "R", payment_info: "pix@example.com", payment_info_type: "EMAIL", gross_cents: 10000, pix_order_count: 2,
        payments: [{ id: "first", payment_ref: "123", total_cents: 5000 }, { id: "second", payment_ref: "456", total_cents: 5000 }] }] });
    (getMercadoPagoPixPayment as jest.Mock).mockImplementation(async ({ id }: { id: string }) => ({
        id, externalReference: id === "123" ? "first" : "second", status: "approved",
        paymentMethodId: "pix", amount: 50, feeCents: id === "123" ? 10 : 50,
    }));
});
it("combines verified Mercado Pago fees without changing the 1% total deduction", async () => {
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true });
    expect(plan).toMatchObject({ grossCents: 10000, payzuFeeCents: 60, discountCents: 40, totalNetCents: 9900 });
    expect(getMercadoPagoPixPayment).toHaveBeenCalledTimes(2);
});
it("excludes only a Mercado Pago charge with an unconfirmed fee", async () => {
    (getMercadoPagoPixPayment as jest.Mock).mockImplementation(async ({ id }: { id: string }) => ({
        id, externalReference: id === "123" ? "first" : "second", status: "approved",
        paymentMethodId: "pix", amount: 50, feeCents: id === "123" ? null : 50,
    }));
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true });
    expect(plan).toMatchObject({ grossCents: 5000, payzuFeeCents: 50, totalNetCents: 4950 });
    expect(plan.sendable[0].row.payments).toMatchObject([{ id: "second" }]);
    expect(plan.validationErrors).toMatchObject([{ orderId: "first", paymentRef: "123", message: expect.stringContaining("confirmar a taxa") }]);
});
it("excludes legacy PayZu orders rather than assuming they were paid", async () => {
    (query as jest.Mock).mockResolvedValue({ rows: [{
        restaurant_id: "r", restaurant_name: "R", payment_info: "pix@example.com", payment_info_type: "EMAIL",
        payments: [{ id: "legacy", payment_ref: "PIX1", total_cents: 5000 }],
    }] });
    const plan = await createPayoutPlan({ cutoffAt: new Date(), adjustToOnePercent: true });
    expect(plan.sendable).toHaveLength(0);
    expect(plan.validationErrors).toMatchObject([{ orderId: "legacy", message: expect.stringContaining("não pertence ao Mercado Pago") }]);
    expect(getMercadoPagoPixPayment).not.toHaveBeenCalled();
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

describe("retry failed payouts", () => {
    const originalAsaasKey = process.env.ASAAS_API_KEY;
    const payout = {
        id: "payout-id", restaurant_id: "r", restaurant_name: "R",
        amount_cents: 4950, gross_cents: 5000, payzu_fee_cents: 50,
        order_count: 1, created_at: "2026-11-01T12:00:00Z",
        has_later_payout: false, automation_run_id: null,
        asaas_transfer_id: null, payment_info: "pix@example.com", payment_info_type: "EMAIL",
    };
    beforeEach(() => {
        process.env.ASAAS_API_KEY = "test-key";
        (query as jest.Mock).mockImplementation(async (sql: string) => {
            if (sql.includes("WHERE p.id = $1") && sql.includes("p.gross_cents")) {
                return { rows: [payout] };
            }
            if (sql.includes("jsonb_agg")) {
                return { rows: [{
                    restaurant_id: "r", restaurant_name: "R",
                    payment_info: "pix@example.com", payment_info_type: "EMAIL",
                    payments: [{ id: "order-1", payment_ref: "123", total_cents: 5000 }],
                }] };
            }
            return { rows: [] };
        });
    });
    afterAll(() => {
        if (originalAsaasKey === undefined) delete process.env.ASAAS_API_KEY;
        else process.env.ASAAS_API_KEY = originalAsaasKey;
    });
    it("blocks retry when Mercado Pago has refunded the original charge", async () => {
        (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({
            id: "123", externalReference: "order-1", status: "refunded",
            paymentMethodId: "pix", amount: 50, feeCents: 50,
        });
        await expect(retryFailedPayout("payout-id")).rejects.toMatchObject({
            status: 409,
            details: { validationErrors: [expect.objectContaining({ orderId: "order-1" })] },
        });
        expect(getMercadoPagoPixPayment).toHaveBeenCalledWith({ id: "123" });
    });
    it("blocks retry if the original totals no longer match", async () => {
        (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({
            id: "123", externalReference: "order-1", status: "approved",
            paymentMethodId: "pix", amount: 50, feeCents: 10,
        });
        await expect(retryFailedPayout("payout-id")).rejects.toMatchObject({
            status: 409, message: expect.stringContaining("valores mudaram"),
        });
        expect(getMercadoPagoPixPayment).toHaveBeenCalledWith({ id: "123" });
    });
});
