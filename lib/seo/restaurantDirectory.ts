import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { cities as municipalities, states } from "@/lib/api/brazilianMunicipalities";

const PAGE_SIZE = 1000;
const FALLBACK_CITY_SLUG = "outras-localidades";
const FALLBACK_CITY_NAME = "Outras localidades";

const STATE_CODES_BY_SLUG = new Map(
    states.flatMap(([code, name]) =>
        [code, name, code + " " + name].map(
            (label) => [slugify(label), code] as const
        )
    )
);
const MUNICIPAL_NAMES_BY_SLUG = new Map(
    municipalities.map(([name, state]) => [
        slugify(name) + "-" + slugify(state),
        name,
    ] as const)
);

type AddressData = {
    city?: unknown;
    state?: unknown;
};

export type PublicRestaurantDirectoryItem = {
    name: string;
    slug: string;
    updatedAt: string | null;
};

export type PublicRestaurantCity = {
    slug: string;
    name: string;
    state: string | null;
    updatedAt: string | null;
    restaurants: PublicRestaurantDirectoryItem[];
};

function text(value: unknown): string {
    return String(value ?? "").trim();
}

function getAddress(value: unknown): AddressData | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return null;
    }

    return value as AddressData;
}

function slugify(value: string): string {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLocaleLowerCase("pt-BR")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function getLatestDate(
    current: string | null,
    candidate: string | null
): string | null {
    if (!candidate) return current;
    if (!current || candidate > current) return candidate;
    return current;
}

function buildRestaurantDirectory(rows: unknown[]): PublicRestaurantCity[] {
    const groups = new Map<string, PublicRestaurantCity>();
    const seenRestaurantSlugs = new Set<string>();

    for (const value of rows) {
        if (!value || typeof value !== "object" || Array.isArray(value)) {
            continue;
        }

        const row = value as Record<string, unknown>;
        const restaurantName = text(row.name);
        const restaurantSlug = text(row.url_slug);

        if (
            !restaurantName ||
            !restaurantSlug ||
            seenRestaurantSlugs.has(restaurantSlug)
        ) {
            continue;
        }

        seenRestaurantSlugs.add(restaurantSlug);

        const address = getAddress(row.address);
        const state = STATE_CODES_BY_SLUG.get(slugify(text(address?.state))) ?? null;
        const citySlug = slugify(text(address?.city));
        const municipalitySlug = citySlug && state
            ? citySlug + "-" + slugify(state)
            : "";
        const municipality = MUNICIPAL_NAMES_BY_SLUG.get(municipalitySlug);
        const routeSlug = municipality ? municipalitySlug : FALLBACK_CITY_SLUG;
        const updatedAt =
            typeof row.updated_at === "string" ? row.updated_at : null;
        const existing = groups.get(routeSlug);

        if (existing) {
            existing.updatedAt = getLatestDate(
                existing.updatedAt,
                updatedAt
            );
            existing.restaurants.push({
                name: restaurantName,
                slug: restaurantSlug,
                updatedAt,
            });
            continue;
        }

        groups.set(routeSlug, {
            slug: routeSlug,
            name: municipality ?? FALLBACK_CITY_NAME,
            state: municipality ? state : null,
            updatedAt,
            restaurants: [
                {
                    name: restaurantName,
                    slug: restaurantSlug,
                    updatedAt,
                },
            ],
        });
    }

    return [...groups.values()]
        .map((city) => ({
            ...city,
            restaurants: city.restaurants.sort((first, second) =>
                first.name.localeCompare(second.name, "pt-BR")
            ),
        }))
        .sort((first, second) => {
            if (first.slug === FALLBACK_CITY_SLUG) return 1;
            if (second.slug === FALLBACK_CITY_SLUG) return -1;

            return (
                first.name.localeCompare(second.name, "pt-BR") ||
                text(first.state).localeCompare(text(second.state), "pt-BR")
            );
        });
}

async function loadRestaurantDirectory(): Promise<
    PublicRestaurantCity[]
> {
    const supabase = createSupabaseServerClient();
    const rows: unknown[] = [];

    for (let from = 0; ; from += PAGE_SIZE) {
        const { data, error } = await supabase
            .from("restaurants")
            .select("name, url_slug, address, updated_at")
            .eq("first_time", false)
            .not("url_slug", "is", null)
            .not("name", "is", null)
            .order("name", { ascending: true })
            .order("url_slug", { ascending: true })
            .range(from, from + PAGE_SIZE - 1);

        if (error) throw error;

        const batch: unknown[] = Array.isArray(data) ? data : [];
        rows.push(...batch);

        if (batch.length < PAGE_SIZE) break;
    }

    return buildRestaurantDirectory(rows);
}

export const getRestaurantDirectory = unstable_cache(
    loadRestaurantDirectory,
    ["public-restaurant-directory-v2"],
    { revalidate: 3600 }
);

export async function getRestaurantCityLinks(): Promise<
    Array<{
        slug: string;
        name: string;
        state: string | null;
        menuCount: number;
    }>
> {
    try {
        const cities = await getRestaurantDirectory();

        return cities.map((city) => ({
            slug: city.slug,
            name: city.name,
            state: city.state,
            menuCount: city.restaurants.length,
        }));
    } catch (error) {
        console.error(
            "[RESTAURANT_DIRECTORY] Failed to load city links:",
            error
        );
        return [];
    }
}
