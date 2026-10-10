import { createECDH, generateKeyPairSync, randomBytes } from "node:crypto";
import { query, withTransaction } from "@/lib/database/sql";
import { acknowledgePushNotification, notifyOrderReady, recoverRecentOrderPushes, sendOwnerPush, sendTestPush, takeNextPushNotification, takePendingPushNotifications } from "../server";
jest.mock("@/lib/database/sql", () => ({ query: jest.fn(), withTransaction: jest.fn() }));
jest.mock("node:timers/promises", () => ({ setTimeout: jest.fn().mockResolvedValue(undefined) }));
const ece = require("http_ece");
const browser = createECDH("prime256v1");
browser.generateKeys();
const auth = randomBytes(16);
const vapid = generateKeyPairSync("ec", { namedCurve: "prime256v1" });
const jwk = vapid.publicKey.export({ format: "jwk" });
const subscription = { id: "subscription-a", endpoint: "https://fcm.googleapis.com/send/test", p256dh: browser.getPublicKey().toString("base64url"), auth_secret: auth.toString("base64url") };
const notificationId = "10000000-0000-4000-8000-000000000001";
const payload = { title: "Novo pedido", body: "Cliente fez um pedido.", url: "/painel/pedidos", tag: "order-test" };
const order = { id: "order-test", restaurant_id: "restaurant-test", customer_name: "Ana", total_cents: 1000, status: "paid" };
let client: {
    query: jest.Mock;
}, committed: boolean, eventExists: boolean, pending: any[], fetchMock: jest.Mock, leases: Map<string, number>;
beforeEach(() => {
    eventExists = false;
    pending = [];
    committed = false;
    leases = new Map();
    process.env.VAPID_PRIVATE_KEY = String(vapid.privateKey.export({ format: "pem", type: "pkcs8" }));
    process.env.VAPID_PUBLIC_KEY = Buffer.concat([Buffer.from([4]), Buffer.from(jwk.x!, "base64url"), Buffer.from(jwk.y!, "base64url")]).toString("base64url");
    client = { query: jest.fn(async (sql: string, params: any[]) => {
            if (sql.includes("FROM orders"))
                return { rows: [order], rowCount: 1 };
            if (sql.includes("INSERT INTO owner_push_order_events")) {
                const existed = eventExists;
                eventExists = true;
                return { rows: existed ? [] : [{ order_id: order.id }], rowCount: existed ? 0 : 1 };
            }
            if (sql.includes("SELECT id, endpoint"))
                return { rows: [subscription], rowCount: 1 };
            if (sql.includes("SELECT id FROM owner_push_subscriptions"))
                return { rows: [{ id: subscription.id }], rowCount: 1 };
            if (sql.includes("INSERT INTO owner_push_notifications")) {
                const n = { id: notificationId, title: params[1], body: params[2], url: params[3], tag: params[4], created_at: new Date() };
                pending.push(n);
                return { rows: [n], rowCount: 1 };
            }
            if (sql.includes("UPDATE owner_push_notifications")) {
                const rows = pending;
                pending = [];
                return { rows, rowCount: rows.length };
            }
            if (sql.includes("SELECT id, title")) {
                const rows = pending.filter(n => !n.sent_at || Date.now() - new Date(n.sent_at).getTime() > 45000);
                return { rows, rowCount: rows.length };
            }
            return { rows: [], rowCount: 0 };
        }) };
    (withTransaction as jest.Mock).mockImplementation(async (callback) => {
        const oldEvent = eventExists, oldPending = [...pending];
        try {
            const result = await callback(client);
            committed = true;
            return result;
        }
        catch (error) {
            eventExists = oldEvent;
            pending = oldPending;
            throw error;
        }
    });
    (query as jest.Mock).mockImplementation(async (sql: string, params: any[]) => {
        if (sql.includes("SET last_attempt_at")) {
            const last = leases.get(params[0]), sent = pending.find(n => n.id === params[0])?.sent_at;
            if ((sent && Date.now() - new Date(sent).getTime() < 45000) || (last !== undefined && Date.now() - last < 45000))
                return { rows: [], rowCount: 0 };
            leases.set(params[0], Date.now());
        }
        if (sql.includes("SET sent_at")) {
            const n = pending.find(n => n.id === params[0]);
            if (n)
                n.sent_at = new Date();
        }
        return { rows: [], rowCount: 1 };
    });
    fetchMock = jest.fn(async () => { expect(committed).toBe(true); return new Response(null, { status: 201 }); });
    global.fetch = fetchMock;
    jest.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => jest.restoreAllMocks());
function decode(request: any) { return JSON.parse(ece.decrypt(request.body, { version: "aes128gcm", privateKey: browser, authSecret: auth }).toString()); }
test("sends decryptable aes128gcm payload using existing PKCS8 keys only after committing", async () => {
    expect(await sendOwnerPush("restaurant-test", payload)).toEqual({ attempted: 1, sent: 1 });
    const request = fetchMock.mock.calls[0][1];
    expect(request.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(Number(request.headers.TTL)).toBeGreaterThan(0);
    expect(Number(request.headers.TTL)).toBeLessThanOrEqual(300);
    expect(request.headers.Topic).toBe(notificationId.replace(/-/g, ""));
    const decoded = decode(request);
    expect(decoded).toMatchObject({ ...payload, id: notificationId });
    expect(decoded.expiresAt - new Date(decoded.created_at).getTime()).toBe(300000);
    expect(pending).toHaveLength(1);
});
test.each([429, 500, 503])("retries transient HTTP %i with the same identity", async (status) => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status })).mockResolvedValueOnce(new Response(null, { status: 201 }));
    expect((await sendOwnerPush("restaurant-test", payload)).sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(decode(fetchMock.mock.calls[0][1])).toEqual(decode(fetchMock.mock.calls[1][1]));
});
test("retries network failures once", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("Network down"));
    expect((await sendOwnerPush("restaurant-test", payload)).sent).toBe(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
});
test.each([404, 410])("removes expired HTTP %i subscriptions", async (status) => {
    fetchMock.mockResolvedValue(new Response(null, { status }));
    expect((await sendOwnerPush("restaurant-test", payload)).sent).toBe(0);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("DELETE FROM owner_push_subscriptions"), [subscription.id]);
});
test("one broken device cannot block another", async () => {
    const original = client.query.getMockImplementation()!;
    client.query.mockImplementation((sql, params) => sql.includes("SELECT id, endpoint") ? { rows: [subscription, { ...subscription, id: "bad", p256dh: "invalid" }] } : original(sql, params));
    expect(await sendOwnerPush("restaurant-test", payload)).toEqual({ attempted: 2, sent: 1 });
});
test("queue failure rolls back the event and permits another attempt", async () => {
    const original = client.query.getMockImplementation()!;
    client.query.mockImplementation((sql, params) => { if (sql.includes("INSERT INTO owner_push_notifications"))
        throw new Error("database unavailable"); return original(sql, params); });
    await expect(notifyOrderReady(order.id)).rejects.toThrow("database unavailable");
    expect(eventExists).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    client.query.mockImplementation(original);
    await expect(notifyOrderReady(order.id)).resolves.toBe(true);
    expect(pending).toHaveLength(1);
});
test("repeated requests do not resend accepted pushes during cooldown", async () => {
    await notifyOrderReady(order.id);
    await notifyOrderReady(order.id);
    expect(pending).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
});
test("legacy wakes drain bursts and return newest first", async () => {
    pending = [{ ...payload, id: "older", created_at: new Date(Date.now() - 1000) }, { ...payload, id: "newer", created_at: new Date() }];
    expect((await takePendingPushNotifications("device")).map(n => n.id)).toEqual(["newer", "older"]);
    expect(pending).toHaveLength(0);
    await expect(takeNextPushNotification("device")).resolves.toBeNull();
});
test("legacy devices receive a summary of multiple fresh orders", async () => {
    pending = [1, 2, 3].map(id => ({ ...payload, id: String(id), created_at: new Date() }));
    expect(await takeNextPushNotification("device")).toMatchObject({ title: "3 novos pedidos no iMenu 🔔" });
    expect(pending).toHaveLength(0);
});
test("acknowledgements are idempotent and device scoped", async () => {
    await acknowledgePushNotification("device", notificationId);
    expect(query).toHaveBeenCalledWith(expect.stringContaining("s.device_token = $1"), ["device", notificationId]);
    expect((query as jest.Mock).mock.calls[0][0]).toContain("COALESCE(n.delivered_at, NOW())");
});
test("test push reports expired subscriptions as unsuccessful", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 410 }));
    expect(await sendTestPush({ restaurantId: "r", userId: "u", deviceToken: "d" })).toBe(false);
});
test("scheduled recovery reuses a failed order queue", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await notifyOrderReady(order.id);
    leases.set(notificationId, Date.now() - 46000);
    (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: order.id }], rowCount: 1 });
    expect(await recoverRecentOrderPushes()).toEqual({ attempted: 1, failed: 0 });
    expect(pending).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
});
test("concurrent dispatch cooldown prevents duplicate sends", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    await notifyOrderReady(order.id);
    await notifyOrderReady(order.id);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(pending[0].sent_at).toBeUndefined();
});
test("unacknowledged accepted push remains recoverable without extending expiry", async () => {
    await notifyOrderReady(order.id);
    pending[0].sent_at = new Date(Date.now() - 46000);
    leases.set(notificationId, Date.now() - 46000);
    (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: order.id }], rowCount: 1 });
    expect(await recoverRecentOrderPushes()).toEqual({ attempted: 1, failed: 0 });
    expect(pending).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const messages = fetchMock.mock.calls.map(([, r]) => decode(r));
    expect(messages[0].id).toBe(messages[1].id);
    expect(messages[0].expiresAt).toBe(messages[1].expiresAt);
});
test("scheduled recovery retries handoff alerts without recreating the queue", async () => {
    fetchMock.mockResolvedValueOnce(new Response(null, { status: 503 })).mockResolvedValueOnce(new Response(null, { status: 503 }));
    await sendOwnerPush("restaurant-test", { ...payload, tag: "whatsapp-handoff-test" });
    leases.set(notificationId, Date.now() - 46000);
    (query as jest.Mock).mockResolvedValueOnce({ rows: [], rowCount: 0 }).mockResolvedValueOnce({ rows: [{ ...pending[0], subscription_id: subscription.id, endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth_secret: subscription.auth_secret }], rowCount: 1 });
    expect(await recoverRecentOrderPushes()).toEqual({ attempted: 1, failed: 0 });
    expect(pending).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(3);
});
test("recovery reports provider failures", async () => {
    fetchMock.mockResolvedValue(new Response(null, { status: 503 }));
    (query as jest.Mock).mockResolvedValueOnce({ rows: [{ id: order.id }], rowCount: 1 });
    expect(await recoverRecentOrderPushes()).toEqual({ attempted: 1, failed: 1 });
    expect(pending[0].sent_at).toBeUndefined();
});
