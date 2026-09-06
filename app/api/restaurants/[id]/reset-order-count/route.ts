import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ResetResult = {
    reset_from: string | number;
    updated_count: string | number;
};

export async function POST(
    request: Request,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json(
            { error: "Restaurant ID is required" },
            { status: 400 },
        );
    }

    try {
        await requireRestaurantOwner(request, id);

        const result = await query<ResetResult>(
            `
                WITH current_max AS (
                    SELECT COALESCE(MAX(display_id), 0)::bigint AS value
                    FROM public.orders
                    WHERE restaurant_id = $1
                ),
                updated AS (
                    UPDATE public.orders
                    SET display_id = NULL
                    WHERE restaurant_id = $1
                    RETURNING 1
                )
                SELECT
                    value AS reset_from,
                    (SELECT COUNT(*) FROM updated)::int AS updated_count
                FROM current_max
            `,
            [id],
        );

        return NextResponse.json({
            success: true,
            resetFrom: Number(result.rows[0]?.reset_from) || 0,
            updatedCount: Number(result.rows[0]?.updated_count) || 0,
        });
    } catch (error) {
        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status },
            );
        }

        console.error("[RESET_ORDER_COUNT] Failed:", error);
        return NextResponse.json(
            { error: "Erro ao reiniciar a numeração dos pedidos." },
            { status: 500 },
        );
    }
}
