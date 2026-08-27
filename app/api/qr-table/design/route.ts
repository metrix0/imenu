import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QR_DESIGN_TEMPLATES = new Set([
    "classic",
    "dark",
    "banner",
    "logo",
    "xadrez",
    "gradient",
    "minimal",
]);

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as {
            restaurantId?: string;
            template?: string;
            color?: string;
        };
        const restaurantId = String(body.restaurantId || "");
        const template = String(body.template || "");
        const color = String(body.color || "");

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não informado." },
                { status: 400 }
            );
        }

        if (!QR_DESIGN_TEMPLATES.has(template)) {
            return NextResponse.json(
                { error: "Modelo de QR Code inválido." },
                { status: 400 }
            );
        }

        if (!/^#[0-9a-fA-F]{6}$/.test(color)) {
            return NextResponse.json(
                { error: "Cor do QR Code inválida." },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);

        const result = await query<{ id: string }>(
            `
                UPDATE public.restaurant_addons
                SET
                    qr_design_template = $1,
                    qr_design_color = $2,
                    updated_at = NOW()
                WHERE restaurant_id = $3
                  AND product_key = 'qr_code_mesa'
                RETURNING id
            `,
            [template, color.toUpperCase(), restaurantId]
        );

        if (!result.rows[0]) {
            return NextResponse.json(
                { error: "QR Code Mesa não encontrado." },
                { status: 404 }
            );
        }

        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[QR_TABLE_DESIGN] Falha ao salvar design:", error);

        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: "Não foi possível salvar o design." },
            { status: 500 }
        );
    }
}
