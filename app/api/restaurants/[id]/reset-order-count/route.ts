import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

        await query(
            `
                UPDATE public.restaurants
                SET order_number_reset_at = NOW()
                WHERE id = $1
            `,
            [id],
        );

        return NextResponse.json({ success: true });
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
