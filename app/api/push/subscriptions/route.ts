import { NextRequest, NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { requireOwnedRestaurant } from "@/lib/push/auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PushSubscriptionBody = {
    restaurantId?: unknown;
    deviceToken?: unknown;
    subscription?: {
        endpoint?: unknown;
        keys?: {
            p256dh?: unknown;
            auth?: unknown;
        };
    };
};


function subscriptionConflictResponse() {
    return NextResponse.json(
        { error: "Este aparelho já possui uma assinatura de notificações em conflito. Desative a anterior antes de tentar novamente." },
        { status: 409 }
    );
}

function jsonError(error: unknown) {
    if (error instanceof Response) {
        return NextResponse.json(
            { error: error.statusText || "Request failed" },
            { status: error.status }
        );
    }

    if (error && typeof error === "object" && "code" in error && error.code === "23505") {
        return subscriptionConflictResponse();
    }

    console.error("[PUSH_SUBSCRIPTIONS]", error);
    return NextResponse.json(
        {
            error:
                error instanceof Error
                    ? error.message
                    : "Não foi possível salvar as notificações.",
        },
        { status: 500 }
    );
}

function validateDeviceToken(value: unknown): string {
    const token = String(value || "").trim();
    if (!/^[a-zA-Z0-9_-]{20,200}$/.test(token)) {
        throw new Response("Invalid device token", { status: 400 });
    }
    return token;
}

function validateEndpoint(value: unknown): string {
    const endpoint = String(value || "").trim();
    const url = new URL(endpoint);
    if (url.protocol !== "https:") {
        throw new Response("Invalid push endpoint", { status: 400 });
    }
    return endpoint;
}


export async function GET(request: NextRequest) {
    try {
        const restaurantId = request.nextUrl.searchParams.get("restaurantId")?.trim();
        const rawDeviceToken = request.nextUrl.searchParams.get("deviceToken");
        if (!restaurantId) {
            return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });
        }

        const { userId } = await requireOwnedRestaurant(request, restaurantId);
        const deviceToken = validateDeviceToken(rawDeviceToken);
        const result = await query<{ endpoint: string }>(
            `SELECT endpoint FROM owner_push_subscriptions
              WHERE restaurant_id = $1 AND user_id = $2 AND device_token = $3
                AND enabled = true
              LIMIT 1`,
            [restaurantId, userId, deviceToken]
        );
        return NextResponse.json(
            { endpoint: result.rows[0]?.endpoint ?? null },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        return jsonError(error);
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = (await request.json()) as PushSubscriptionBody;
        const restaurantId = String(body.restaurantId || "").trim();
        if (!restaurantId) {
            return NextResponse.json(
                { error: "restaurantId is required" },
                { status: 400 }
            );
        }

        const { userId } = await requireOwnedRestaurant(request, restaurantId);
        const deviceToken = validateDeviceToken(body.deviceToken);
        const endpoint = validateEndpoint(body.subscription?.endpoint);
        const p256dh = String(body.subscription?.keys?.p256dh || "").trim();
        const authSecret = String(body.subscription?.keys?.auth || "").trim();

        if (!p256dh || !authSecret) {
            return NextResponse.json(
                { error: "Subscription keys are required" },
                { status: 400 }
            );
        }

        // Update a known device in place when its push endpoint rotates.
        // For a new device, keep endpoint upsert semantics but never reassign
        // a subscription belonging to a different restaurant or account.
        const saved = await query<{ id: string }>(
            `
                WITH updated_by_token AS (
                    UPDATE owner_push_subscriptions
                    SET endpoint = $3,
                        p256dh = $4,
                        auth_secret = $5,
                        user_agent = $7,
                        enabled = true,
                        last_seen_at = NOW(),
                        updated_at = NOW()
                    WHERE restaurant_id = $1
                      AND user_id = $2
                      AND device_token = $6
                    RETURNING id
                ),
                upserted_by_endpoint AS (
                    INSERT INTO owner_push_subscriptions (
                        restaurant_id, user_id, endpoint, p256dh, auth_secret,
                        device_token, user_agent, enabled, last_seen_at, updated_at
                    )
                    SELECT $1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW()
                    WHERE NOT EXISTS (SELECT 1 FROM updated_by_token)
                    ON CONFLICT (endpoint)
                    DO UPDATE SET
                        p256dh = EXCLUDED.p256dh,
                        auth_secret = EXCLUDED.auth_secret,
                        device_token = EXCLUDED.device_token,
                        user_agent = EXCLUDED.user_agent,
                        enabled = true,
                        last_seen_at = NOW(),
                        updated_at = NOW()
                    WHERE owner_push_subscriptions.user_id = EXCLUDED.user_id
                      AND owner_push_subscriptions.restaurant_id = EXCLUDED.restaurant_id
                    RETURNING id
                )
                SELECT id FROM updated_by_token
                UNION ALL
                SELECT id FROM upserted_by_endpoint
            `,
            [
                restaurantId,
                userId,
                endpoint,
                p256dh,
                authSecret,
                deviceToken,
                request.headers.get("user-agent"),
            ]
        );

        if (saved.rows.length === 0) {
            return subscriptionConflictResponse();
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        return jsonError(error);
    }
}

export async function DELETE(request: NextRequest) {
    try {
        const body = (await request.json()) as PushSubscriptionBody;
        const restaurantId = String(body.restaurantId || "").trim();
        if (!restaurantId) {
            return NextResponse.json(
                { error: "restaurantId is required" },
                { status: 400 }
            );
        }

        const { userId } = await requireOwnedRestaurant(request, restaurantId);
        const deviceToken = validateDeviceToken(body.deviceToken);

        await query(
            `
                DELETE FROM owner_push_subscriptions
                WHERE restaurant_id = $1
                  AND user_id = $2
                  AND device_token = $3
            `,
            [restaurantId, userId, deviceToken]
        );

        return NextResponse.json({ ok: true });
    } catch (error) {
        return jsonError(error);
    }
}
