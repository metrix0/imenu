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
    customer_count: number | string;
};

type GrowthMetricsRow = {
    selling_restaurants_30d: number | string;
    active_10_restaurants_30d: number | string;
    active_10_gmv_share_percent: number | string;
    activation_eligible_30d: number | string;
    activation_10_in_14d_30d: number | string;
    activated_users_eligible_30d: number | string;
    activated_users_10_in_14d_30d: number | string;
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
                WITH normalized_orders AS (
                    SELECT
                        o.restaurant_id,
                        o.total_cents,
                        CASE
                            WHEN phone_digits LIKE '55%'
                              AND LENGTH(phone_digits) IN (12, 13)
                                THEN SUBSTRING(phone_digits FROM 3)
                            ELSE phone_digits
                        END AS customer_key
                    FROM orders AS o
                    CROSS JOIN LATERAL (
                        SELECT REGEXP_REPLACE(
                            COALESCE(o.customer_phone, ''),
                            '[^0-9]',
                            '',
                            'g'
                        ) AS phone_digits
                    ) AS normalized_phone
                    WHERE o.created_at >= $1
                      AND o.created_at < $2
                      AND o.status IS DISTINCT FROM 'canceled'
                      AND o.status IS DISTINCT FROM 'pending_online_payment'
                )
                SELECT
                    o.restaurant_id::text AS restaurant_id,
                    COALESCE(r.name, 'Restaurante removido') AS restaurant_name,
                    COALESCE(SUM(o.total_cents), 0)::bigint AS gmv_cents,
                    COUNT(*)::int AS order_count,
                    COUNT(
                        DISTINCT CASE
                            WHEN LENGTH(o.customer_key) >= 10
                                THEN o.customer_key
                            ELSE NULL
                        END
                    )::int AS customer_count
                FROM normalized_orders AS o
                LEFT JOIN restaurants AS r
                    ON r.id = o.restaurant_id
                GROUP BY o.restaurant_id, r.name
                ORDER BY gmv_cents DESC, order_count DESC, restaurant_name ASC
            `,
            [startIso, endIso]
        );

        const growthMetricsResult = await query<GrowthMetricsRow>(
            `
                WITH sales_30d AS (
                    SELECT
                        o.restaurant_id,
                        COUNT(*)::int AS order_count,
                        COALESCE(SUM(o.total_cents), 0)::bigint AS gmv_cents
                    FROM orders AS o
                    WHERE o.created_at >= NOW() - INTERVAL '30 days'
                      AND o.status IS DISTINCT FROM 'canceled'
                      AND o.status IS DISTINCT FROM 'pending_online_payment'
                    GROUP BY o.restaurant_id
                ),
                sales_totals AS (
                    SELECT
                        COUNT(*)::int AS selling_restaurants,
                        COALESCE(SUM(gmv_cents), 0)::bigint AS total_gmv_cents
                    FROM sales_30d
                ),
                activation_cohort AS (
                    SELECT
                        r.id,
                        r.created_at,
                        COUNT(o.id)::int AS first_14d_orders
                    FROM restaurants AS r
                    LEFT JOIN orders AS o
                        ON o.restaurant_id = r.id
                       AND o.created_at >= r.created_at
                       AND o.created_at < r.created_at + INTERVAL '14 days'
                       AND o.status IS DISTINCT FROM 'canceled'
                       AND o.status IS DISTINCT FROM 'pending_online_payment'
                    WHERE (r.created_at AT TIME ZONE 'America/Sao_Paulo') >=
                              date_trunc(
                                  'month',
                                  NOW() AT TIME ZONE 'America/Sao_Paulo'
                              ) - INTERVAL '1 month'
                      AND (r.created_at AT TIME ZONE 'America/Sao_Paulo') <
                              date_trunc(
                                  'month',
                                  NOW() AT TIME ZONE 'America/Sao_Paulo'
                              )
                    GROUP BY r.id, r.created_at
                ),
                account_orders AS (
                    SELECT
                        COALESCE(r.user_id::text, o.restaurant_id::text) AS account_id,
                        o.id,
                        o.created_at,
                        o.status
                    FROM orders AS o
                    LEFT JOIN restaurants AS r
                        ON r.id = o.restaurant_id
                    WHERE o.table_id IS NULL
                ),
                account_first_orders AS (
                    SELECT
                        account_id,
                        MIN(created_at) AS first_order_at
                    FROM account_orders
                    GROUP BY account_id
                ),
                activated_user_cohort AS (
                    SELECT
                        first_orders.account_id,
                        first_orders.first_order_at,
                        COUNT(account_orders.id) FILTER (
                            WHERE account_orders.created_at >= first_orders.first_order_at
                              AND account_orders.created_at < first_orders.first_order_at + INTERVAL '14 days'
                              AND account_orders.status IS DISTINCT FROM 'canceled'
                              AND account_orders.status IS DISTINCT FROM 'pending_online_payment'
                        )::int AS first_14d_orders
                    FROM account_first_orders AS first_orders
                    LEFT JOIN account_orders
                        ON account_orders.account_id = first_orders.account_id
                    WHERE (first_orders.first_order_at AT TIME ZONE 'America/Sao_Paulo') >=
                              date_trunc(
                                  'month',
                                  NOW() AT TIME ZONE 'America/Sao_Paulo'
                              ) - INTERVAL '1 month'
                      AND (first_orders.first_order_at AT TIME ZONE 'America/Sao_Paulo') <
                              date_trunc(
                                  'month',
                                  NOW() AT TIME ZONE 'America/Sao_Paulo'
                              )
                    GROUP BY first_orders.account_id, first_orders.first_order_at
                )
                SELECT
                    totals.selling_restaurants AS selling_restaurants_30d,
                    COUNT(*) FILTER (
                        WHERE sales.order_count >= 10
                    )::int AS active_10_restaurants_30d,
                    CASE
                        WHEN totals.total_gmv_cents > 0 THEN
                            ROUND(
                                100.0 * COALESCE(
                                    SUM(sales.gmv_cents) FILTER (
                                        WHERE sales.order_count >= 10
                                    ),
                                    0
                                ) / totals.total_gmv_cents,
                                1
                            )
                        ELSE 0
                    END AS active_10_gmv_share_percent,
                    (SELECT COUNT(*) FROM activation_cohort)::int AS activation_eligible_30d,
                    (
                        SELECT COUNT(*)
                        FROM activation_cohort
                        WHERE first_14d_orders >= 10
                    )::int AS activation_10_in_14d_30d,
                    (SELECT COUNT(*) FROM activated_user_cohort)::int
                        AS activated_users_eligible_30d,
                    (
                        SELECT COUNT(*)
                        FROM activated_user_cohort
                        WHERE first_14d_orders >= 10
                    )::int AS activated_users_10_in_14d_30d
                FROM sales_30d AS sales
                CROSS JOIN sales_totals AS totals
                GROUP BY totals.selling_restaurants, totals.total_gmv_cents
            `
        );

        const restaurants = rankingResult.rows.map((row) => ({
            id: row.restaurant_id,
            name: row.restaurant_name,
            gmvCents: Math.max(0, Number(row.gmv_cents) || 0),
            orders: Math.max(0, Number(row.order_count) || 0),
            customers: Math.max(0, Number(row.customer_count) || 0),
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
        const growthMetrics = growthMetricsResult.rows[0];
        const sellingRestaurants30d = Math.max(
            0,
            Number(growthMetrics?.selling_restaurants_30d) || 0
        );
        const active10Restaurants30d = Math.max(
            0,
            Number(growthMetrics?.active_10_restaurants_30d) || 0
        );
        const activationEligible30d = Math.max(
            0,
            Number(growthMetrics?.activation_eligible_30d) || 0
        );
        const activation10In14d30d = Math.max(
            0,
            Number(growthMetrics?.activation_10_in_14d_30d) || 0
        );
        const activatedUsersEligible30d = Math.max(
            0,
            Number(growthMetrics?.activated_users_eligible_30d) || 0
        );
        const activatedUsers10In14d30d = Math.max(
            0,
            Number(growthMetrics?.activated_users_10_in_14d_30d) || 0
        );
        const restaurantsWithActiveCustomers = restaurants.filter(
            (restaurant) =>
                restaurant.orders >= 4 && restaurant.customers >= 4
        );
        const activeCustomerRestaurantGmvCents =
            restaurantsWithActiveCustomers.reduce(
                (total, restaurant) => total + restaurant.gmvCents,
                0
            );

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
                    averageGmvPerActiveCustomerRestaurantCents:
                        restaurantsWithActiveCustomers.length > 0
                            ? Math.round(
                                  activeCustomerRestaurantGmvCents /
                                      restaurantsWithActiveCustomers.length
                              )
                            : 0,
                    active10Restaurants30d,
                    active10RestaurantPercent30d:
                        sellingRestaurants30d > 0
                            ? Number(
                                  (
                                      (active10Restaurants30d /
                                          sellingRestaurants30d) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                    active10GmvSharePercent30d: Math.max(
                        0,
                        Number(growthMetrics?.active_10_gmv_share_percent) || 0
                    ),
                    sellingRestaurants30d,
                    activationEligible30d,
                    activation10In14d30d,
                    activationQualityPercent30d:
                        activationEligible30d > 0
                            ? Number(
                                  (
                                      (activation10In14d30d /
                                          activationEligible30d) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                    activatedUsersEligible30d,
                    activatedUsers10In14d30d,
                    activatedTo10In14dPercent30d:
                        activatedUsersEligible30d > 0
                            ? Number(
                                  (
                                      (activatedUsers10In14d30d /
                                          activatedUsersEligible30d) *
                                      100
                                  ).toFixed(1)
                              )
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