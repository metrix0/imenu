// app/api/menu/delete-menu/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    // garantimos erro claro se env não configurada
    throw new Error("Missing SUPABASE config on server for delete-menu route");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { menuId } = body;
        if (!menuId) return NextResponse.json({ error: "menuId is required" }, { status: 400 });

        // buscar menu e restaurant
        const { data: menu, error: menuErr } = await supabaseAdmin
            .from("menu")
            .select("id, restaurant_id, banner_url")
            .eq("id", menuId)
            .single();

        if (menuErr || !menu) {
            return NextResponse.json({ error: "Menu not found", detail: menuErr?.message }, { status: 404 });
        }

        const restaurantId = menu.restaurant_id;

        // 1) Apagar ligações de menu_items (vinculadas ao menu)
        const { error: miErr } = await supabaseAdmin.from("menu_items").delete().eq("menu_id", menuId);
        if (miErr) console.error("Erro ao deletar menu_items:", miErr);

        // 2) Remover pedidos relacionados ao restaurante
        const { data: orders } = await supabaseAdmin.from("orders").select("id").eq("restaurant_id", restaurantId);
        const orderIds = (orders || []).map((o: any) => o.id);

        if (orderIds.length) {
            // buscar order_items relacionados às orders
            const { data: orderItems } = await supabaseAdmin.from("order_items").select("id").in("order_id", orderIds);
            const orderItemIds = (orderItems || []).map((oi: any) => oi.id);

            if (orderItemIds.length) {
                const { error: oisErr } = await supabaseAdmin.from("order_item_subitems").delete().in("order_item_id", orderItemIds);
                if (oisErr) console.error("Erro ao deletar order_item_subitems:", oisErr);

                const { error: oiErr } = await supabaseAdmin.from("order_items").delete().in("id", orderItemIds);
                if (oiErr) console.error("Erro ao deletar order_items:", oiErr);
            }

            const { error: ordersErr } = await supabaseAdmin.from("orders").delete().in("id", orderIds);
            if (ordersErr) console.error("Erro ao deletar orders:", ordersErr);
        }

        // 3) Itens e sub-estruturas do restaurante
        const { data: items } = await supabaseAdmin.from("items").select("id").eq("restaurant_id", restaurantId);
        const itemIds = (items || []).map((i: any) => i.id);
        if (itemIds.length) {
            const { error: mediaErr } = await supabaseAdmin.from("item_media").delete().in("item_id", itemIds);
            if (mediaErr) console.error("Erro ao deletar item_media:", mediaErr);

            const { data: subcats } = await supabaseAdmin.from("item_subcategories").select("id").in("item_id", itemIds);
            const subcatIds = (subcats || []).map((s: any) => s.id);
            if (subcatIds.length) {
                const { error: subitemsErr } = await supabaseAdmin.from("subitems").delete().in("item_subcategory_id", subcatIds);
                if (subitemsErr) console.error("Erro ao deletar subitems:", subitemsErr);

                const { error: subcatsErr } = await supabaseAdmin.from("item_subcategories").delete().in("id", subcatIds);
                if (subcatsErr) console.error("Erro ao deletar item_subcategories:", subcatsErr);
            }

            const { error: itemsErr } = await supabaseAdmin.from("items").delete().in("id", itemIds);
            if (itemsErr) console.error("Erro ao deletar items:", itemsErr);
        }

        // 4) categories do restaurante
        const { error: catsErr } = await supabaseAdmin.from("categories").delete().eq("restaurant_id", restaurantId);
        if (catsErr) console.error("Erro ao deletar categories:", catsErr);

        // 5) remover o próprio menu (e banner)
        if (menu.banner_url) {
            try {
                await supabaseAdmin.storage.from("menu-banners").remove([menu.banner_url]);
            } catch (remErr) {
                console.error("Erro ao remover banner do storage:", remErr);
            }
        }
        const { error: menuDelErr } = await supabaseAdmin.from("menu").delete().eq("id", menuId);
        if (menuDelErr) {
            console.error("Erro ao deletar menu:", menuDelErr);
            return NextResponse.json({ error: "Erro ao deletar menu", detail: menuDelErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("delete-menu error:", err);
        return NextResponse.json({ error: String(err?.message ?? err) }, { status: 500 });
    }
}
