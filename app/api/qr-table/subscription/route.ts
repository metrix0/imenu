import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import type { QrTableAddon } from "@/lib/qr-table/types";
import { AsaasApiError, asaasRequest } from "@/lib/services/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function DELETE(request: Request) {
    try {
        const body = (await request.json()) as { restaurantId?: string };
        const restaurantId = String(body.restaurantId || "");

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não informado." },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);
        const result = await query<QrTableAddon>(
            `
                SELECT *
                FROM public.restaurant_addons
                WHERE restaurant_id = $1
                  AND product_key = 'qr_code_mesa'
                LIMIT 1
            `,
            [restaurantId]
        );
        const addon = result.rows[0];

        if (!addon?.asaas_subscription_id) {
            return NextResponse.json(
                { error: "Nenhuma assinatura ativa foi encontrada." },
                { status: 409 }
            );
        }

        await asaasRequest<void>(
            `/subscriptions/${encodeURIComponent(addon.asaas_subscription_id)}`,
            { method: "DELETE" }
        );

        await query(
            `
                UPDATE public.restaurant_addons
                SET
                    status = 'canceled',
                    canceled_at = NOW(),
                    current_period_ends_at = COALESCE(
                        current_period_ends_at,
                        NOW()
                    ),
                    updated_at = NOW()
                WHERE id = $1
            `,
            [addon.id]
        );

        return NextResponse.json({
            ok: true,
            currentPeriodEndsAt:
                addon.current_period_ends_at || new Date().toISOString(),
        });
    } catch (error) {
        console.error("[QR_TABLE_SUBSCRIPTION] Falha ao cancelar:", error);

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
