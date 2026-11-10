import { importPKCS8, SignJWT } from "jose";

import { query, withTransaction } from "@/lib/database/sql";

const PUSH_TTL_SECONDS = 600;
const PUSH_RETRY_DELAYS_MS = [2000, 5000];
const PUSH_RETRY_BATCH_SIZE = 100;
const PUSH_RETRY_CONCURRENCY = 10;

type PushPayload = {
    title: string;
    body: string;
    url: string;
    tag?: string | null;
};

type PushSubscriptionRow = {
    id: string;
    endpoint: string;
};

type OrderNotificationRow = {
    id: string;
    restaurant_id: string;
    customer_name: string | null;
    total_cents: number | null;
    status: string;
};

type PendingNotificationRow = {
    id: string;
    title: string;
    body: string;
    url: string;
    tag: string | null;
    created_at: string;
    expiresAt: number;
};

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
    return getRequiredEnv("VAPID_PRIVATE_KEY").replace(/\\n/g, "\n");
}

function getVapidSubject(): string {
    return process.env.VAPID_SUBJECT?.trim() || "mailto:suporte@imenuapp.com.br";
}

async function createVapidAuthorization(endpoint: string): Promise<string> {
    const audience = new URL(endpoint).origin;
    const privateKey = await importPKCS8(getVapidPrivateKey(), "ES256");
    const token = await new SignJWT({})
        .setProtectedHeader({ alg: "ES256", typ: "JWT" })
        .setAudience(audience)
        .setSubject(getVapidSubject())
        .setExpirationTime(Math.floor(Date.now() / 1000) + 12 * 60 * 60)
        .sign(privateKey);

    return `vapid t=${token}, k=${getVapidPublicKey()}`;
}

async function deleteExpiredSubscription(subscriptionId: string): Promise<void> {
    await query(
        `DELETE FROM owner_push_subscriptions WHERE id = $1`,
        [subscriptionId]
    );
}


async function wakeSubscription(subscription: PushSubscriptionRow): Promise<boolean> {
    const authorization = await createVapidAuthorization(subscription.endpoint);

    for (let attempt = 0; attempt <= PUSH_RETRY_DELAYS_MS.length; attempt++) {
        let response: Response;
        try {
            response = await fetch(subscription.endpoint, {
                method: "POST",
                headers: {
                    Authorization: authorization,
                    "Crypto-Key": "p256ecdsa=" + getVapidPublicKey(),
                    TTL: String(PUSH_TTL_SECONDS),
                    Urgency: "high",
                },
                body: null,
                cache: "no-store",
                signal: AbortSignal.timeout(15_000),
            });
        } catch (error) {
            if (attempt === PUSH_RETRY_DELAYS_MS.length) throw error;
            await new Promise((resolve) => setTimeout(resolve, PUSH_RETRY_DELAYS_MS[attempt]));
            continue;
        }

        if (response.status === 404 || response.status === 410) {
            await deleteExpiredSubscription(subscription.id);
            return false;
        }
        if (response.ok) return true;

        const body = await response.text().catch(() => "");
        const error = new Error("Push service returned HTTP " + response.status + (body ? ": " + body : ""));
        const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
        if (!retryable || attempt === PUSH_RETRY_DELAYS_MS.length) throw error;
        await new Promise((resolve) => setTimeout(resolve, PUSH_RETRY_DELAYS_MS[attempt]));
    }

    return false;
}

async function queueNotification(
    subscriptionId: string,
    payload: PushPayload
): Promise<void> {
    await query(
        `
            INSERT INTO owner_push_notifications (
                subscription_id,
                title,
                body,
                url,
                tag,
                attempt_count,
                last_attempt_at
            )
            VALUES ($1, $2, $3, $4, $5, 1, NOW())
        `,
        [
            subscriptionId,
            payload.title,
            payload.body,
            payload.url,
            payload.tag ?? null,
        ]
    );
}

