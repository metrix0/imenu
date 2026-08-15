import type { MetadataRoute } from "next";
import { getRestaurantDirectory } from "@/lib/seo/restaurantDirectory";
import {
    getRestaurantToolPath,
    RESTAURANT_TOOLS,
} from "@/lib/seo/restaurantTools";
import {
    BLOG_ARTICLES,
    getBlogArticlePath,
} from "@/lib/seo/blogArticles";

export const revalidate = 3600;

const SITE_URL = "https://www.imenuapp.com.br";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
    { url: SITE_URL + "/", priority: 1 },
    { url: SITE_URL + "/cardapio-digital", priority: 0.9 },
    { url: SITE_URL + "/anota-ai", priority: 0.8 },
    { url: SITE_URL + "/cardapio-digital-gratuito", priority: 0.8 },
    { url: SITE_URL + "/saipos", priority: 0.7 },
    { url: SITE_URL + "/goomer", priority: 0.7 },
    { url: SITE_URL + "/gestor-de-pedidos", priority: 0.7 },
    {
        url: SITE_URL + "/blog",
        changeFrequency: "weekly",
        priority: 0.9,
    },
    ...BLOG_ARTICLES.map((article) => ({
        url: SITE_URL + getBlogArticlePath(article.slug),
        lastModified: article.updatedAt,
        changeFrequency: "monthly" as const,
        priority: 0.8,
    })),
    {
        url: SITE_URL + "/ferramentas",
        changeFrequency: "weekly",
        priority: 0.9,
    },
    ...RESTAURANT_TOOLS.map((tool) => ({
        url: SITE_URL + getRestaurantToolPath(tool.slug),
        changeFrequency: "monthly" as const,
        priority: 0.8,
    })),
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
    try {
        const cities = await getRestaurantDirectory();
        const staticUrls = new Set(
            STATIC_ROUTES.map((route) => route.url)
        );

        const cityRoutes: MetadataRoute.Sitemap = cities.map((city) => ({
            url:
                SITE_URL +
                "/restaurantes/" +
                encodeURIComponent(city.slug),
            lastModified: city.updatedAt || undefined,
            changeFrequency: "daily" as const,
            priority: 0.8,
        }));

        const restaurantRoutes: MetadataRoute.Sitemap = cities.flatMap(
            (city) =>
                city.restaurants.map((restaurant) => ({
                    url:
                        SITE_URL +
                        "/" +
                        encodeURIComponent(restaurant.slug),
                    lastModified: restaurant.updatedAt || undefined,
                    changeFrequency: "daily" as const,
                    priority: 0.7,
                }))
        );

        const seenUrls = new Set(staticUrls);
        const publicRoutes = [...cityRoutes, ...restaurantRoutes].filter(
            (route) => {
                if (seenUrls.has(route.url)) return false;
                seenUrls.add(route.url);
                return true;
            }
        );

        return [...STATIC_ROUTES, ...publicRoutes];
    } catch (error) {
        console.error(
            "[SITEMAP] Failed to load restaurant directory:",
            error
        );
        return STATIC_ROUTES;
    }
}
