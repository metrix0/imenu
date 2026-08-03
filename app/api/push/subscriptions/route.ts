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

function jsonError(error: unknown) {
    if (error instanceof Response) {
        return NextResponse.json(
            { error: error.statusText || "Request failed" },
            { status: error.status }
        );
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

        await query(
            `
                INSERT INTO owner_push_subscriptions (
                    restaurant_id,
                    user_id,
                    endpoint,
                    p256dh,
                    auth_secret,
                    device_token,
                    user_agent,
                    enabled,
                    last_seen_at,
                    updated_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, $7, true, NOW(), NOW())
                ON CONFLICT (endpoint)
                DO UPDATE SET
                    restaurant_id = EXCLUDED.restaurant_id,
                    user_id = EXCLUDED.user_id,
                    p256dh = EXCLUDED.p256dh,
                    auth_secret = EXCLUDED.auth_secret,
                    device_token = EXCLUDED.device_token,
                    user_agent = EXCLUDED.user_agent,
                    enabled = true,
                    last_seen_at = NOW(),
                    updated_at = NOW()
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
