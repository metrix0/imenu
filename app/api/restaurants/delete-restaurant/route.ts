import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { restaurantId } = body;
        if (!restaurantId) return NextResponse.json({ error: "restaurantId is required" }, { status: 400 });

        // carregar restaurante (logo)
        const { data: restaurant, error: restErr } = await supabaseAdmin
            .from("restaurants")
            .select("id, logo_url")
            .eq("id", restaurantId)
            .maybeSingle();

        if (restErr) {
            console.error("Erro ao buscar restaurante:", restErr);
            return NextResponse.json({ error: "Erro ao buscar restaurante", detail: restErr.message }, { status: 500 });
        }

        // 1) Remover menus e banners
        const { data: menus } = await supabaseAdmin.from("menu").select("id, banner_url").eq("restaurant_id", restaurantId);
        const menuIds = (menus || []).map((m: any) => m.id);
        for (const m of (menus || [])) {
            if (m.banner_url) {
                try {
                    await supabaseAdmin.storage.from("menu-banners").remove([m.banner_url]);
                } catch (err) {
                    console.warn("Falha ao remover banner do storage:", m.banner_url, err);
                }
            }
            // apagar menu_items vinculados
            await supabaseAdmin.from("menu_items").delete().eq("menu_id", m.id);
            // apagar menu
            await supabaseAdmin.from("menu").delete().eq("id", m.id);
        }

        // 2) Remover orders relacionados (order_item_subitems -> order_items -> orders)
        const { data: orders } = await supabaseAdmin.from("orders").select("id").eq("restaurant_id", restaurantId);
        const orderIds = (orders || []).map((o: any) => o.id);
        if (orderIds.length) {
            const { data: orderItems } = await supabaseAdmin.from("order_items").select("id").in("order_id", orderIds);
            const orderItemIds = (orderItems || []).map((oi: any) => oi.id);
            if (orderItemIds.length) {
                await supabaseAdmin.from("order_item_subitems").delete().in("order_item_id", orderItemIds);
                await supabaseAdmin.from("order_items").delete().in("id", orderItemIds);
            }
            await supabaseAdmin.from("orders").delete().in("id", orderIds);
        }

        // 3) Remover items e suas estruturas (item_media, item_subcategories, subitems)
        const { data: items } = await supabaseAdmin.from("items").select("id").eq("restaurant_id", restaurantId);
        const itemIds = (items || []).map((i: any) => i.id);
        if (itemIds.length) {
            // item_media
            await supabaseAdmin.from("item_media").delete().in("item_id", itemIds);
            // item_subcategories -> subitems
            const { data: subcats } = await supabaseAdmin.from("item_subcategories").select("id").in("item_id", itemIds);
            const subcatIds = (subcats || []).map((s: any) => s.id);
            if (subcatIds.length) {
                await supabaseAdmin.from("subitems").delete().in("item_subcategory_id", subcatIds);
                await supabaseAdmin.from("item_subcategories").delete().in("id", subcatIds);
            }
            // excluir items
            await supabaseAdmin.from("items").delete().in("id", itemIds);
        }

        // 4) Remover categories
        await supabaseAdmin.from("categories").delete().eq("restaurant_id", restaurantId);

        // 5) Remover outros relacionamentos que possam existir (menu_items já removidos acima)
        // (Se existirem outras tabelas relacionadas, adicionar aqui)

        // 6) Remover logo do storage se existir
        if (restaurant?.logo_url) {
            try {
                await supabaseAdmin.storage.from("restaurant-logos").remove([restaurant.logo_url]);
            } catch (err) {
                console.warn("Falha ao remover logo do storage:", restaurant.logo_url, err);
            }
        }

        // 7) Por fim, deletar o restaurante
        const { error: delErr } = await supabaseAdmin.from("restaurants").delete().eq("id", restaurantId);
        if (delErr) {
            console.error("Erro ao deletar restaurante:", delErr);
            return NextResponse.json({ error: "Erro ao deletar restaurante", detail: delErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("delete-restaurant error:", err);
        return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
    }
}
