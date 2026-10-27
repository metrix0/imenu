import { NextResponse } from "next/server";
import { RestaurantOwnerAuthError, requireRestaurantOwner } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import type { QrTableAddon, QrTableSource } from "@/lib/qr-table/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The QR feature is free; retain legacy QR rows and their public tokens/design.
export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { restaurantId?: string; source?: QrTableSource };
        const restaurantId = String(body.restaurantId || "");
        if (!restaurantId) return NextResponse.json({ error: "Restaurante não informado." }, { status: 400 });
        await requireRestaurantOwner(request, restaurantId);
        const source: QrTableSource = ["onboarding", "mesas", "settings"].includes(String(body.source)) ? body.source! : "mesas";
        const result = await query<QrTableAddon>(
            `INSERT INTO public.restaurant_addons (restaurant_id,product_key,status,price_cents,billing_cycle,acquisition_source,activated_at)
             VALUES ($1,'qr_code_mesa','active',0,'monthly',$2,now())
             ON CONFLICT (restaurant_id,product_key)
             DO UPDATE SET status='active',price_cents=0,billing_cycle='monthly',updated_at=now()
             RETURNING *`,
            [restaurantId, source]
        );
        return NextResponse.json({ addon: result.rows[0], active: true }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[QR_TABLE_FREE_ACTIVATION]", error);
        return NextResponse.json(
            { error: error instanceof RestaurantOwnerAuthError ? error.message : "Não foi possível ativar o QR Code gratuito." },
            { status: error instanceof RestaurantOwnerAuthError ? error.status : 500 }
        );
    }
}
