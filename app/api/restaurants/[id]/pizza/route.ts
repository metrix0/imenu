import { NextResponse } from "next/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import { MAX_PIZZA_FLAVORS, parsePizzaSettings } from "@/lib/pizza/pricing";

const failure = (error: unknown) => NextResponse.json({ error: error instanceof RestaurantOwnerAuthError ? error.message : "Não foi possível salvar ou carregar o Modo Pizza." }, { status: error instanceof RestaurantOwnerAuthError ? error.status : 500 });

export async function GET(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        await requireRestaurantOwner(request, id);
        const [restaurant, categories] = await Promise.all([
            query("SELECT pizza_settings FROM restaurants WHERE id = $1", [id]),
            query("SELECT id, name, position FROM categories WHERE restaurant_id = $1 ORDER BY position, id", [id]),
        ]);
        return NextResponse.json({ settings: parsePizzaSettings(restaurant.rows[0]?.pizza_settings), categories: categories.rows });
    } catch (error) { return failure(error); }
}

export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        await requireRestaurantOwner(request, id);
        const body = await request.json();
        if (typeof body.enabled !== "boolean" || !["highest", "average"].includes(body.pricing_rule) || !Number.isInteger(body.max_flavors) || body.max_flavors < 2 || body.max_flavors > MAX_PIZZA_FLAVORS || !Array.isArray(body.category_ids) || body.category_ids.some((v: unknown) => typeof v !== "string" || !/^[0-9a-f-]{36}$/i.test(v))) return NextResponse.json({ error: "Configuração de pizza inválida." }, { status: 400 });
        const settings = parsePizzaSettings(body);
        const categories = await query("SELECT id FROM categories WHERE restaurant_id = $1 AND id = ANY($2::uuid[])", [id, settings.category_ids]);
        if (categories.rows.length !== settings.category_ids.length) return NextResponse.json({ error: "Escolha apenas categorias deste restaurante." }, { status: 400 });
        await query("UPDATE restaurants SET pizza_settings = $2::jsonb, updated_at = NOW() WHERE id = $1", [id, JSON.stringify(settings)]);
        return NextResponse.json({ settings });
    } catch (error) { return failure(error); }
}
