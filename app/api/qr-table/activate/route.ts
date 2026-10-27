import { NextResponse } from "next/server";
import { RestaurantOwnerAuthError, requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import type { QrTableSettings } from "@/lib/qr-table/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Free QR settings are independent of legacy add-ons and never change billing history.
export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { restaurantId?: string };
        const restaurantId = String(body.restaurantId || "");
        if (!restaurantId) return NextResponse.json({ error: "Restaurante não informado." }, { status: 400 });
        await requireRestaurantOwner(request, restaurantId);
        const result = await query<QrTableSettings>(
            `INSERT INTO public.restaurant_qr_settings (restaurant_id)
             VALUES ($1) ON CONFLICT (restaurant_id)
             DO UPDATE SET restaurant_id=EXCLUDED.restaurant_id RETURNING *`,
            [restaurantId]
        );
        return NextResponse.json({ settings: result.rows[0], active: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[QR_TABLE_FREE_ACTIVATION]", error);
        return NextResponse.json(
            { error: error instanceof RestaurantOwnerAuthError ? error.message : "Não foi possível configurar o QR Code gratuito." },
            { status: error instanceof RestaurantOwnerAuthError ? error.status : 500 }
        );
    }
}
