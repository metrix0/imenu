import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function PATCH(request: Request) {
    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    if (!body || typeof body !== "object") {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }
    const { restaurantId, enabled } = body as { restaurantId?: unknown; enabled?: unknown };
    if (typeof restaurantId !== "string" || !UUID.test(restaurantId) || typeof enabled !== "boolean") {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    try {
        await requireRestaurantOwner(request, restaurantId);
        if (enabled && !(await hasIMenuPlusAccess(restaurantId))) {
            return NextResponse.json(
                { error: "O tema escuro é exclusivo do iMenu Plus." },
                { status: 403, headers: { "Cache-Control": "no-store" } },
            );
        }

        const { rows } = await query<{ dark_menu_enabled: boolean }>(
            "UPDATE public.restaurants SET dark_menu_enabled = $2, updated_at = NOW() WHERE id = $1 RETURNING dark_menu_enabled",
            [restaurantId, enabled],
        );
        if (!rows.length) {
            return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });
        }
        return NextResponse.json(
            { enabled: rows[0].dark_menu_enabled },
            { headers: { "Cache-Control": "no-store" } },
        );
    } catch (error) {
        const status = error instanceof RestaurantOwnerAuthError ? error.status : 500;
        if (status === 500) console.error("[MENU_DARK_THEME]", error);
        return NextResponse.json(
            { error: status === 500 ? "Não foi possível salvar o tema escuro." : (error as Error).message },
            { status, headers: { "Cache-Control": "no-store" } },
        );
    }
}
