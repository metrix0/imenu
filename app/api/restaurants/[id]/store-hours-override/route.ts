import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { nextStoreMidnight } from "@/lib/menu/storeHoursOverride";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const body = await request.json().catch(() => null);
    const action = body?.action;
    if (action !== "open" && action !== "close" && action !== "resume") {
        return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
    }

    try {
        const { user } = await requireRestaurantOwner(request, id);
        const now = new Date();
        const { rows: [status] } = await query<{ is_closed: string | null; manual_open_until: string | null }>(
            `UPDATE public.restaurants
             SET is_closed = $3::timestamptz AT TIME ZONE 'UTC',
                 manual_open_until = $4::timestamptz, updated_at = NOW()
             WHERE id = $1 AND user_id = $2
             RETURNING is_closed AT TIME ZONE 'UTC' AS is_closed, manual_open_until`,
            [id, user.id, action === "close" ? now.toISOString() : null,
                action === "open" ? nextStoreMidnight(now) : null],
        );
        if (!status) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });
        return NextResponse.json(status);
    } catch (error) {
        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        console.error("Erro ao alterar disponibilidade da loja:", error);
        return NextResponse.json({ error: "Erro ao alterar disponibilidade da loja." }, { status: 500 });
    }
}

