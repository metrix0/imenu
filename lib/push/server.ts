import { createPrivateKey } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import webpush from "web-push";
import { query, withTransaction } from "@/lib/database/sql";

const PUSH_TTL_SECONDS = 5 * 60;
type PushPayload = {
    title: string;
    body: string;
    url: string;
    tag?: string | null;
};
type PushSubscriptionRow = { id: string; endpoint: string; p256dh: string; auth_secret: string };
type OrderNotificationRow = {
    id: string;
    restaurant_id: string;
    customer_name: string | null;
    total_cents: number | null;
    status: string;
};
type PendingNotificationRow = { id: string; title: string; body: string; url: string; tag: string | null; created_at: Date | string };
type QueuedPush = { subscription: PushSubscriptionRow; notification: PendingNotificationRow };

function getRequiredEnv(name: string): string {
    const value = process.env[name]?.trim();
    if (!value) {
        throw new Error(`Missing required environment variable: ${name}`);
    }
    return value;
}
export function getVapidPublicKey(): string {
    return getRequiredEnv("VAPID_PUBLIC_KEY");
}
function getVapidPrivateKey(): string {
    // Preserve the existing PKCS8 environment variable; web-push expects its scalar.
    const key = createPrivateKey(getRequiredEnv("VAPID_PRIVATE_KEY").replace(/\\n/g, "\n"));
    const jwk = key.export({ format: "jwk" });
    if (jwk.crv !== "P-256" || !jwk.d) throw new Error("Invalid VAPID private key");
    return jwk.d;
}
function getVapidSubject(): string {
    return process.env.VAPID_SUBJECT?.trim() || "mailto:suporte@imenuapp.com.br";
}
async function deleteExpiredSubscription(subscriptionId: string): Promise<void> {
    await query(
        `DELETE FROM owner_push_subscriptions WHERE id = $1`,
        [subscriptionId]
    );
}
async function wakeSubscription({ subscription, notification }: QueuedPush): Promise<boolean> {
    const expiresAt = new Date(notification.created_at).getTime() + PUSH_TTL_SECONDS * 1000;
    // Lease across concurrent requests and recovery jobs, until the display is acknowledged.
    const claimed = await query(`
        UPDATE owner_push_notifications SET last_attempt_at = NOW()
        WHERE id = $1 AND delivered_at IS NULL
          AND (sent_at IS NULL OR sent_at < NOW() - INTERVAL '45 seconds')
          AND created_at >= NOW() - INTERVAL '5 minutes'
          AND (last_attempt_at IS NULL OR last_attempt_at < NOW() - INTERVAL '45 seconds')
        RETURNING id
    `, [notification.id]);
    if (!claimed.rowCount) return false;
    for (let attempt = 0; attempt < 2; attempt += 1) {
        const ttl = Math.floor((expiresAt - Date.now()) / 1000);
        if (ttl <= 0) return false;
        const details = webpush.generateRequestDetails({
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth_secret },
        }, JSON.stringify({ ...notification, expiresAt }), {
            TTL: ttl, urgency: "high", contentEncoding: "aes128gcm", topic: notification.id.replace(/-/g, ""),
            vapidDetails: { subject: getVapidSubject(), publicKey: getVapidPublicKey(), privateKey: getVapidPrivateKey() },
        });
        let response: Response;
        try {
            response = await fetch(details.endpoint, {
                method: "POST", headers: details.headers, body: details.body as BodyInit,
                cache: "no-store", signal: AbortSignal.timeout(15_000),
            });
        } catch (error) {
            if (attempt === 1) throw error;
            await delay(250);
            continue;
        }
        if (response.status === 404 || response.status === 410) {
            await deleteExpiredSubscription(subscription.id);
            return false;
        }
        if (response.ok) {
            await query("UPDATE owner_push_notifications SET sent_at = NOW() WHERE id = $1", [notification.id]);
            return true;
        }
        if (attempt === 0 && (response.status === 429 || response.status >= 500)) {
            const retryAfter = Number(response.headers.get("Retry-After"));
            await response.body?.cancel();
            await delay(Math.min(Math.max(retryAfter * 1000 || 250, 250), 1000));
            continue;
        }
        throw new Error(`Push service returned HTTP ${response.status}`);
    }
    return false;
}
async function dispatchNotifications(queued: QueuedPush[]) {
    const results = await Promise.allSettled(queued.map(wakeSubscription));
    results.forEach((result, index) => {
        if (result.status === "rejected") console.error("[OWNER_PUSH] Failed to send notification:", queued[index].subscription.id, result.reason);
    });
    return { attempted: queued.length, sent: results.filter(r => r.status === "fulfilled" && r.value).length };
}
async function queueNotification(
    client: Parameters<Parameters<typeof withTransaction>[0]>[0], subscription: PushSubscriptionRow, payload: PushPayload
): Promise<QueuedPush> {
    const result = await client.query<PendingNotificationRow>(`
        INSERT INTO owner_push_notifications (subscription_id, title, body, url, tag)
        VALUES ($1, $2, $3, $4, $5) RETURNING id, title, body, url, tag, created_at
    `, [subscription.id, payload.title, payload.body, payload.url, payload.tag ?? null]);
    return { subscription, notification: result.rows[0] };
}
export async function sendOwnerPush(restaurantId: string, payload: PushPayload): Promise<{ attempted: number; sent: number }> {
    const queued = await withTransaction(async client => {
        const subscriptions = await client.query<PushSubscriptionRow>(`
            SELECT id, endpoint, p256dh, auth_secret FROM owner_push_subscriptions
            WHERE restaurant_id = $1 AND enabled = true
        `, [restaurantId]);
        const notifications: QueuedPush[] = [];
        for (const subscription of subscriptions.rows) notifications.push(await queueNotification(client, subscription, payload));
        return notifications;
    });
    return dispatchNotifications(queued);
}
export async function sendTestPush({ restaurantId, userId, deviceToken }: {
    restaurantId: string; userId: string; deviceToken: string;
}): Promise<boolean> {
    const queued = await withTransaction(async client => {
        const result = await client.query<PushSubscriptionRow>(`
            SELECT id, endpoint, p256dh, auth_secret FROM owner_push_subscriptions
            WHERE restaurant_id = $1 AND user_id = $2 AND device_token = $3 AND enabled = true LIMIT 1
        `, [restaurantId, userId, deviceToken]);
        const subscription = result.rows[0];
        if (!subscription) return [];
        return [await queueNotification(client, subscription, {
            title: "Notificações ativadas ✅", body: "Este aparelho receberá os avisos importantes do seu restaurante.",
            url: "/painel/aplicativo", tag: "imenu-push-test",
        })];
    });
    return (await dispatchNotifications(queued)).sent > 0;
}
export async function takePendingPushNotifications(deviceToken: string): Promise<PendingNotificationRow[]> {
    return withTransaction(async client => {
        const subscription = await client.query<{ id: string }>(`
            SELECT id FROM owner_push_subscriptions WHERE device_token = $1 AND enabled = true FOR UPDATE
        `, [deviceToken]);
        const subscriptionId = subscription.rows[0]?.id;
        if (!subscriptionId) return [];
        await client.query(`
            DELETE FROM owner_push_notifications n
            WHERE n.subscription_id = $1 AND n.delivered_at IS NULL
              AND (n.created_at < NOW() - INTERVAL '5 minutes'
                   OR EXISTS (SELECT 1 FROM orders o WHERE n.tag = 'order-' || o.id::text AND o.status IN ('done', 'canceled')))
        `, [subscriptionId]);
        const result = await client.query<PendingNotificationRow>(`
            UPDATE owner_push_notifications SET delivered_at = NOW()
            WHERE subscription_id = $1 AND delivered_at IS NULL AND created_at >= NOW() - INTERVAL '5 minutes'
            RETURNING id, title, body, url, tag, created_at
        `, [subscriptionId]);
        return result.rows.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    });
}
export async function takeNextPushNotification(deviceToken: string): Promise<PushPayload | null> {
    const notifications = await takePendingPushNotifications(deviceToken);
    if (!notifications.length) return null;
    if (notifications.length === 1) return notifications[0];
    const orders = notifications.filter(n => n.tag?.startsWith("order-"));
    if (!orders.length) return notifications[0];
    return {
        title: `${orders.length} ${orders.length === 1 ? "novo pedido" : "novos pedidos"} no iMenu 🔔`,
        body: "Abra o painel para conferir os pedidos recebidos nos últimos 5 minutos.",
        url: "/painel/pedidos", tag: `imenu-orders-${orders[0].id}`,
    };
}
export async function acknowledgePushNotification(deviceToken: string, notificationId: string): Promise<void> {
    await query(`
        UPDATE owner_push_notifications n SET delivered_at = COALESCE(n.delivered_at, NOW())
        FROM owner_push_subscriptions s
        WHERE n.id = $2 AND n.subscription_id = s.id AND s.device_token = $1 AND s.enabled = true
    `, [deviceToken, notificationId]);
}
function formatMoney(cents: number | null): string {
    return ((Number(cents) || 0) / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}
export async function notifyOrderReady(orderId: string): Promise<boolean> {
    const queued = await withTransaction(async client => {
        const result = await client.query<OrderNotificationRow>(`
            SELECT id, restaurant_id, customer_name, total_cents, status FROM orders
            WHERE id = $1 AND status IN ('paid', 'pending_physical_payment', 'preparing', 'delivering')
              AND (created_at >= NOW() - INTERVAL '5 minutes' OR payment_paid_at >= NOW() - INTERVAL '5 minutes')
            FOR UPDATE
        `, [orderId]);
        const order = result.rows[0];
        if (!order) return null;
        // Event and queue entries commit together, so failures can retry.
        const event = await client.query<{ order_id: string }>(`
            INSERT INTO owner_push_order_events (order_id, restaurant_id) VALUES ($1, $2)
            ON CONFLICT (order_id) DO NOTHING RETURNING order_id
        `, [order.id, order.restaurant_id]);
        const subscriptions = await client.query<PushSubscriptionRow>(`
            SELECT id, endpoint, p256dh, auth_secret FROM owner_push_subscriptions WHERE restaurant_id = $1 AND enabled = true
        `, [order.restaurant_id]);
        const customer = order.customer_name?.trim();
        const payload = {
            title: "Novo pedido no iMenu 🔔",
            body: customer ? `${customer} fez um pedido de ${formatMoney(order.total_cents)}.` : `Novo pedido de ${formatMoney(order.total_cents)} recebido.`,
            url: "/painel/pedidos", tag: `order-${order.id}`,
        };
        const notifications: QueuedPush[] = [];
        for (const subscription of subscriptions.rows) {
            if (event.rowCount === 0) {
                const pending = await client.query<PendingNotificationRow>(`
                    SELECT id, title, body, url, tag, created_at FROM owner_push_notifications
                    WHERE subscription_id = $1 AND tag = $2 AND delivered_at IS NULL
                      AND (sent_at IS NULL OR sent_at < NOW() - INTERVAL '45 seconds')
                      AND created_at >= NOW() - INTERVAL '5 minutes'
                `, [subscription.id, payload.tag]);
                for (const notification of pending.rows) notifications.push({ subscription, notification });
            } else notifications.push(await queueNotification(client, subscription, payload));
        }
        return notifications;
    });
    if (!queued) return false;
    const result = await dispatchNotifications(queued);
    return result.sent === result.attempted;
}
export async function recoverRecentOrderPushes(): Promise<{ attempted: number; failed: number }> {
    const orders = await query<{ id: string }>(`
        SELECT o.id FROM orders o
        WHERE o.status IN ('paid', 'pending_physical_payment', 'preparing', 'delivering')
          AND (o.created_at >= NOW() - INTERVAL '5 minutes' OR o.payment_paid_at >= NOW() - INTERVAL '5 minutes')
          AND EXISTS (SELECT 1 FROM owner_push_subscriptions s WHERE s.restaurant_id = o.restaurant_id AND s.enabled = true)
          AND (
            NOT EXISTS (SELECT 1 FROM owner_push_order_events e WHERE e.order_id = o.id)
            OR EXISTS (
                SELECT 1 FROM owner_push_notifications n JOIN owner_push_subscriptions s ON s.id = n.subscription_id
                WHERE s.restaurant_id = o.restaurant_id AND s.enabled = true AND n.tag = 'order-' || o.id::text
                  AND n.delivered_at IS NULL AND (n.sent_at IS NULL OR n.sent_at < NOW() - INTERVAL '45 seconds')
                  AND n.created_at >= NOW() - INTERVAL '5 minutes'
                  AND (n.last_attempt_at IS NULL OR n.last_attempt_at < NOW() - INTERVAL '45 seconds')
            )
          )
        ORDER BY (NOT EXISTS (SELECT 1 FROM owner_push_order_events e WHERE e.order_id = o.id)) DESC, o.created_at DESC
        LIMIT 100
    `);
    let attempted = 0;
    let failed = 0;
    const deadline = Date.now() + 45_000;
    for (let offset = 0; offset < orders.rows.length && Date.now() < deadline; offset += 10) {
        const results = await Promise.allSettled(orders.rows.slice(offset, offset + 10).map(order => notifyOrderReady(order.id)));
        attempted += results.length;
        for (const result of results) {
            if (result.status === "rejected") {
                failed += 1;
                console.error("[OWNER_PUSH] Recovery failed:", result.reason);
            } else if (!result.value) failed += 1;
        }
    }
    // Handoff and test alerts use the same queue and need recovery too.
    const otherNotifications = await query<PendingNotificationRow & { subscription_id: string; endpoint: string; p256dh: string; auth_secret: string }>(`
        SELECT n.id, n.title, n.body, n.url, n.tag, n.created_at,
               s.id AS subscription_id, s.endpoint, s.p256dh, s.auth_secret
        FROM owner_push_notifications n JOIN owner_push_subscriptions s ON s.id = n.subscription_id
        WHERE s.enabled = true AND n.delivered_at IS NULL
          AND (n.sent_at IS NULL OR n.sent_at < NOW() - INTERVAL '45 seconds')
          AND n.created_at >= NOW() - INTERVAL '5 minutes'
          AND (n.last_attempt_at IS NULL OR n.last_attempt_at < NOW() - INTERVAL '45 seconds')
          AND (n.tag IS NULL OR n.tag NOT LIKE 'order-%')
        ORDER BY n.created_at DESC LIMIT 100
    `);
    for (let offset = 0; offset < otherNotifications.rows.length && Date.now() < deadline; offset += 10) {
        const queued = otherNotifications.rows.slice(offset, offset + 10).map(row => ({
            subscription: { id: row.subscription_id, endpoint: row.endpoint, p256dh: row.p256dh, auth_secret: row.auth_secret },
            notification: { id: row.id, title: row.title, body: row.body, url: row.url, tag: row.tag, created_at: row.created_at },
        }));
        const result = await dispatchNotifications(queued);
        attempted += result.attempted;
        failed += result.attempted - result.sent;
    }
    return { attempted, failed };
}
