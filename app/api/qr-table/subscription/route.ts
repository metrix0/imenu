import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { deactivatePayZuCardRecurrence, PayZuCardApiError } from "@/lib/payzuCard";
import { resolveAsaasSubscriptionId } from "@/lib/qr-table/asaasSubscription";
import type { QrTableAddon } from "@/lib/qr-table/types";
import { AsaasApiError, asaasRequest } from "@/lib/qr-table/asaas";

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

        if (!addon) {
            return NextResponse.json(
                { error: "Nenhuma assinatura ativa foi encontrada." },
                { status: 409 }
            );
        }

        if (addon.payment_provider === "payzu") {
            if (!addon.payzu_recurrence_id) {
                return NextResponse.json(
                    {
                        error:
                            "Este pagamento não possui uma assinatura recorrente para cancelar.",
                    },
                    { status: 409 }
                );
            }

            await deactivatePayZuCardRecurrence(addon.payzu_recurrence_id);
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
        console.error("[QR_TABLE_SUBSCRIPTION] Falha ao cancelar:", error);

        if (
            error instanceof RestaurantOwnerAuthError ||
            error instanceof AsaasApiError ||
            error instanceof PayZuCardApiError
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
