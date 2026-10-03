import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type MerchantRow = {
    id: string;
    name: string | null;
    url_slug: string | null;
    city: string | null;
    state: string | null;
    orders_30d: number | string;
    gmv_30d_cents: number | string;
};

type IbgeMunicipality = { id: number; nome: string };
type GeoGeometry = {
    type: "Polygon" | "MultiPolygon";
    coordinates: number[][][] | number[][][][];
};
type GeoFeature = {
    type: "Feature";
    properties?: Record<string, unknown>;
    geometry: GeoGeometry;
};
type GeoFeatureCollection = {
    type: "FeatureCollection";
    features: GeoFeature[];
};
type SidraRow = Record<string, string>;

function getBearerToken(request: Request): string | null {
    return (
        request.headers
            .get("authorization")
            ?.trim()
            .match(/^Bearer\s+(.+)$/i)?.[1]
            ?.trim() || null
    );
}

function getSupabasePublicConfig() {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim();
    const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) {
        throw new Error("Supabase public environment variables are missing.");
    }

    return { url, anonKey };
}

async function authorize(request: Request): Promise<NextResponse | null> {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { url, anonKey } = getSupabasePublicConfig();
    const authClient = createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });
    const {
        data: { user },
        error,
    } = await authClient.auth.getUser(accessToken);

    if (error || !user) {
        return NextResponse.json(
            { error: "Sessão inválida ou expirada." },
            { status: 401 }
        );
    }

    if (user.email?.trim().toLowerCase() !== ALLOWED_DEV_EMAIL) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    return null;
}

