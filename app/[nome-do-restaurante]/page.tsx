// app/[slug]/page.tsx
import { createClient } from "@supabase/supabase-js";
import MenuClientPage from "./menu-client"; // Importa o componente local
import { Category, Item, ItemsByCategory } from "@/lib/types";
import { notFound } from "next/navigation";

// (Os helpers createSupabaseServerClient, getRestaurantLogoUrl, e getPublicUrl 
// permanecem os mesmos que o Brendo escreveu no arquivo original)
const createSupabaseServerClient = () => {
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
        return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    }
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    }
    throw new Error("Missing Supabase configuration for server.");
};
const getRestaurantLogoUrl = (supabase: any, logoPath: string | null): string | null => {
    // ... (lógica do helper)
    const BUCKET = "restaurant-logos";
    if (!logoPath || typeof logoPath !== "string" || logoPath.trim() === "") return null;
    if (logoPath.startsWith("http://") || logoPath.startsWith("https://")) return logoPath;
    if (logoPath.startsWith("data:image")) return logoPath;
    try {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(logoPath);
        if (data?.publicUrl) return data.publicUrl;
    } catch (err) {}
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) return null;
    const normalized = String(logoPath).replace(/^\/+/, "").replace(/^public\//, "");
    const encoded = normalized.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${BUCKET}/${encoded}`;
};
const getPublicUrl = (supabase: any, bucket: string, path: string | null): string | null => {
    // ... (lógica do helper)
    if (!path || typeof path !== "string" || path.trim() === "") return null;
    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.startsWith("data:image")) return path;
    try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (data?.publicUrl) return data.publicUrl;
    } catch (err) {}
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) return null;
    const normalized = String(path).replace(/^\/+/, "").replace(/^public\//, "");
    const encoded = normalized.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
};

type Props = {
    params: { slug: string }; // Recebe 'slug' em vez de 'menuId'
};

export default async function MenuPage({ params }: Props) {
    const { slug } = await params;
    const supabase = createSupabaseServerClient();

    // 1. Buscar Restaurante pelo SLUG
    // (Presume que você tem as colunas 'rating' e 'min_order_cents' na tabela 'restaurants')
    const { data: restaurantData, error: restErr } = await supabase
        .from("restaurants")
        .select(
            "id, logo_url, name, description, prep_time_min_minutes, prep_time_max_minutes, prep_time_source, rating, min_order_cents"
        )
        .eq("url_slug", slug) // Busca pelo slug
        .maybeSingle();

    if (restErr || !restaurantData) {
        console.error(`Erro ao buscar restaurante com slug: ${slug}.`, restErr);
        notFound();
    }
    const restaurantId = restaurantData.id;

    // 2. Buscar o Menu ATIVO deste restaurante
    const { data: menu, error: menuError } = await supabase
        .from("menu")
        .select("id, name, banner_url, description, is_active")
        .eq("restaurant_id", restaurantId)
        .eq("is_active", true)
        .limit(1)
        .single();

    if (menuError || !menu) {
        console.error(`Nenhum menu ativo encontrado para o restaurante: ${restaurantId}.`, menuError);
        notFound();
    }
    const menuId = menu.id;

    // (O restante da lógica de busca (categorias, menu_items) é o mesmo)
    const bannerUrl = getPublicUrl(supabase, "menu-banners", menu.banner_url);
    const logoUrl = getRestaurantLogoUrl(supabase, restaurantData?.logo_url);
    
    const finalPrepMin = restaurantData?.prep_time_min_minutes ?? null;
    const finalPrepMax = restaurantData?.prep_time_max_minutes ?? null;
    const finalPrepSource = restaurantData?.prep_time_source ?? null;

    const { data: categoriesRaw, error: catErr } = await supabase
        .from("categories")
        .select("id, name, position")
        .eq("restaurant_id", restaurantId)
        .order("position", { ascending: true });
    
    if (catErr) console.error("Erro ao buscar categorias:", catErr);
    const categories: Category[] = categoriesRaw ?? [];

    const { data: miRows, error: miErr } = await supabase
        .from("menu_items")
        .select("item_id")
        .eq("menu_id", menuId);

    if (miErr) {
        console.error("Erro ao buscar menu_items:", miErr);
        notFound();
    }

    const itemIds = (miRows || []).map((r: any) => r.item_id);
    let allItems: Item[] = [];

    if (itemIds.length > 0) {
        const { data: itemsRaw, error: itemsErr } = await supabase
            .from("items")
            .select(
                "id, name, description, price_cents, image_path, is_available, position, category:category_id(id, name, position)"
            )
            .in("id", itemIds)
            .eq("is_available", true)
            .order("position", { ascending: true });

        if (itemsErr) console.error("Erro ao buscar itens:", itemsErr);

        allItems = (itemsRaw || []).map((it: any) => {
            const cat = it.category;
            const normalizedCategory = Array.isArray(cat) ? (cat.length > 0 ? cat[0] : null) : cat ?? null;
            return {
                ...it,
                category: normalizedCategory,
                image_public_url: getPublicUrl(supabase, "menu-images", it.image_path),
            };
        });
    }

    // --- 6. NOVO: Buscar Itens em Destaque ---
    // (Presume 'is_highlighted' e 'old_price_cents' na tabela 'items')
    const { data: highlightedItemsRaw } = await supabase
        .from("items")
        .select("id, name, description, price_cents, image_path, old_price_cents")
        .in("id", itemIds) // Apenas itens deste menu
        .eq("is_available", true)
        .eq("is_highlighted", true) // O filtro de "Destaque"
        .limit(10); 

    const highlightedItems: Item[] = (highlightedItemsRaw || []).map((it: any) => ({
        ...it,
        image_public_url: getPublicUrl(supabase, "menu-images", it.image_path),
    }));

    // (Agrupar itens por categoria - lógica do Brendo)
    const itemsByCategory: ItemsByCategory = {};
    for (const cat of categories) itemsByCategory[cat.id] = [];
    const uncategorizedKey = "_uncategorized";
    itemsByCategory[uncategorizedKey] = [];
    allItems.forEach((it) => {
        const catId = it.category?.id;
        if (catId && itemsByCategory[catId]) itemsByCategory[catId].push(it);
        else itemsByCategory[uncategorizedKey].push(it);
    });
    const categoriesWithItems = categories.filter(
        (cat) => (itemsByCategory[cat.id]?.length ?? 0) > 0
    );

    return (
        <MenuClientPage
            slug={slug} // Passa o slug
            menu={{ ...menu, banner_url: bannerUrl }}
            restaurant={{
                id: restaurantData.id,
                logo_url: logoUrl,
                prep_time_min_minutes: finalPrepMin,
                prep_time_max_minutes: finalPrepMax,
                prep_time_source: finalPrepSource,
                rating: restaurantData.rating, // Passa novo dado
                min_order_cents: restaurantData.min_order_cents, // Passa novo dado
            } as any}
            categories={categoriesWithItems}
            itemsByCategory={itemsByCategory}
            highlightedItems={highlightedItems} // Passa novo dado
        />
    );
}