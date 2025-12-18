// app/api/restaurants/[id]/creation-data/route.ts
import { query } from "@/lib/database/sql";
import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

const supabase_url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const service_key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabase_url, service_key);


type Category = { id: string; name: string };
type Item = { id: string; name: string; category?: Category | null };

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id: restaurantId } = await context.params;

    if (!restaurantId) {
        return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 });
    }

    try {
        const { rows: restRows } = await query(
            `SELECT id, name, logo_url FROM restaurants WHERE id = $1`,
            [restaurantId]
        );
        
        if (restRows.length === 0) {
            return NextResponse.json({ error: "Restaurante não encontrado" }, { status: 404 });
        }
        const restaurant = restRows[0];
        
        // LOGO URL
        const logoUrl = restaurant.logo_url
            ? supabaseAdmin.storage.from("restaurant-logos").getPublicUrl(restaurant.logo_url).data?.publicUrl
            : null;

        let menuId: string | null = null;
        
        const { data: menu, error: menuErr } = await supabaseAdmin
            .from("menu")
            .select("id")
            .eq("restaurant_id", restaurantId)
            .limit(1)
            .single();

        if (menu) {
            menuId = menu.id;
        } else {
            console.warn(`Restaurante ${restaurantId} sem menu. Criando um menu padrão.`);
            const { data: newMenu, error: newMenuErr } = await supabaseAdmin
                .from("menu")
                .insert({ restaurant_id: restaurantId, name: `${restaurant.name}` })
                .select("id")
                .single();
                
            if (newMenuErr || !newMenu) throw new Error("Falha ao criar menu padrão.");
            menuId = newMenu.id;
        }

        const { data: categoriesRaw } = await supabaseAdmin
            .from("categories")
            .select("id, name, position")
            .eq("restaurant_id", restaurantId)
            .order("position", { ascending: true });
        
        const categories: Category[] = categoriesRaw ?? [];

        const { data: miRows } = await supabaseAdmin
            .from("menu_items")
            .select("item_id")
            .eq("menu_id", menuId);

        const itemIds = (miRows || []).map((r: any) => r.item_id);
        let items: Item[] = [];

        if (itemIds.length > 0) {
            const { data: itemsRaw } = await supabaseAdmin
                .from("items")
                .select("id, name, category:categories(id, name)")
                .in("id", itemIds)
                .order("position", { ascending: true });
            
            items = (itemsRaw || []).map((it: any) => {
                const cat = it.category;
                const normalizedCategory = Array.isArray(cat) ? (cat.length > 0 ? cat[0] : null) : cat ?? null;
                return { ...it, category: normalizedCategory };
            });
        }

        return NextResponse.json({
            restaurant: { ...restaurant, logo_url: logoUrl },
            menuId: menuId,
            categories: categories,
            items: items,
        });

    } catch (err) {
        console.error("Erro em creation-data API:", err);
        return NextResponse.json({ error: (err as Error).message }, { status: 500 });
    }
}