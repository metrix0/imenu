import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import type { QrTableAddon } from "@/lib/qr-table/types";
import { hasQrTableAccess } from "@/lib/qr-table/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type PaymentRow = {
    id: string;
    amount_cents: number;
    status: string;
    billing_type: string | null;
    due_date: string | null;
    paid_at: string | null;
    invoice_url: string | null;
    created_at: string;
};

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

        const addonResult = await query<QrTableAddon>(
            `
                SELECT *
                FROM public.restaurant_addons
                WHERE restaurant_id = $1
                  AND product_key = 'qr_code_mesa'
                LIMIT 1
            `,
            [restaurantId]
        );
        const addon = addonResult.rows[0] || null;

        const payments = addon
            ? await query<PaymentRow>(
                  `
                    SELECT
                        id,
                        amount_cents,
                        status,
                        billing_type,
                        due_date,
                        paid_at,
                        invoice_url,
                        created_at
                    FROM public.restaurant_addon_payments
                    WHERE addon_id = $1
                    ORDER BY COALESCE(paid_at, created_at) DESC
                  `,
                  [addon.id]
              )
            : { rows: [] as PaymentRow[] };

        return NextResponse.json(
            {
                addon,
                active: hasQrTableAccess(addon),
                payments: payments.rows,
            },
            { headers: { "Cache-Control": "no-store" } }
        );
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
