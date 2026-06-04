// app/[slug]/page.tsx

import { notFound } from "next/navigation";
import MenuClientPage from "./menu-client";
import { Category, Item, ItemsByCategory, Menu, Restaurant } from "@/lib/types/types";
import TrackingScripts from "@/components/costumer/TrackingScripts";


import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { Metadata } from "next";
import { headers } from "next/headers";


const getPublicUrl = (supabase: any, bucket: string, path: string | null) => {
    if (!path) return null;
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    return data?.publicUrl || null;
};




export default async function Page({
                                       params,
                                       searchParams,
                                   }: {
    params: { slug: string };
    searchParams: { p?: string, c?: string };
}) {

    const { slug } = await params;
    const p = await searchParams;

    const supabase = createSupabaseServerClient();


    // --- 1. Restaurante ---
    const { data: restaurantData } = await supabase
        .from("restaurants")
        .select(
            "id, name, is_closed, logo_url, rating, min_order_cents, description, banner_url, availability_json,delivery_fee_json, latitude, longitude, allowed_payment_methods, tracking_integrations (ga4_id, gtm_id, meta_pixel_id)"
        )
        .eq("url_slug", slug)
        .maybeSingle();

    if (!restaurantData) return notFound();

    const restaurant: Restaurant = {
        id: restaurantData.id,
        name: restaurantData.name,
        logo_url: getPublicUrl(supabase, "restaurant-logos", restaurantData.logo_url),
        banner_url: getPublicUrl(supabase, "menu-banners", restaurantData.banner_url) || "/placeholders/banner.png",
        rating: restaurantData.rating,
        min_order_cents: restaurantData.min_order_cents,
        availability_json: restaurantData.availability_json,
        delivery_fee_json: restaurantData.delivery_fee_json,
        latitude: restaurantData.latitude,
        longitude: restaurantData.longitude,
        is_closed: restaurantData.is_closed,
        allowed_payment_methods: restaurantData.allowed_payment_methods,
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
        .from("items")
        .select("id")
        .eq("restaurant_id", restaurant.id);

    const itemIds = (menuItems || []).map((m) => m.id);

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

    const now = new Date().toISOString();

    const { data: promotions } = await supabase
        .from("promotions")
        .select("id,item_id , type, value, starts_at, ends_at")
        .eq("restaurant_id", restaurant.id)
        .lte("starts_at", now)
        .or(`ends_at.gte.${now},ends_at.is.null`);


// ======================
// ADD PROMOTIONS TO ITEMS
// ======================

    const promotionByItemId = new Map<string, any>();

    (promotions || []).forEach((promo) => {
        if (promo.item_id) {
            promotionByItemId.set(promo.item_id, promo);
        }
    });

    allItems = allItems.map((item) => ({
        ...item,
        promotion: promotionByItemId.get(item.id) ?? undefined,
    }));




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

    const tracking = restaurantData.tracking_integrations?.[0];

    console.log("slug")
    console.log(slug)

    const { data } = await supabase
        .from("restaurants")
        .select("name")
        .eq("url_slug", slug)
        .maybeSingle();


    return (
        <>
            <title>{data?.name ?? "Menu"}</title>
            {tracking && (
            <TrackingScripts
                ga4Id={tracking?.ga4_id}
                gtmId={tracking?.gtm_id}
                metaPixelId={tracking?.meta_pixel_id}
                enabled={tracking.ga4_id !== null || tracking.gtm_id !== null || tracking.meta_pixel_id !== null}
            />)}
            <MenuClientPage
                slug={slug}
                restaurant={restaurant}
                categories={categoriesWithItems}
                itemsByCategory={itemsByCategory}
                openedProductId={p.p}
                selectedCouponCode={p.c?.toUpperCase()}
            />
        </>


    );
}