function normalize(value: string | null | undefined): string {
    return (value || "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLowerCase();
}

function isPernambuco(value: string | null): boolean {
    const state = normalize(value);
    return state === "pe" || state === "pernambuco";
}

function numeric(value: number | string | null | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function featureCode(feature: GeoFeature): string {
    const properties = feature.properties || {};
    return String(
        properties.codarea ??
            properties.id ??
            properties.CD_MUN ??
            properties.CD_MUN_7 ??
            ""
    ).trim();
}

async function loadIbge() {
    const [municipalitiesResponse, meshResponse, populationResponse] =
        await Promise.all([
            fetch(
                "https://servicodados.ibge.gov.br/api/v1/localidades/estados/26/municipios",
                { next: { revalidate: 86400 } }
            ),
            fetch(
                "https://servicodados.ibge.gov.br/api/v3/malhas/estados/PE?intrarregiao=municipio&qualidade=minima",
                {
                    headers: { Accept: "application/vnd.geo+json" },
                    next: { revalidate: 86400 },
                }
            ),
            fetch(
                "https://apisidra.ibge.gov.br/values/t/6579/n6/in%20n3%2026/v/9324/p/last?formato=json",
                { next: { revalidate: 86400 } }
            ),
        ]);

    if (
        !municipalitiesResponse.ok ||
        !meshResponse.ok ||
        !populationResponse.ok
    ) {
        throw new Error("Não foi possível carregar os dados municipais do IBGE.");
    }

    const municipalities =
        (await municipalitiesResponse.json()) as IbgeMunicipality[];
    const mesh = (await meshResponse.json()) as GeoFeatureCollection;
    const populationRows = (await populationResponse.json()) as SidraRow[];
    const populationByCode = new Map<string, number>();
    let populationYear: string | null = null;

    for (const row of populationRows.slice(1)) {
        const code = String(row.D1C || "").trim();
        const population = Number(String(row.V || "").replace(",", "."));
        if (code && Number.isFinite(population)) {
            populationByCode.set(code, population);
        }
        if (!populationYear && row.D3N) populationYear = row.D3N;
    }

    const namesByCode = new Map(
        municipalities.map((municipality) => [
            String(municipality.id),
            municipality.nome,
        ])
    );

    return {
        municipalities,
        populationByCode,
        populationYear,
        mesh: {
            ...mesh,
            features: mesh.features.map((feature) => {
                const code = featureCode(feature);
                return {
                    ...feature,
                    properties: {
                        ...(feature.properties || {}),
                        code,
                        name: namesByCode.get(code) || code,
                    },
                };
            }),
        } satisfies GeoFeatureCollection,
    };
}

export async function GET(request: Request) {
    const unauthorized = await authorize(request);
    if (unauthorized) return unauthorized;

    try {
        const [ibge, merchantResult] = await Promise.all([
            loadIbge(),
            query<MerchantRow>(`
                WITH order_30d AS (
                    SELECT
                        restaurant_id,
                        COUNT(*) FILTER (WHERE status = 'done')::int AS orders_30d,
                        COALESCE(
                            SUM(total_cents) FILTER (WHERE status = 'done'),
                            0
                        )::bigint AS gmv_30d_cents
                    FROM public.orders
                    WHERE created_at >= now() - interval '30 days'
                    GROUP BY restaurant_id
                )
                SELECT
                    r.id,
                    r.name,
                    r.url_slug,
                    COALESCE(r.address->>'city', r.address->>'cidade') AS city,
                    COALESCE(r.address->>'state', r.address->>'uf') AS state,
                    COALESCE(o.orders_30d, 0) AS orders_30d,
                    COALESCE(o.gmv_30d_cents, 0) AS gmv_30d_cents
                FROM public.restaurants r
                LEFT JOIN order_30d o ON o.restaurant_id = r.id
                WHERE r.creation_step >= 4
                  AND r.address IS NOT NULL
            `),
        ]);

        const statsByCity = new Map<
            string,
            {
                restaurants: number;
                active30d: number;
                orders30d: number;
                gmv30dCents: number;
                merchants: Array<{
                    id: string;
                    name: string;
                    slug: string | null;
                    orders30d: number;
                    gmv30dCents: number;
                }>;
            }
        >();

        for (const merchant of merchantResult.rows) {
            if (!merchant.city || !isPernambuco(merchant.state)) continue;
            const key = normalize(merchant.city);
            if (!key) continue;

            const current = statsByCity.get(key) || {
                restaurants: 0,
                active30d: 0,
                orders30d: 0,
                gmv30dCents: 0,
                merchants: [],
            };
            const orders30d = numeric(merchant.orders_30d);
            const gmv30dCents = numeric(merchant.gmv_30d_cents);

            current.restaurants += 1;
            current.active30d += orders30d > 0 ? 1 : 0;
            current.orders30d += orders30d;
            current.gmv30dCents += gmv30dCents;
            current.merchants.push({
                id: merchant.id,
                name: merchant.name?.trim() || "Restaurante sem nome",
                slug: merchant.url_slug,
                orders30d,
                gmv30dCents,
            });
            statsByCity.set(key, current);
        }

        const cities = ibge.municipalities.map((municipality) => {
            const code = String(municipality.id);
            const stats = statsByCity.get(normalize(municipality.nome)) || {
                restaurants: 0,
                active30d: 0,
                orders30d: 0,
                gmv30dCents: 0,
                merchants: [],
            };
            const population = ibge.populationByCode.get(code) || 0;

            return {
                code,
                name: municipality.nome,
                population,
                restaurants: stats.restaurants,
                active30d: stats.active30d,
                orders30d: stats.orders30d,
                gmv30dCents: stats.gmv30dCents,
                relativeDensity:
                    population > 0
                        ? Number(
                              ((stats.restaurants / population) * 10000).toFixed(
                                  3
                              )
                          )
                        : 0,
                merchants: [...stats.merchants].sort(
                    (a, b) =>
                        b.gmv30dCents - a.gmv30dCents ||
                        b.orders30d - a.orders30d ||
                        a.name.localeCompare(b.name, "pt-BR")
                ),
            };
        });

        const referenceCity =
            cities.find((city) => normalize(city.name) === "alianca") || null;

        return NextResponse.json(
            {
                state: { code: "PE", name: "Pernambuco" },
                metric: {
                    absolute: "Restaurantes iMenu com cadastro concluído",
                    relative: "Restaurantes iMenu por 10 mil habitantes",
                },
                populationYear: ibge.populationYear,
                referenceCityCode: referenceCity?.code || null,
                cities,
                geojson: ibge.mesh,
                totals: {
                    municipalities: cities.length,
                    citiesWithIMenu: cities.filter(
                        (city) => city.restaurants > 0
                    ).length,
                    restaurants: cities.reduce(
                        (sum, city) => sum + city.restaurants,
                        0
                    ),
                    active30d: cities.reduce(
                        (sum, city) => sum + city.active30d,
                        0
                    ),
                },
                generatedAt: new Date().toISOString(),
            },
            { headers: { "Cache-Control": "private, no-store" } }
        );
    } catch (error) {
        console.error("[DEV_CANNONNADE]", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível carregar o CANNONNADE.",
            },
            { status: 500 }
        );
    }
}
