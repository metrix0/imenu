// app/api/restaurants/delete-restaurant/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL; // Usando NEXT_PUBLIC para consistência
const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in env");
}

// Usando o service role key
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);

// Adicionando esta linha se você usa App Router com caching
export const revalidate = 0;

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        // Adicionando userId para verificação de segurança, embora não seja estritamente necessário
        // já que o Service Role Key ignora RLS.
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
            // PGRST116: no rows found é um erro de REST, mas OK se queremos deletar.
            // Se o erro for outro, retornar 500
            if (restErr.code !== "PGRST116") {
                return NextResponse.json({ error: "Erro ao buscar restaurante", detail: restErr.message }, { status: 500 });
            }
        }

        if (!restaurant) {
            // Se o restaurante não foi encontrado, mas não houve erro, consideramos sucesso
            // ou retornamos um 404 (depende do caso de uso). No caso de exclusão, 404 é ok.
            return NextResponse.json({ success: true, message: "Restaurante já deletado ou não encontrado." });
        }

        // 1) Remover menus e banners
        // Modifiquei para um processo mais eficiente (sem loops for), assumindo
        // que as constraints de foreign key com ON DELETE CASCADE não estão em vigor.
        // Se estiverem, muito do código abaixo é redundante.

        // --- 1.1) Deletar Itens de Pedido Secundários ---
        const { data: orders } = await supabaseAdmin.from("orders").select("id").eq("restaurant_id", restaurantId);
        const orderIds = (orders || []).map((o: any) => o.id);
        if (orderIds.length) {
            const { data: orderItems } = await supabaseAdmin.from("order_items").select("id").in("order_id", orderIds);
            const orderItemIds = (orderItems || []).map((oi: any) => oi.id);
            if (orderItemIds.length) {
                // Deletar item_subitems (assumindo FK order_item_id)
                await supabaseAdmin.from("order_item_subitems").delete().in("order_item_id", orderItemIds);
            }
            // Deletar order_items
            await supabaseAdmin.from("order_items").delete().in("order_id", orderIds);
            // Deletar orders
            await supabaseAdmin.from("orders").delete().in("id", orderIds);
        }

        // --- 1.2) Deletar Itens, Categorias e suas dependências (Subitens, Media) ---
        const { data: items } = await supabaseAdmin.from("items").select("id").eq("restaurant_id", restaurantId);
        const itemIds = (items || []).map((i: any) => i.id);
        if (itemIds.length) {
            // item_media
            await supabaseAdmin.from("item_media").delete().in("item_id", itemIds);

            // subitems e item_subcategories
            const { data: subcats } = await supabaseAdmin.from("item_subcategories").select("id").in("item_id", itemIds);
            const subcatIds = (subcats || []).map((s: any) => s.id);
            if (subcatIds.length) {
                // subitems (assumindo FK item_subcategory_id)
                await supabaseAdmin.from("subitems").delete().in("item_subcategory_id", subcatIds);
                // item_subcategories
                await supabaseAdmin.from("item_subcategories").delete().in("id", subcatIds);
            }
            // excluir items
            await supabaseAdmin.from("items").delete().in("id", itemIds);
        }

        // --- 1.3) Deletar Menus e seus Banners
        const { data: menus } = await supabaseAdmin.from("menu").select("id, banner_url").eq("restaurant_id", restaurantId);
        for (const m of (menus || [])) {
            if (m.banner_url) {
                try {
                    await supabaseAdmin.storage.from("menu-banners").remove([m.banner_url]);
                } catch (err) {
                    console.warn("Falha ao remover banner do storage:", m.banner_url, err);
                }
            }
        }
        // Deletar menus (deve deletar categories se houver FK)
        await supabaseAdmin.from("menu").delete().eq("restaurant_id", restaurantId);


        // --- 1.4) Deletar categories ---
        // Adicionado novamente, caso as categories não sejam deletadas por FK em menu
        await supabaseAdmin.from("categories").delete().eq("restaurant_id", restaurantId);

        // --- 2) Remover logo do storage se existir ---
        if (restaurant.logo_url) {
            try {
                await supabaseAdmin.storage.from("restaurant-logos").remove([restaurant.logo_url]);
            } catch (err) {
                console.warn("Falha ao remover logo do storage:", restaurant.logo_url, err);
            }
        }

        // --- 3) Por fim, deletar o restaurante ---
        const { error: delErr } = await supabaseAdmin.from("restaurants").delete().eq("id", restaurantId);
        if (delErr) {
            console.error("Erro ao deletar restaurante:", delErr);
            return NextResponse.json({ error: "Erro ao deletar restaurante", detail: delErr.message }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (err: any) {
        console.error("delete-restaurant error:", err);
        return NextResponse.json({ error: String(err?.message ?? err), detail: err.message }, { status: 500 });
    }
}