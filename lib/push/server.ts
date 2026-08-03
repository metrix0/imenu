import { importPKCS8, SignJWT } from "jose";

import { query, withTransaction } from "@/lib/database/sql";

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

async function wakeSubscription(
    subscription: PushSubscriptionRow
): Promise<boolean> {
    const response = await fetch(subscription.endpoint, {
        method: "POST",
        headers: {
            Authorization: await createVapidAuthorization(subscription.endpoint),
            "Crypto-Key": `p256ecdsa=${getVapidPublicKey()}`,
            TTL: "120",
            Urgency: "high",
        },
        body: null,
        cache: "no-store",
        signal: AbortSignal.timeout(15_000),
    });

    if (response.status === 404 || response.status === 410) {
        await deleteExpiredSubscription(subscription.id);
        return false;
    }

    if (!response.ok) {
        const body = await response.text().catch(() => "");
        throw new Error(
            `Push service returned HTTP ${response.status}${body ? `: ${body}` : ""}`
        );
    }

    return true;
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
                tag
            )
            VALUES ($1, $2, $3, $4, $5)
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

export async function takeNextPushNotification(
    deviceToken: string
): Promise<PendingNotificationRow | null> {
    return withTransaction(async (client) => {
        const result = await client.query<PendingNotificationRow>(
            `
                SELECT
                    notification.id,
                    notification.title,
                    notification.body,
                    notification.url,
                    notification.tag
                FROM owner_push_notifications AS notification
                INNER JOIN owner_push_subscriptions AS subscription
                    ON subscription.id = notification.subscription_id
                WHERE subscription.device_token = $1
                  AND subscription.enabled = true
                  AND notification.delivered_at IS NULL
                ORDER BY notification.created_at ASC
                LIMIT 1
                FOR UPDATE OF notification SKIP LOCKED
            `,
            [deviceToken]
        );

        const notification = result.rows[0];
        if (!notification) return null;

        await client.query(
            `
                UPDATE owner_push_notifications
                SET delivered_at = NOW()
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

    if (["pending_online_payment", "canceled"].includes(order.status)) {
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
