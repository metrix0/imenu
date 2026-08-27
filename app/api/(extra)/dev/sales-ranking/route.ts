import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const TIME_ZONE = "America/Sao_Paulo";
const RANGE_KEYS = ["7d", "this_week", "last_week", "30d", "90d"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];

type BoundsRow = {
    start_at: string | Date;
    end_at: string | Date;
};

type RankingRow = {
    restaurant_id: string;
    restaurant_name: string;
    gmv_cents: number | string;
    order_count: number | string;
};

function getBearerToken(request: Request): string | null {
    const authorization = request.headers.get("authorization")?.trim();
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

function getSupabasePublicConfig(): { url: string; anonKey: string } {
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

function parseRange(value: string | null): RangeKey {
    return RANGE_KEYS.includes(value as RangeKey)
        ? (value as RangeKey)
        : "7d";
}

function toIso(value: string | Date): string {
    return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

export async function GET(request: Request) {
    try {
        const authError = await authorize(request);
        if (authError) return authError;

        const range = parseRange(new URL(request.url).searchParams.get("range"));
        const boundsResult = await query<BoundsRow>(
            `
                WITH clock AS (
                    SELECT
                        NOW() AS utc_now,
                        NOW() AT TIME ZONE $1 AS local_now
                )
                SELECT
                    CASE $2::text
                        WHEN '7d' THEN
                            (date_trunc('day', local_now) - INTERVAL '6 days') AT TIME ZONE $1
                        WHEN 'this_week' THEN
                            date_trunc('week', local_now) AT TIME ZONE $1
                        WHEN 'last_week' THEN
                            (date_trunc('week', local_now) - INTERVAL '1 week') AT TIME ZONE $1
                        WHEN '30d' THEN
                            (date_trunc('day', local_now) - INTERVAL '29 days') AT TIME ZONE $1
                        ELSE
                            (date_trunc('day', local_now) - INTERVAL '89 days') AT TIME ZONE $1
                    END AS start_at,
                    CASE $2::text
                        WHEN 'last_week' THEN
                            date_trunc('week', local_now) AT TIME ZONE $1
                        ELSE utc_now
                    END AS end_at
                FROM clock
            `,
            [TIME_ZONE, range]
        );

        const bounds = boundsResult.rows[0];
        if (!bounds) throw new Error("Não foi possível calcular o período.");

        const startIso = toIso(bounds.start_at);
        const endIso = toIso(bounds.end_at);

        const rankingResult = await query<RankingRow>(
            `
                SELECT
                    o.restaurant_id::text AS restaurant_id,
                    COALESCE(r.name, 'Restaurante removido') AS restaurant_name,
                    COALESCE(SUM(o.total_cents), 0)::bigint AS gmv_cents,
                    COUNT(*)::int AS order_count
                FROM orders AS o
                LEFT JOIN restaurants AS r
                    ON r.id = o.restaurant_id
                WHERE o.created_at >= $1
                  AND o.created_at < $2
                  AND o.status IS DISTINCT FROM 'canceled'
                  AND o.status IS DISTINCT FROM 'pending_online_payment'
                GROUP BY o.restaurant_id, r.name
                ORDER BY gmv_cents DESC, order_count DESC, restaurant_name ASC
            `,
            [startIso, endIso]
        );

        const restaurants = rankingResult.rows.map((row) => ({
            id: row.restaurant_id,
            name: row.restaurant_name,
            gmvCents: Math.max(0, Number(row.gmv_cents) || 0),
            orders: Math.max(0, Number(row.order_count) || 0),
        }));
        const totalGmvCents = restaurants.reduce(
            (total, restaurant) => total + restaurant.gmvCents,
            0
        );
        const totalOrders = restaurants.reduce(
            (total, restaurant) => total + restaurant.orders,
            0
        );
        const restaurantCount = restaurants.length;

        return NextResponse.json(
            {
                summary: {
                    totalGmvCents,
                    totalOrders,
                    restaurantCount,
                    averageGmvPerRestaurantCents:
                        restaurantCount > 0
                            ? Math.round(totalGmvCents / restaurantCount)
                            : 0,
                },
                restaurants: restaurants.map((restaurant) => ({
                    ...restaurant,
                    averageTicketCents:
                        restaurant.orders > 0
                            ? Math.round(restaurant.gmvCents / restaurant.orders)
                            : 0,
                    sharePercent:
                        totalGmvCents > 0
                            ? Number(
                                  (
                                      (restaurant.gmvCents / totalGmvCents) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                })),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[DEV_SALES_RANKING] Failed:", error);
        return NextResponse.json(
            { error: "Não foi possível carregar o ranking de vendas." },
            { status: 500 }
        );
    }
}