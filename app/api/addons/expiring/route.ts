import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ExpiringAddonRow = {
    id: string;
    product_key: string;
    current_period_ends_at: string | Date;
};

function productName(productKey: string): string {
    const uppercaseWords = new Set(["qr", "ai", "api"]);
    return productKey
        .split("_")
        .filter(Boolean)
        .map((word) =>
            uppercaseWords.has(word.toLowerCase())
                ? word.toUpperCase()
                : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()
        )
        .join(" ");
}

export async function GET(request: Request) {
    try {
        const url = new URL(request.url);
        const restaurantId = url.searchParams.get("restaurantId")?.trim() || "";

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não informado." },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);

        const result = await query<ExpiringAddonRow>(
            `
            SELECT
                id,
                product_key,
                current_period_ends_at
            FROM public.restaurant_addons
            WHERE restaurant_id = $1
              AND payment_provider = 'payzu'
              AND UPPER(COALESCE(payzu_payment_method, '')) = 'PIX'
              AND payzu_recurrence_id IS NULL
              AND current_period_ends_at IS NOT NULL
              AND status IN ('active', 'canceled', 'past_due')
              AND (
                    current_period_ends_at AT TIME ZONE 'America/Sao_Paulo'
                  )::date = (
                    NOW() AT TIME ZONE 'America/Sao_Paulo'
                  )::date
            ORDER BY current_period_ends_at ASC, product_key ASC
            `,
            [restaurantId]
        );

        return NextResponse.json(
            {
                notices: result.rows.map((row) => ({
                    addonId: row.id,
                    productKey: row.product_key,
                    productName: productName(row.product_key),
                    expiresAt: new Date(row.current_period_ends_at).toISOString(),
                })),
            },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (error) {
        console.error("[ADDON_EXPIRY] Falha ao verificar vencimentos:", error);

        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: "Não foi possível verificar os vencimentos." },
            { status: 500 }
        );
    }
}
