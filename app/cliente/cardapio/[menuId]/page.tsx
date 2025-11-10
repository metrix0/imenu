// app/cliente/cardapio/[menuId]/page.tsx
import { createClient } from "@supabase/supabase-js";
import MenuClientPage from "./menu-client";
import { Category, Item, ItemsByCategory, Menu, Restaurant } from "@/lib/types";
import { notFound } from "next/navigation";

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
 * Helper robusto para obter URL pública do storage.
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
        console.error("Erro ao chamar getPublicUrl via SDK, usando fallback:", err);
    }
    const supabaseUrlRaw = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
    const supabaseUrl = supabaseUrlRaw.replace(/\/$/, "");
    if (!supabaseUrl) return null;
    return `${supabaseUrl}/storage/v1/object/public/${bucket}/${normalized}`;
};

// Props: params é Promise no App Router
type Props = {
    params: Promise<{ menuId: string }>;
};

export default async function MenuPage({ params }: Props) {
    const { menuId } = await params;
    const supabase = createSupabaseServerClient();

    // Buscar menu
    const { data: menu, error: menuError } = await supabase
        .from("menu")
        .select("id, name, restaurant_id, banner_url, description")
        .eq("id", menuId)
        .maybeSingle();

    if (menuError || !menu) {
        console.error(`Erro ao buscar menu com ID: ${menuId}. Menu não encontrado.`, menuError);
        notFound();
    }

    // Buscar restaurante (logo)
    const { data: restaurantData, error: restErr } = await supabase
        .from("restaurants")
        .select("id, logo_url, name, description")
        .eq("id", menu.restaurant_id)
        .maybeSingle();

    if (restErr) {
        console.error("Erro ao buscar restaurante:", restErr);
    }

    // Gerar URLs públicas (banner e logo)
    const bannerUrl = getPublicUrl(supabase, "menu-banners", menu.banner_url);
    const logoUrl = getPublicUrl(supabase, "restaurant-logos", restaurantData?.logo_url);

    // Buscar categorias
    const { data: categoriesRaw, error: catErr } = await supabase
        .from("categories")
        .select("id, name, position")
        .eq("restaurant_id", menu.restaurant_id)
        .order("position", { ascending: true });

    const categories: Category[] = categoriesRaw ?? [];
    if (catErr) {
        console.error("Erro ao buscar categorias:", catErr);
    }

    // Buscar item ids do menu
    const { data: miRows, error: miErr } = await supabase
        .from("menu_items")
        .select("item_id")
        .eq("menu_id", menuId);

    if (miErr) {
        console.error("Erro ao buscar menu_items:", miErr);
        notFound();
    }

    const itemIds = (miRows || []).map((r: any) => r.item_id);
    let items: Item[] = [];

    if (itemIds.length > 0) {
        // Buscar detalhes dos itens
        const { data: itemsRaw, error: itemsErr } = await supabase
            .from("items")
            // **** CORREÇÃO AQUI: String em uma linha só ****
            .select(
                "id, name, description, price_cents, image_path, is_available, position, category:category_id(id, name, position)"
            )
            .in("id", itemIds)
            .eq("is_available", true)
            .order("position", { ascending: true });

        if (itemsErr) {
            console.error("Erro ao buscar detalhes dos itens:", itemsErr);
        }

        // Normalizar itens e gerar URL pública absoluta para imagem
        items = (itemsRaw || []).map((it: any) => {
            const cat = it.category;
            const normalizedCategory: Category | null = Array.isArray(cat)
                ? cat.length > 0
                    ? cat[0]
                    : null
                : cat ?? null;

            return {
                ...it,
                category: normalizedCategory,
                image_public_url: getPublicUrl(supabase, "menu-images", it.image_path),
            };
        });
    }

    // Agrupar por categoria
    const itemsByCategory: ItemsByCategory = {};
    for (const cat of categories) {
        itemsByCategory[cat.id] = [];
    }
    const uncategorizedKey = "_uncategorized";
    itemsByCategory[uncategorizedKey] = [];

    items.forEach((item) => {
        const catId = item.category?.id;
        if (catId && itemsByCategory[catId]) {
            itemsByCategory[catId].push(item);
        } else {
            itemsByCategory[uncategorizedKey].push(item);
        }
    });

    const categoriesWithItems = categories.filter(
        (cat) => (itemsByCategory[cat.id]?.length ?? 0) > 0
    );

    return (
        <MenuClientPage
            menu={{ ...menu, banner_url: bannerUrl }}
            restaurant={{ id: restaurantData?.id, logo_url: logoUrl }}
            categories={categoriesWithItems}
            itemsByCategory={itemsByCategory}
        />
    );
}