import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { AsaasApiError, asaasRequest } from "@/lib/qr-table/asaas";
import { resolveAsaasSubscriptionId } from "@/lib/qr-table/asaasSubscription";
import type { QrTableAddon } from "@/lib/qr-table/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddonRow = QrTableAddon & {
    product_key: string;
};

export async function DELETE(request: Request) {
    try {
        const body = (await request.json()) as {
            restaurantId?: string;
            addonId?: string;
        };
        const restaurantId = String(body.restaurantId || "");
        const addonId = String(body.addonId || "");

        if (!restaurantId || !addonId) {
            return NextResponse.json(
                { error: "Adicional não informado." },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);

        const result = await query<AddonRow>(
            `
                SELECT *
                FROM public.restaurant_addons
                WHERE id = $1
                  AND restaurant_id = $2
                LIMIT 1
            `,
            [addonId, restaurantId]
        );
        const addon = result.rows[0];

        if (!addon) {
            return NextResponse.json(
                { error: "Assinatura não encontrada." },
                { status: 404 }
            );
        }

        if (addon.payment_provider !== "asaas") {
            return NextResponse.json(
                { error: "Este adicional não possui cobrança recorrente ativa." },
                { status: 409 }
            );
        }

        const subscriptionId = await resolveAsaasSubscriptionId(addon);
        if (!subscriptionId) {
            return NextResponse.json(
                {
                    error:
                        "Não foi possível localizar a assinatura ativa no Asaas.",
                },
                { status: 409 }
            );
        }

        await asaasRequest<void>(
            `/subscriptions/${encodeURIComponent(subscriptionId)}`,
            { method: "DELETE" }
        );

        await query(
            `
                UPDATE public.restaurant_addons
                SET
                    asaas_subscription_id = COALESCE(
                        asaas_subscription_id,
                        $2
                    ),
                    status = 'canceled',
                    canceled_at = NOW(),
                    current_period_ends_at = COALESCE(
                        current_period_ends_at,
                        NOW()
                    ),
                    updated_at = NOW()
                WHERE id = $1
            `,
            [addon.id, subscriptionId]
        );

        return NextResponse.json({
            ok: true,
            currentPeriodEndsAt:
                addon.current_period_ends_at || new Date().toISOString(),
        });
    } catch (error) {
        console.error("[ADDON_SUBSCRIPTION] Falha ao cancelar:", error);

        if (
            error instanceof RestaurantOwnerAuthError ||
            error instanceof AsaasApiError
        ) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: "Não foi possível cancelar a assinatura." },
            { status: 500 }
        );
    }
}
