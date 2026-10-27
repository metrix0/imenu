import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import type { QrTableSettings } from "@/lib/qr-table/types";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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

        const result = await query<QrTableSettings>(
            "SELECT * FROM public.restaurant_qr_settings WHERE restaurant_id=$1", [restaurantId]
        );
        return NextResponse.json({ settings: result.rows[0] || null, active: true, payments: [] },
            { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[QR_TABLE_BILLING] Falha ao carregar cobrança:", error);

        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: "Não foi possível carregar a assinatura." },
            { status: 500 }
        );
    }
}
