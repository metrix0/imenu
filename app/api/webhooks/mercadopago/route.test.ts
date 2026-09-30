import { POST } from "./route";
import { query, withTransaction } from "@/lib/database/sql";
import { getMercadoPagoPixPayment } from "@/lib/mercadoPagoPix";
import { activateMercadoPagoQrTablePrepaid } from "@/lib/qr-table/mercadoPagoBilling";
import { notifyOrderReady } from "@/lib/push/server";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("@/lib/mercadoPagoPix", () => ({ getMercadoPagoPixPayment: jest.fn(), isMercadoPagoPixFailureStatus: jest.fn() }));
jest.mock("@/lib/qr-table/mercadoPagoBilling", () => ({ activateMercadoPagoQrTablePrepaid: jest.fn(), saveMercadoPagoQrTablePayment: jest.fn(), markMercadoPagoQrTablePaymentFailure: jest.fn() }));
jest.mock("@/lib/database/supabaseServerClient", () => ({ createSupabaseServerClient: jest.fn() }));
jest.mock("@/lib/push/server", () => ({ notifyOrderReady: jest.fn() }));
const id = "10000000-0000-4000-8000-000000000001";
const payment = { id: "123", amount: 20, status: "approved", paymentMethodId: "pix", externalReference: id, paidAt: "2026-09-30T12:00:00Z" };
const order = { id, status: "pending_online_payment", total_cents: 2000, payment_ref: "123", payment_method: "pix", restaurant_id: "restaurant1" };
const send = () => POST(new Request("https://example.com/api/webhooks/mercadopago", { method: "POST", body: JSON.stringify({ type: "payment", data: { id: "123" } }) }));
beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(console, "error").mockImplementation(() => undefined);
    (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue(payment);
    (query as jest.Mock).mockResolvedValue({ rows: [order] });
});
afterEach(() => jest.restoreAllMocks());
it.each([{ amount: 21 }, { id: "other" }, { paymentMethodId: "card" }])("ignores unverified payment details %j", async change => {
    (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({ ...payment, ...change });
    expect((await send()).status).toBe(200);
    expect(withTransaction).not.toHaveBeenCalled();
});
it("retries lookup failures instead of acknowledging them", async () => {
    (getMercadoPagoPixPayment as jest.Mock).mockRejectedValue(new Error("offline"));
    expect((await send()).status).toBe(500);
});
it("confirms order and print job in one transaction before notifying", async () => {
    const sql = jest.fn()
        .mockResolvedValueOnce({ rows: [order], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id }], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [{ id: "print1" }], rowCount: 1 });
    (withTransaction as jest.Mock).mockImplementation(callback => callback({ query: sql }));
    expect((await send()).status).toBe(200);
    expect(sql.mock.calls[0][0]).toContain("FOR UPDATE");
    expect(sql.mock.calls[2][0]).toContain("INSERT INTO public.print_jobs");
    expect(notifyOrderReady).toHaveBeenCalledWith(id);
});
it("does not resend the owner notification for an already processed approved webhook", async () => {
    const paidOrder = { ...order, status: "paid" };
    const sql = jest.fn()
        .mockResolvedValueOnce({ rows: [paidOrder], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 })
        .mockResolvedValueOnce({ rows: [], rowCount: 0 });
    (withTransaction as jest.Mock).mockImplementation(callback => callback({ query: sql }));
    expect((await send()).status).toBe(200);
    expect(notifyOrderReady).not.toHaveBeenCalled();
});
it("returns retryable failure if transactional print enqueue fails", async () => {
    (withTransaction as jest.Mock).mockRejectedValue(new Error("print insert failed"));
    expect((await send()).status).toBe(500);
    expect(notifyOrderReady).not.toHaveBeenCalled();
});
it("activates QR Mesa without prematurely marking it approved", async () => {
    (getMercadoPagoPixPayment as jest.Mock).mockResolvedValue({ ...payment, amount: 5, externalReference: `qr-table:${id}:renewal` });
    (query as jest.Mock).mockResolvedValue({ rows: [{ id, payment_provider: "mercadopago", mercadopago_order_id: "123" }] });
    expect((await send()).status).toBe(200);
    expect(activateMercadoPagoQrTablePrepaid).toHaveBeenCalledWith(expect.objectContaining({ addonId: id, paymentId: "123" }));
    expect(query).toHaveBeenCalledTimes(1);
});
