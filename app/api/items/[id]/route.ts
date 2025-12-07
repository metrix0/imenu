// app/api/items/[id]/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextResponse, NextRequest } from "next/server";
import { Item, Subcategory, Subitem, Category } from "@/lib/types/types";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";


const getPublicUrl = (supabase: any, bucket: string, path: string | null) => {
    if (!path) return null;
    if (path.startsWith("http") || path.startsWith("data:image")) return path;
    try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        return data?.publicUrl ?? null;
    } catch (err) {
        return null;
    }
};

export async function GET(
    request: NextRequest,
    context: { params: { id: string } }
) {
    const { id } = context.params;
    if (!id) {
        return NextResponse.json({ error: "Item ID is required" }, { status: 400 });
    }
    
    const supabase = createSupabaseServerClient();

    try {
        // --- 1. CORREÇÃO NA QUERY DO ITEM ---
        // Adicionado 'position' e 'category'
        const { data: itemRaw, error: itemErr } = await supabase
            .from("items")
            .select(
                "id, name, description, price_cents, image_path, is_available, position, category:category_id(id, name, position)"
            )
            .eq("id", id)
            .maybeSingle();

        if (itemErr || !itemRaw) {
            return NextResponse.json({ error: "Item not found" }, { status: 404 });
        }

        // --- 2. NORMALIZAÇÃO DA CATEGORIA ---
        // (Baseado no código do Brendo, isso é necessário)
        const cat = itemRaw.category;
        const normalizedCategory: Category | null = Array.isArray(cat)
            ? (cat.length > 0 ? cat[0] : null)
            : (cat ?? null);
        // --- FIM DA NORMALIZAÇÃO ---

        // (Busca de subcategorias - sem mudança)
        const { data: subcatsRaw, error: scErr } = await supabase
            .from("item_subcategories")
            .select("id, item_id, name, description, min_select, max_select, position")
            .eq("item_id", id)
            .order("position", { ascending: true });

        if (scErr) throw scErr;
        const intermediateSubcategories = subcatsRaw ?? [];
        const subcatIds = intermediateSubcategories.map((sc) => sc.id);

        // (Busca de subitens - sem mudança)
        let subitems: Subitem[] = [];
        if (subcatIds.length > 0) {
            const { data: subsRaw, error: subsErr } = await supabase
                .from("subitems")
                .select("id, item_subcategory_id, name, description, price_cents, is_available, position")
                .in("item_subcategory_id", subcatIds)
                .eq("is_available", true)
                .order("position", { ascending: true });
            
            if (subsErr) throw subsErr;
            subitems = subsRaw ?? [];
        }

        // (Aninhar subitens - sem mudança)
        const subcategoriesWithItems: Subcategory[] = intermediateSubcategories.map((sc) => ({
            ...sc,
            subitems: subitems.filter((si) => si.item_subcategory_id === sc.id),
        }));

        // --- 3. CRIAÇÃO CORRETA DO OBJETO 'Item' ---
        // Agora 'itemRaw' tem 'position' e 'category' foi normalizado
        const itemWithImage: Item = {
            ...itemRaw,
            category: normalizedCategory, // Sobrescreve a categoria
            image_public_url: getPublicUrl(supabase, "menu-images", itemRaw.image_path),
        };
        // --- FIM DA CORREÇÃO ---

        // 6. Retornar o pacote de dados completo
        return NextResponse.json({
            item: itemWithImage,
            subcategories: subcategoriesWithItems
        });

    } catch (error) {
        console.error("Erro ao buscar detalhes do item:", error);
        return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 });
    }
}