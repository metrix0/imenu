import { cache } from "react";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

// Shared within a render request by the menu and its SEO metadata.
export const getPublicMenuRestaurant = cache(async (slug: string) => {
    // File requests such as favicon.ico, apple-touch-icon.png and .well-known
    // are not restaurant slugs and must not query the database.
    if (slug.includes(".")) return null;

    const supabase = createSupabaseServerClient();
    const { data, error } = await supabase
        .from("restaurants")
        .select(
            "id, name, is_closed, logo_url, rating, min_order_cents, description, banner_url, availability_json,delivery_fee_json, delivery_fee_mode, delivery_neighborhood_fee_json, latitude, longitude, allowed_payment_methods, address, store_whatsapp, pickup_enabled, force_whatsapp_order_confirmation, allow_future_order_scheduling, automatic_promotions, pizza_settings, first_time, vitrine_enabled"
        )
        .eq("url_slug", slug)
        .maybeSingle();

    if (error) {
        console.error("[RESTAURANT_SEO] Failed to load restaurant:", error);
        return undefined;
    }

    return data;
});
