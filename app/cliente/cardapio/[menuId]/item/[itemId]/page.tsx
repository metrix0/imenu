// app/cliente/cardapio/[menuId]/item/[itemId]/page.tsx
import { createClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { Item, Subcategory, Subitem, Category } from "@/lib/types";
import ItemClientPage from "./item-client";

/**
 * Helper para criar cliente Supabase (servidor)
 */
const createSupabaseServerClient = () => {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
};

/**
 * Helper robusto para obter URL pública do storage
 */
const getPublicUrl = (supabase: any, bucket: string, path: string | null) => {
    if (!path) return null;
    // 1. Se for um Data URI (Base64), retorne-o diretamente.
    if (typeof path === "string" && path.startsWith("data:image")) {
        return path;
    }
    // 2. já é uma URL completa?
    if (typeof path === "string" && (path.startsWith("http://") || path.startsWith("https://"))) {
        return path;
    }
    let normalized = String(path).replace(/^\/+/, "").replace(/^public\//, "");
    const bucketPrefix = `${bucket}/`;
    if (normalized.startsWith(bucketPrefix)) {
        normalized = normalized.slice(bucketPrefix.length);
    }
    normalized = encodeURI(normalized);
    try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(normalized);
        const publicUrl = data?.publicUrl;
        if (publicUrl && (publicUrl.startsWith("http://") || publicUrl.startsWith("https://"))) {
            return publicUrl;
        }
    } catch (err) {
        console.error("Erro getPublicUrl SDK:", err);
    }
    const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseUrl = supabaseUrlRaw.replace(/\/$/, "");
    if (!supabaseUrl) return null;
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${normalized}`;
};

type Props = {
    params: Promise<{ menuId: string; itemId: string }>;
};

export default async function ItemPage({ params }: Props) {
    const { menuId, itemId } = await params;
    const supabase = createSupabaseServerClient();

    // Buscar item
    const { data: itemRaw, error: itemErr } = await supabase
        .from("items")
        // **** CORREÇÃO AQUI: String em uma linha só ****
        .select(
            "id, name, description, price_cents, image_path, is_available, position, category:category_id(id, name, position)"
        )
        .eq("id", itemId)
        .maybeSingle();

    if (itemErr || !itemRaw || !itemRaw.is_available) {
        console.error(`Erro ao buscar item com ID: ${itemId}. Item não encontrado ou indisponível.`, itemErr);
        notFound();
    }

    // Normalizar categoria
    const cat = itemRaw.category;
    const normalizedCategory: Category | null = Array.isArray(cat) ? (cat.length > 0 ? cat[0] : null) : cat ?? null;

    const item = {
        ...itemRaw,
        category: normalizedCategory,
    };

    // Buscar subcategorias
    const { data: subcatsRaw, error: scErr } = await supabase
        .from("item_subcategories")
        .select("id, item_id, name, description, min_select, max_select, position")
        .eq("item_id", itemId)
        .order("position", { ascending: true });

    if (scErr) {
        console.error("Erro ao buscar subcategorias:", scErr);
    }

    const intermediateSubcategories = subcatsRaw ?? [];
    const subcatIds = intermediateSubcategories.map((sc) => sc.id);

    // Buscar subitens
    let subitems: Subitem[] = [];
    if (subcatIds.length > 0) {
        const { data: subsRaw, error: subsErr } = await supabase
            .from("subitems")
            .select("id, item_subcategory_id, name, description, price_cents, is_available, position")
            .in("item_subcategory_id", subcatIds)
            .eq("is_available", true)
            .order("position", { ascending: true });

        if (subsErr) {
            console.error("Erro ao buscar subitens:", subsErr);
        }
        subitems = subsRaw ?? [];
    }

    // Aninhar subitens nas subcategorias
    const subcategoriesWithItems: Subcategory[] = intermediateSubcategories.map((sc) => ({
        ...sc,
        subitems: subitems.filter((si) => si.item_subcategory_id === sc.id),
    }));

    // Obter URL da imagem (bucket menu-images)
    const itemWithImage: Item = {
        ...item,
        image_public_url: getPublicUrl(supabase, "menu-images", item.image_path),
    };

    return <ItemClientPage menuId={menuId} item={itemWithImage} subcategories={subcategoriesWithItems} />;
}