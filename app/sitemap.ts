import type { MetadataRoute } from "next";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

export const revalidate = 3600;

const SITE_URL = "https://www.imenuapp.com.br";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
    { url: `${SITE_URL}/`, priority: 1 },
    { url: `${SITE_URL}/cardapio-digital`, priority: 0.9 },
    { url: `${SITE_URL}/anota-ai`, priority: 0.8 },
    { url: `${SITE_URL}/cardapio-digital-gratuito`, priority: 0.8 },
    { url: `${SITE_URL}/saipos`, priority: 0.7 },
    { url: `${SITE_URL}/goomer`, priority: 0.7 },
    { url: `${SITE_URL}/gestor-de-pedidos`, priority: 0.7 },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    try {
        const supabase = createSupabaseServerClient();
        const { data, error } = await supabase
            .from("restaurants")
            .select("url_slug, updated_at")
            .eq("first_time", false)
            .not("url_slug", "is", null)
            .not("name", "is", null)
            .order("updated_at", { ascending: false });

        if (error) throw error;

        const staticUrls = new Set(STATIC_ROUTES.map((route) => route.url));
        const rows: unknown[] = Array.isArray(data) ? data : [];
        const restaurantRoutes: MetadataRoute.Sitemap = rows
            .map((value) =>
                value && typeof value === "object" && !Array.isArray(value)
                    ? (value as Record<string, unknown>)
                    : null
            )
            .filter((restaurant): restaurant is Record<string, unknown> =>
                Boolean(restaurant && restaurant.url_slug)
            )
            .map((restaurant) => ({
                url: `${SITE_URL}/${encodeURIComponent(
                    String(restaurant.url_slug)
                )}`,
                lastModified:
                    typeof restaurant.updated_at === "string"
                        ? restaurant.updated_at
                        : undefined,
                changeFrequency: "daily" as const,
                priority: 0.7,
            }))
            .filter((route) => !staticUrls.has(route.url));

        return [...STATIC_ROUTES, ...restaurantRoutes];
    } catch (error) {
        console.error("[SITEMAP] Failed to load restaurant pages:", error);
        return STATIC_ROUTES;
    }
}
