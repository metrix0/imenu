import { createClient } from "@supabase/supabase-js";
import MenuClientPage from "./menu-client";
import { Category, Item, ItemsByCategory } from "@/lib/types";
import { notFound } from "next/navigation";

/** Cria cliente Supabase server-side (usa SERVICE ROLE se disponível para evitar RLS) */
const createSupabaseServerClient = () => {
    // prefira a URL e a chave de serviço no servidor
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
        // uso seguro do service role no servidor
        return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    }

    // fallback: usa client público (pode falhar se houver RLS)
    if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.warn(
            "[supabase] Service role not configured; using anon key. If restaurants queries return null, set SUPABASE_SERVICE_ROLE_KEY."
        );
        return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
    }

    throw new Error("Missing Supabase configuration for server. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.");
};

/**
 * Retorna URL pública da LOGO do restaurante.
 * Usa o bucket `restaurant-logos` e lida tanto com caminhos relativos quanto URLs completas.
 */
const getRestaurantLogoUrl = (supabase: any, logoPath: string | null): string | null => {
    const BUCKET = "restaurant-logos";
    if (!logoPath || typeof logoPath !== "string" || logoPath.trim() === "") return null;

    // Se for uma URL completa
    if (logoPath.startsWith("http://") || logoPath.startsWith("https://")) return logoPath;

    // Se for data URI
    if (logoPath.startsWith("data:image")) return logoPath;

    try {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(logoPath);
        const publicUrl = data?.publicUrl;
        if (publicUrl) return publicUrl;
    } catch (err) {
        console.error("Erro ao gerar URL pública da logo (supabase):", err);
    }

    // Fallback manual: monta a URL pública garantindo encoding dos segmentos do path
    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) return null;
    const normalized = String(logoPath).replace(/^\/+/, "").replace(/^public\//, "");
    const encoded = normalized.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${BUCKET}/${encoded}`;
};

/**
 * Retorna URL pública de imagens genéricas (itens, banners, etc)
 */
const getPublicUrl = (supabase: any, bucket: string, path: string | null): string | null => {
    if (!path || typeof path !== "string" || path.trim() === "") return null;

    if (path.startsWith("http://") || path.startsWith("https://")) return path;
    if (path.startsWith("data:image")) return path;

    try {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        const publicUrl = data?.publicUrl;
        if (publicUrl) return publicUrl;
    } catch (err) {
        console.error(`Erro ao gerar URL pública (supabase, bucket=${bucket}):`, err);
    }

    const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
    if (!baseUrl) return null;
    const normalized = String(path).replace(/^\/+/, "").replace(/^public\//, "");
    const encoded = normalized.split("/").map(encodeURIComponent).join("/");
    return `${baseUrl}/storage/v1/object/public/${bucket}/${encoded}`;
};

// Props do App Router
type Props = {
    params: Promise<{ menuId: string }>;
};

export default async function MenuPage({ params }: Props) {
    const { menuId } = await params;
    const supabase = createSupabaseServerClient();

    // Buscar menu
    const { data: menu, error: menuError } = await supabase
        .from("menu")
        .select("id, name, restaurant_id, banner_url, description, is_active")
        .eq("id", menuId)
        .maybeSingle();

    if (menuError || !menu) {
        console.error(`Erro ao buscar menu ${menuId}:`, menuError);
        notFound();
    }

    // log do menu completo para debug (mostra restaurant_id que foi retornado)
    console.log("DEBUG menu fetched:", menu);

    if (!menu.is_active) {
        notFound();
    }

    // Buscar restaurante (inclui campos de tempo de preparo e estimated_* como fallback)
    const { data: restaurantData, error: restErr } = await supabase
        .from("restaurants")
        .select(
            "id, logo_url, name, description, prep_time_min_minutes, prep_time_max_minutes, prep_time_source, prep_time_computed_at"
        )
        .eq("id", menu.restaurant_id)
        .maybeSingle();

    // debug adicional: log do id que usamos para buscar restaurante
    console.log("DEBUG restaurant_id used:", menu.restaurant_id);
    console.log("DEBUG restaurantData raw:", restaurantData, "restErr:", restErr);

    if (restErr) {
        console.error("Erro ao buscar restaurante:", restErr);
    }

    // Corrigido — funções específicas
    const bannerUrl = getPublicUrl(supabase, "menu-banners", menu.banner_url);
    const logoUrl = getRestaurantLogoUrl(supabase, restaurantData?.logo_url);

    // Decide valores finais de prep time: preferir prep_time_*; usar estimated_* como fallback
    const finalPrepMin = restaurantData?.prep_time_min_minutes ?? null;
    const finalPrepMax = restaurantData?.prep_time_max_minutes ?? null;
    const finalPrepSource = restaurantData?.prep_time_source ?? null;

    console.log("✅ logoUrl resolvida:", logoUrl);

    // Buscar categorias
    const { data: categoriesRaw, error: catErr } = await supabase
        .from("categories")
        .select("id, name, position")
        .eq("restaurant_id", menu.restaurant_id)
        .order("position", { ascending: true });

    if (catErr) console.error("Erro ao buscar categorias:", catErr);
    const categories: Category[] = categoriesRaw ?? [];

    // Buscar menu_items
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
        const { data: itemsRaw, error: itemsErr } = await supabase
            .from("items")
            .select(
                "id, name, description, price_cents, image_path, is_available, position, category:category_id(id, name, position)"
            )
            .in("id", itemIds)
            .eq("is_available", true)
            .order("position", { ascending: true });

        if (itemsErr) console.error("Erro ao buscar itens:", itemsErr);

        items = (itemsRaw || []).map((it: any) => {
            const cat = it.category;
            const normalizedCategory = Array.isArray(cat)
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
    for (const cat of categories) itemsByCategory[cat.id] = [];
    const uncategorizedKey = "_uncategorized";
    itemsByCategory[uncategorizedKey] = [];

    items.forEach((it) => {
        const catId = it.category?.id;
        if (catId && itemsByCategory[catId]) itemsByCategory[catId].push(it);
        else itemsByCategory[uncategorizedKey].push(it);
    });

    const categoriesWithItems = categories.filter(
        (cat) => (itemsByCategory[cat.id]?.length ?? 0) > 0
    );

    return (
        <MenuClientPage
            menu={{ ...menu, banner_url: bannerUrl }}
            restaurant={{
                id: restaurantData?.id,
                logo_url: logoUrl,
                prep_time_min_minutes: finalPrepMin,
                prep_time_max_minutes: finalPrepMax,
                prep_time_source: finalPrepSource,
            } as any}
            debugRestaurantId={menu.restaurant_id ?? null}
            debugRestaurantRaw={restaurantData ?? null}
            categories={categoriesWithItems}
            itemsByCategory={itemsByCategory}
        />
    );
}
