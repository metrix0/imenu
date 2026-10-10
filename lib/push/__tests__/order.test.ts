import { query } from "@/lib/database/sql";
import { notifyOrderReady } from "../server";

jest.mock("jose", () => ({ importPKCS8: jest.fn(), SignJWT: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));

const orderId = "50000000-0000-4000-8000-000000000001";
const restaurantId = "30000000-0000-4000-8000-000000000001";

describe("order push eligibility", () => {
    beforeEach(() => (query as jest.Mock).mockReset());

    test.each(["done", "canceled", "pending_online_payment"])("does not notify for %s orders", async status => {
        (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: orderId, restaurant_id: restaurantId, status }] });
        expect(await notifyOrderReady(orderId)).toBe(false);
        // No event or notification is written for an ineligible order.
        expect(query).toHaveBeenCalledTimes(1);
    });

    test("a new offline order remains eligible", async () => {
        (query as jest.Mock)
            .mockResolvedValueOnce({ rows: [{ id: orderId, restaurant_id: restaurantId, status: "pending_physical_payment" }] })
            .mockResolvedValueOnce({ rows: [{ order_id: orderId }], rowCount: 1 })
            .mockResolvedValueOnce({ rows: [] });
        expect(await notifyOrderReady(orderId)).toBe(true);
        expect(query).toHaveBeenCalledTimes(3);
        expect((query as jest.Mock).mock.calls[1][0]).toContain("INSERT INTO owner_push_order_events");
    });

    test("an already-notified order does not send another push", async () => {
        (query as jest.Mock)
            .mockResolvedValueOnce({ rows: [{ id: orderId, restaurant_id: restaurantId, status: "pending_physical_payment" }] })
            .mockResolvedValueOnce({ rows: [], rowCount: 0 });
        expect(await notifyOrderReady(orderId)).toBe(true);
        expect(query).toHaveBeenCalledTimes(2);
    });
});