export async function sendOwnerPush(
    restaurantId: string,
    payload: PushPayload
): Promise<{ attempted: number; sent: number }> {
    const subscriptions = await query<PushSubscriptionRow>(
        `
            SELECT id, endpoint
            FROM owner_push_subscriptions
            WHERE restaurant_id = $1
              AND enabled = true
        `,
        [restaurantId]
    );

    let sent = 0;

    await Promise.all(
        subscriptions.rows.map(async (subscription) => {
            await queueNotification(subscription.id, payload);

            try {
                if (await wakeSubscription(subscription)) {
                    sent += 1;
                }
            } catch (error) {
                console.error(
                    "[OWNER_PUSH] Failed to wake subscription:",
                    subscription.id,
                    error
                );
            }
        })
    );

    return {
        attempted: subscriptions.rows.length,
        sent,
    };
}

export async function sendTestPush({
    restaurantId,
    userId,
    deviceToken,
}: {
    restaurantId: string;
    userId: string;
    deviceToken: string;
}): Promise<boolean> {
    const subscriptionResult = await query<PushSubscriptionRow>(
        `
            SELECT id, endpoint
            FROM owner_push_subscriptions
            WHERE restaurant_id = $1
              AND user_id = $2
              AND device_token = $3
              AND enabled = true
            LIMIT 1
        `,
        [restaurantId, userId, deviceToken]
    );

    const subscription = subscriptionResult.rows[0];
    if (!subscription) return false;

    await queueNotification(subscription.id, {
        title: "Notificações ativadas ✅",
        body: "Este aparelho receberá os avisos importantes do seu restaurante.",
        url: "/painel/aplicativo",
        tag: "imenu-push-test",
    });

    return wakeSubscription(subscription);
}

// The service worker acknowledges only after displaying (or already displaying) an alert.
export async function acknowledgeOwnerPush(
    deviceToken: string,
    notificationId: string
): Promise<boolean> {
    const result = await query<{ id: string }>(
        `
            UPDATE owner_push_notifications AS notification
            SET delivered_at = COALESCE(notification.delivered_at, NOW())
            FROM owner_push_subscriptions AS subscription
            WHERE notification.id = $1
              AND notification.subscription_id = subscription.id
              AND subscription.device_token = $2
              AND subscription.enabled = true
              AND notification.created_at > NOW() - INTERVAL '10 minutes'
            RETURNING notification.id
        `,
        [notificationId, deviceToken]
    );
    return result.rows.length > 0;
}

// Retry accepted but unacknowledged pushes: 30s, then 90s, then 3min.
// A due row is claimed atomically so overlapping cron workers cannot repeat it.
export async function retryUnacknowledgedOwnerPush(): Promise<{
    claimed: number;
    accepted: number;
    failed: number;
}> {
    const result = await query<{ id: string; subscription_id: string; endpoint: string }>(
        `
            WITH due AS (
                SELECT notification.id
                FROM owner_push_notifications AS notification
                INNER JOIN owner_push_subscriptions AS subscription
                    ON subscription.id = notification.subscription_id
                WHERE notification.delivered_at IS NULL
                  AND notification.attempt_count BETWEEN 1 AND 3
                  AND notification.created_at > NOW() - INTERVAL '10 minutes'
                  AND subscription.enabled = true
                  AND notification.last_attempt_at <= NOW() - (
                      CASE notification.attempt_count
                          WHEN 1 THEN INTERVAL '30 seconds'
                          WHEN 2 THEN INTERVAL '90 seconds'
                          ELSE INTERVAL '180 seconds'
                      END
                  )
                ORDER BY notification.last_attempt_at ASC
                LIMIT $1
                FOR UPDATE OF notification SKIP LOCKED
            )
            UPDATE owner_push_notifications AS notification
            SET attempt_count = notification.attempt_count + 1,
                last_attempt_at = NOW()
            FROM due, owner_push_subscriptions AS subscription
            WHERE notification.id = due.id
              AND subscription.id = notification.subscription_id
            RETURNING notification.id, notification.subscription_id, subscription.endpoint
        `,
        [PUSH_RETRY_BATCH_SIZE]
    );

    let accepted = 0;
    let failed = 0;
    for (let offset = 0; offset < result.rows.length; offset += PUSH_RETRY_CONCURRENCY) {
        await Promise.all(result.rows.slice(offset, offset + PUSH_RETRY_CONCURRENCY).map(async (row) => {
            try {
                if (await wakeSubscription({ id: row.subscription_id, endpoint: row.endpoint })) {
                    accepted++;
                } else {
                    failed++;
                }
            } catch (error) {
                failed++;
                console.error("[OWNER_PUSH] Retry wake failed:", row.subscription_id, error);
            }
        }));
    }

    return { claimed: result.rows.length, accepted, failed };
}

