import { query } from "@/lib/database/sql";
import { acknowledgeOwnerPush, notifyOrderReady, retryUnacknowledgedOwnerPush, sendTestPush, takeNextPushNotification } from "../server";
import { importPKCS8, SignJWT } from "jose";
import { withTransaction } from "@/lib/database/sql";

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


describe("push delivery retries and expiry", () => {
    const originalFetch = globalThis.fetch;
    const originalPublicKey = process.env.VAPID_PUBLIC_KEY;
    const originalPrivateKey = process.env.VAPID_PRIVATE_KEY;

    beforeEach(() => {
        jest.useFakeTimers();
        (query as jest.Mock).mockReset();
        (withTransaction as jest.Mock).mockReset();
        process.env.VAPID_PUBLIC_KEY = "test-public-key";
        process.env.VAPID_PRIVATE_KEY = "test-private-key";
        (importPKCS8 as jest.Mock).mockResolvedValue("test-key");
        (SignJWT as jest.Mock).mockImplementation(() => {
            const jwt = {
                setProtectedHeader: () => jwt,
                setAudience: () => jwt,
                setSubject: () => jwt,
                setExpirationTime: () => jwt,
                sign: async () => "test-token",
            };
            return jwt;
        });
    });

    afterEach(() => {
        globalThis.fetch = originalFetch;
        jest.useRealTimers();
        if (originalPublicKey === undefined) delete process.env.VAPID_PUBLIC_KEY;
        else process.env.VAPID_PUBLIC_KEY = originalPublicKey;
        if (originalPrivateKey === undefined) delete process.env.VAPID_PRIVATE_KEY;
        else process.env.VAPID_PRIVATE_KEY = originalPrivateKey;
    });

    async function sendSamplePush(): Promise<{ value?: boolean; error?: Error }> {
        (query as jest.Mock)
            .mockResolvedValueOnce({
                rows: [{ id: "subscription-1", endpoint: "https://example.org/push" }],
            })
            .mockResolvedValueOnce({ rowCount: 1 });

        const delivery = sendTestPush({
            restaurantId, userId: "test-user", deviceToken: "test-device",
        }).then(value => ({ value }), error => ({ error }));

        await jest.runAllTimersAsync();
        return delivery;
    }

    test("retries temporary HTTP failures and sets 10-minute push TTL", async () => {
        const mockFetch = jest.fn()
            .mockResolvedValueOnce({ ok: false, status: 503, text: async () => "" })
            .mockResolvedValueOnce({ ok: true, status: 201 });
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const result = await sendSamplePush();
        expect(result.value).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(2);
        expect(mockFetch.mock.calls[0][1].headers.TTL).toBe("600");
    });

    test("retries at most twice on transient failures", async () => {
        const mockFetch = jest.fn()
            .mockRejectedValueOnce(new TypeError("Network failure"))
            .mockResolvedValueOnce({ ok: false, status: 429, text: async () => "" })
            .mockResolvedValueOnce({ ok: true, status: 201 });
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const result = await sendSamplePush();
        expect(result.value).toBe(true);
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test("stops after three unsuccessful requests", async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: false, status: 503, text: async () => "",
        });
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const result = await sendSamplePush();
        expect(result.error?.message).toContain("HTTP 503");
        expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    test("does not retry permanent HTTP failures", async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: false, status: 403, text: async () => "",
        });
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const result = await sendSamplePush();
        expect(result.error?.message).toContain("HTTP 403");
        expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    test("removes invalid subscriptions without retrying", async () => {
        const mockFetch = jest.fn().mockResolvedValue({
            ok: false, status: 410, text: async () => "",
        });
        globalThis.fetch = mockFetch as unknown as typeof fetch;

        const result = await sendSamplePush();
        expect(result.value).toBe(false);
        expect(mockFetch).toHaveBeenCalledTimes(1);
        expect((query as jest.Mock).mock.calls[2][0]).toContain("DELETE FROM owner_push_subscriptions");
    });

    test("uses 10 minutes for the pending queue", async () => {
        const client = { query: jest.fn().mockResolvedValue({ rows: [] }) };
        (withTransaction as jest.Mock).mockImplementation(async callback => callback(client));

        expect(await takeNextPushNotification("test-device")).toBeNull();
        expect(client.query).toHaveBeenCalledTimes(2);
        expect(client.query.mock.calls[0][1]).toEqual(["test-device", 600]);
        expect(client.query.mock.calls[1][1]).toEqual(["test-device", 600]);
    });
});

describe("push acknowledgment and scheduled retry claims", () => {
    beforeEach(() => (query as jest.Mock).mockReset());

    test("acknowledges only the device owning the notification", async () => {
        const notificationId = "10000000-0000-4000-8000-000000000001";
        (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: notificationId }] });
        expect(await acknowledgeOwnerPush("device-token", notificationId)).toBe(true);
        expect(query).toHaveBeenCalledWith(
            expect.stringContaining("subscription.device_token = $2"),
            [notificationId, "device-token"]
        );
        expect((query as jest.Mock).mock.calls[0][0]).toContain(
            "SET delivered_at = COALESCE(notification.delivered_at, NOW())"
        );
    });

    test("does not acknowledge an unknown device or notification", async () => {
        (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
        expect(await acknowledgeOwnerPush("other-device", "unknown-id")).toBe(false);
    });

    test("claims only due, unacknowledged pushes with bounded backoff", async () => {
        (query as jest.Mock).mockResolvedValueOnce({ rows: [] });
        expect(await retryUnacknowledgedOwnerPush()).toEqual({
            claimed: 0, accepted: 0, failed: 0,
        });
        const sql = (query as jest.Mock).mock.calls[0][0];
        expect(sql).toContain("notification.delivered_at IS NULL");
        expect(sql).toContain("notification.attempt_count BETWEEN 1 AND 3");
        expect(sql).toContain("INTERVAL '30 seconds'");
        expect(sql).toContain("INTERVAL '90 seconds'");
        expect(sql).toContain("INTERVAL '180 seconds'");
        expect(sql).toContain("FOR UPDATE OF notification SKIP LOCKED");
        expect((query as jest.Mock).mock.calls[0][1]).toEqual([100]);
    });

    test("GET marks a notification as fetched, not acknowledged", async () => {
        const client = {
            query: jest.fn()
                .mockResolvedValueOnce({ rows: [] })
                .mockResolvedValueOnce({ rows: [{
                    id: "10000000-0000-4000-8000-000000000001",
                    title: "Novo pedido", body: "Pedido #1", url: "/painel",
                    created_at: new Date().toISOString(), expiresAt: Date.now() + 100000,
                }] })
                .mockResolvedValueOnce({ rows: [] }),
        };
        (withTransaction as jest.Mock).mockImplementation(async callback => callback(client));
        const result = await takeNextPushNotification("device-token");
        expect(result?.title).toBe("Novo pedido");
        expect(client.query.mock.calls[2][0]).toContain("SET sent_at = COALESCE(sent_at, NOW())");
        expect(client.query.mock.calls[2][0]).not.toContain("SET delivered_at");
    });
});
