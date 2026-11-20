import { getPublicItemMedia } from "@/lib/menu/itemMedia";
import { getMenuItemImageUrl } from "@/lib/menu/itemImages";
import { isItemAvailableForChannel } from "@/lib/menu/itemAvailability";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { loadPizzaCatalog } from "@/lib/pizza/catalog";
import { parsePizzaSettings } from "@/lib/pizza/pricing";

export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const result = await query("SELECT pizza_settings FROM restaurants WHERE id = $1", [id]);
        if (!result.rows[0]) return NextResponse.json({ error: "Restaurante não encontrado." }, { status: 404 });
        const settings = parsePizzaSettings(result.rows[0].pizza_settings);
        const destination = new URL(_request.url).searchParams.get("channel") === "mesa" ? "mesa" : "entrega";
        const catalog = (await loadPizzaCatalog({ query } as Parameters<typeof loadPizzaCatalog>[0], id, settings))
            .filter(item => isItemAvailableForChannel(item, destination));
        const plusActive = catalog.some(item => Array.isArray(item.gallery_media) && item.gallery_media.length > 0) &&
            await hasIMenuPlusAccess(id).catch(error => {
                console.error("[PIZZA_CATALOG] Unable to check Plus access:", error);
                return false;
            });
        const supabase = createSupabaseServerClient();
        return NextResponse.json({ settings, items: catalog.map(item => ({
            id: item.id, name: item.name, description: item.description, price_cents: item.price_cents,
            is_available: item.is_available, position: item.position, category: item.category,
            category_id: item.category_id, promotion: item.promotion, image_path: item.image_path,
            image_public_url: getMenuItemImageUrl(supabase, item.image_path),
            gallery_media: plusActive ? getPublicItemMedia(supabase, item.gallery_media) : [],
            subcategories: item.subcategories,
            pizza_same_category_only: settings.same_category_only,
        })) }, { headers: { "Cache-Control": "no-store" } });
    } catch {
        return NextResponse.json({ error: "Não foi possível carregar os sabores." }, { status: 500 });
    }
}