export async function takeNextPushNotification(
    deviceToken: string
): Promise<PendingNotificationRow | null> {
    return withTransaction(async (client) => {
        // Match the push wake's 10-minute TTL; missed wakes must not leave old alerts.
        await client.query(
            `
                DELETE FROM owner_push_notifications AS notification
                USING owner_push_subscriptions AS subscription
                WHERE subscription.id = notification.subscription_id
                  AND subscription.device_token = $1
                  AND notification.delivered_at IS NULL
                  AND notification.created_at <= NOW() - ($2::integer * INTERVAL '1 second')
            `,
            [deviceToken, PUSH_TTL_SECONDS]
        );

        const result = await client.query<PendingNotificationRow>(
            `
                SELECT
                    notification.id,
                    notification.title,
                    notification.body,
                    notification.url,
                    notification.tag,
                    notification.created_at,
                    (EXTRACT(EPOCH FROM notification.created_at + ($2::integer * INTERVAL '1 second')) * 1000)::double precision AS "expiresAt"
                FROM owner_push_notifications AS notification
                INNER JOIN owner_push_subscriptions AS subscription
                    ON subscription.id = notification.subscription_id
                WHERE subscription.device_token = $1
                  AND subscription.enabled = true
                  AND notification.delivered_at IS NULL
                  AND notification.created_at > NOW() - ($2::integer * INTERVAL '1 second')
                -- Prefer not-yet-fetched alerts so simultaneous order pushes each get a payload.
                ORDER BY (notification.sent_at IS NOT NULL) ASC, notification.created_at ASC
                LIMIT 1
                FOR UPDATE OF notification SKIP LOCKED
            `,
            [deviceToken, PUSH_TTL_SECONDS]
        );

        const notification = result.rows[0];
        if (!notification) return null;

        await client.query(
            `
                UPDATE owner_push_notifications
                SET sent_at = COALESCE(sent_at, NOW())
                WHERE id = $1
            `,
            [notification.id]
        );

        return notification;
    });
}

function formatMoney(cents: number | null): string {
    return ((Number(cents) || 0) / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

export async function notifyOrderReady(orderId: string): Promise<boolean> {
    const orderResult = await query<OrderNotificationRow>(
        `
            SELECT
                id,
                restaurant_id,
                customer_name,
                total_cents,
                status
            FROM orders
            WHERE id = $1
              AND created_at >= NOW() - INTERVAL '24 hours'
            LIMIT 1
        `,
        [orderId]
    );

    const order = orderResult.rows[0];
    if (!order) return false;

    if (["pending_online_payment", "canceled", "done"].includes(order.status)) {
        return false;
    }

    const eventResult = await query<{ order_id: string }>(
        `
            INSERT INTO owner_push_order_events (order_id, restaurant_id)
            VALUES ($1, $2)
            ON CONFLICT (order_id) DO NOTHING
            RETURNING order_id
        `,
        [order.id, order.restaurant_id]
    );

    if (eventResult.rowCount === 0) {
        return true;
    }

    const customer = order.customer_name?.trim();
    const body = customer
        ? `${customer} fez um pedido de ${formatMoney(order.total_cents)}.`
        : `Novo pedido de ${formatMoney(order.total_cents)} recebido.`;

    await sendOwnerPush(order.restaurant_id, {
        title: "Novo pedido no iMenu 🔔",
        body,
        url: "/painel/pedidos",
        tag: `order-${order.id}`,
    });

    return true;
}
