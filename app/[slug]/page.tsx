// app/[slug]/page.tsx

import { notFound } from "next/navigation";
import MenuClientPage from "./menu-client";
import { Category, Item, ItemsByCategory, Menu, Restaurant } from "@/lib/stores/types";

import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

const getPublicUrl = (supabase: any, bucket: string, path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
};

export default async function Page({ params }: { params: { slug: string } }) {
    const { slug } = await params;
    const supabase = createSupabaseServerClient();

    // --- 1. Restaurante ---
    const { data: restaurantData } = await supabase
        .from("restaurants")
        .select(
            "id, name, logo_url, rating, min_order_cents, prep_time_min_minutes, prep_time_max_minutes, description, banner_url, availability_json,delivery_fee_json, latitude, longitude"
        )
        .eq("url_slug", slug)
        .maybeSingle();

    if (!restaurantData) return notFound();

    const restaurant: Restaurant = {
        id: restaurantData.id,
        name: restaurantData.name,
        logo_url: getPublicUrl(supabase, "restaurant-logos", restaurantData.logo_url),
        banner_url: getPublicUrl(supabase, "menu-banners", restaurantData.banner_url) || "https://mjogdsnxbwhbqcoijrwt.supabase.co/storage/v1/object/public/menu-images/menu-images/menu_banner_placeholder.png",
        rating: restaurantData.rating,
        min_order_cents: restaurantData.min_order_cents,
        prep_time_min_minutes: restaurantData.prep_time_min_minutes,
        prep_time_max_minutes: restaurantData.prep_time_max_minutes,
        availability_json: restaurantData.availability_json,
        delivery_fee_json: restaurantData.delivery_fee_json,
        latitude: restaurantData.latitude,
        longitude: restaurantData.longitude
    };

    // --- 2. Menu ativo ---
    const { data: menuData } = await supabase
        .from("menu")
        .select("id, name, description")
        .eq("restaurant_id", restaurant.id)
        .eq("is_active", true)
        .limit(1)
        .single<Menu>();


    if (!menuData) return notFound();


    const menu: Menu = {
        ...menuData
    };

    // --- 3. Categorias ---
    const { data: categoriesRaw } = await supabase
        .from("categories")
        .select("id, name, position")
        .eq("restaurant_id", restaurant.id)
        .order("position", { ascending: true });

    const categories: Category[] = categoriesRaw || [];


    // --- 4. Itens do Menu ---
    const { data: menuItems } = await supabase
        .from("menu_items")
        .select("item_id")
        .eq("menu_id", menu.id);

    const itemIds = (menuItems || []).map((m) => m.item_id);

    let allItems: Item[] = [];
    if (itemIds.length > 0) {
        const { data: itemsRaw } = await supabase
            .from("items")
            .select(
                "id, name, description, price_cents, image_path, is_available, position, category:category_id(id, name, position)"
            )
            .in("id", itemIds)
            .eq("is_available", true)
            .order("position", { ascending: true });

        allItems =
            itemsRaw?.map((it: any) => ({
                ...it,
                image_public_url: getPublicUrl(supabase, "menu-images", it.image_path),
            })) || [];
    }

    // --- 5. Group Items by Category ---

    const itemsByCategory: ItemsByCategory = {};
    for (const cat of categories) itemsByCategory[cat.id] = [];
    const uncategorized = "_uncategorized";
    itemsByCategory[uncategorized] = [];

    allItems.forEach((it) => {
        const cid = it?.category?.id;
        if (cid && itemsByCategory[cid]) itemsByCategory[cid].push(it);
        else itemsByCategory[uncategorized].push(it);
    });

    const categoriesWithItems = categories.filter(
        (c) => (itemsByCategory[c.id]?.length ?? 0) > 0
    );


    return (
        <MenuClientPage
            slug={slug}
            restaurant={restaurant}
            menu={menu}
            categories={categoriesWithItems}
            itemsByCategory={itemsByCategory}
        />
    );
}
