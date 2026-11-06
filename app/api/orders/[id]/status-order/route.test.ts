import { PATCH } from "./route";
import { withTransaction } from "@/lib/database/sql";
import { notifyOrderStatusUpdate } from "@/lib/services/whatsappNotification";

jest.mock("@/lib/database/sql", () => ({ withTransaction: jest.fn() }));
jest.mock("@/lib/services/whatsappNotification", () => ({ notifyOrderStatusUpdate: jest.fn() }));
jest.mock("@/lib/payments/payzu", () => ({
    isPayZuPaymentRef: jest.fn(),
    refundPayZuPixCharge: jest.fn(),
}));

beforeEach(() => jest.clearAllMocks());

it("does not let an unpaid online PIX order be marked completed", async () => {
    const client = { query: jest.fn().mockResolvedValueOnce({ rows: [{
        id: "order", status: "pending_online_payment", payment_method: "pix",
        payment_ref: "123", restaurant_id: "restaurant",
    }] }) };
    (withTransaction as jest.Mock).mockImplementation(async callback => callback(client));
    const response = await PATCH(
        new Request("http://localhost/api/orders/order/status-order", {
            method: "PATCH", body: JSON.stringify({ status: "done" }),
        }),
        { params: Promise.resolve({ id: "order" }) }
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ error: "Pagamento PIX ainda não confirmado." });
    expect(client.query).toHaveBeenCalledTimes(1);
    expect(notifyOrderStatusUpdate).not.toHaveBeenCalled();
});
