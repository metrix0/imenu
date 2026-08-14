import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";

const PAGE_SIZE = 1000;
const FALLBACK_CITY_SLUG = "outras-localidades";
const FALLBACK_CITY_NAME = "Outras localidades";

const STATE_ALIASES: Record<string, string> = {
    acre: "AC",
    alagoas: "AL",
    amapa: "AP",
    amazonas: "AM",
    bahia: "BA",
    ceara: "CE",
    "distrito-federal": "DF",
    "espirito-santo": "ES",
    goias: "GO",
    maranhao: "MA",
    "mato-grosso": "MT",
    "mato-grosso-do-sul": "MS",
    "minas-gerais": "MG",
    para: "PA",
    paraiba: "PB",
    parana: "PR",
    pernambuco: "PE",
    piaui: "PI",
    "rio-de-janeiro": "RJ",
    "rio-grande-do-norte": "RN",
    "rio-grande-do-sul": "RS",
    rondonia: "RO",
    roraima: "RR",
    "santa-catarina": "SC",
    "sao-paulo": "SP",
    sergipe: "SE",
    tocantins: "TO",
};

const STATE_CODES: ReadonlySet<string> = new Set(
    Object.values(STATE_ALIASES)
);

const LOWERCASE_CITY_WORDS: ReadonlySet<string> = new Set([
    "da",
    "das",
    "de",
    "do",
    "dos",
    "e",
]);

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

type MutableRestaurantCity = PublicRestaurantCity & {
    cityNameScore: number;
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

function normalizeState(value: unknown): string | null {
    const rawState = text(value);
    if (!rawState) return null;

    const upperState = rawState.toUpperCase();
    if (STATE_CODES.has(upperState)) return upperState;

    const leadingCode = upperState.match(/^([A-Z]{2})(?:\s|[-–—])/);
    if (leadingCode && STATE_CODES.has(leadingCode[1])) {
        return leadingCode[1];
    }

    return STATE_ALIASES[slugify(rawState)] || upperState;
}

function formatCityName(value: string): string {
    let wordIndex = 0;

    return value
        .toLocaleLowerCase("pt-BR")
        .split(/([\s-]+)/)
        .map((part) => {
            if (!part || /^[\s-]+$/.test(part)) return part;

            const isFirstWord = wordIndex === 0;
            wordIndex += 1;

            if (!isFirstWord && LOWERCASE_CITY_WORDS.has(part)) {
                return part;
            }

            return part.charAt(0).toLocaleUpperCase("pt-BR") + part.slice(1);
        })
        .join("");
}

function getCityNameScore(value: string): number {
    return (
        value.normalize("NFD").match(/[\u0300-\u036f]/g)?.length || 0
    );
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
    const groups = new Map<string, MutableRestaurantCity>();
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
        const rawCityName = text(address?.city);
        const normalizedState = normalizeState(address?.state);
        const citySlug = slugify(rawCityName);
        const routeSlug = citySlug
            ? citySlug +
              (normalizedState ? "-" + slugify(normalizedState) : "")
            : FALLBACK_CITY_SLUG;
        const formattedCityName = citySlug
            ? formatCityName(rawCityName)
            : FALLBACK_CITY_NAME;
        const cityNameScore = getCityNameScore(rawCityName);
        const updatedAt =
            typeof row.updated_at === "string" ? row.updated_at : null;
        const existing = groups.get(routeSlug);

        if (existing) {
            if (cityNameScore > existing.cityNameScore) {
                existing.name = formattedCityName;
                existing.cityNameScore = cityNameScore;
            }

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
            name: formattedCityName,
            state: citySlug ? normalizedState : null,
            updatedAt,
            restaurants: [
                {
                    name: restaurantName,
                    slug: restaurantSlug,
                    updatedAt,
                },
            ],
            cityNameScore,
        });
    }

    return [...groups.values()]
        .map(({ cityNameScore: _cityNameScore, ...city }) => ({
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
    ["public-restaurant-directory-v1"],
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
