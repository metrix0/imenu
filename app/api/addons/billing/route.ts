import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AddonRow = {
    id: string;
    restaurant_id: string;
    product_key: string;
    status: string;
    price_cents: number;
    billing_cycle: string;
    payment_provider: string | null;
    payzu_payment_method: string | null;
    payzu_recurrence_id: string | null;
    payzu_payment_status: string | null;
    current_period_ends_at: string | null;
};

type PaymentRow = {
    id: string;
    addon_id: string;
    amount_cents: number;
    status: string;
    billing_type: string | null;
    due_date: string | null;
    paid_at: string | null;
    invoice_url: string | null;
    created_at: string;
};

function hasAddonAccess(addon: AddonRow): boolean {
    if (addon.status === "active") return true;
    if (!addon.current_period_ends_at) return false;

    const periodEnd = new Date(addon.current_period_ends_at).getTime();
    return (
        (addon.status === "canceled" || addon.status === "past_due") &&
        Number.isFinite(periodEnd) &&
        periodEnd > Date.now()
    );
}

export async function GET(request: Request) {
    try {
        const restaurantId = new URL(request.url).searchParams.get(
            "restaurantId"
        );
        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não informado." },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);

        const addonsResult = await query<AddonRow>(
            `
                SELECT
                    id,
                    restaurant_id,
                    product_key,
                    status,
                    price_cents,
                    billing_cycle,
                    payment_provider,
                    payzu_payment_method,
                    payzu_recurrence_id,
                    payzu_payment_status,
                    current_period_ends_at
                FROM public.restaurant_addons
                WHERE restaurant_id = $1
                ORDER BY created_at ASC
            `,
            [restaurantId]
        );

        const addonIds = addonsResult.rows.map((addon) => addon.id);
        const paymentsResult = addonIds.length
            ? await query<PaymentRow>(
                  `
                    SELECT
                        id,
                        addon_id,
                        amount_cents,
                        status,
                        billing_type,
                        due_date,
                        paid_at,
                        invoice_url,
                        created_at
                    FROM public.restaurant_addon_payments
                    WHERE addon_id = ANY($1::uuid[])
                    ORDER BY COALESCE(paid_at, created_at) DESC
                  `,
                  [addonIds]
              )
            : { rows: [] as PaymentRow[] };

        const paymentsByAddon = new Map<string, PaymentRow[]>();
        for (const payment of paymentsResult.rows) {
            const payments = paymentsByAddon.get(payment.addon_id) || [];
            payments.push(payment);
            paymentsByAddon.set(payment.addon_id, payments);
        }

        return NextResponse.json(
            {
                addons: addonsResult.rows.map((addon) => ({
                    addon,
                    active: hasAddonAccess(addon),
                    payments: paymentsByAddon.get(addon.id) || [],
                })),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[ADDON_BILLING] Falha ao carregar pagamentos:", error);

        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: "Não foi possível carregar os pagamentos." },
            { status: 500 }
        );
    }
}
