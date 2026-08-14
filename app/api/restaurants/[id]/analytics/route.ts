import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { loadPostHogConsumerTimeSeries } from "@/lib/analytics/posthogConsumer";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "America/Sao_Paulo";
const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type BoundsRow = { start_at: string | Date; end_at: string | Date };
type RestaurantRow = { url_slug: string | null; user_id: string | null };
type SummaryRow = {
    created_orders: number | string;
    completed_orders: number | string;
    canceled_orders: number | string;
    revenue_cents: number | string | null;
    average_ticket_cents: number | string | null;
    average_delivery_fee_cents: number | string | null;
    delivery_orders: number | string;
    known_fulfillment_orders: number | string;
    coupon_orders: number | string;
};
type UnitsRow = { units: number | string | null };
type DailyRevenueRow = {
    date: string | Date;
    revenue_cents: number | string | null;
    orders: number | string;
};
type DailyOrdersRow = { date: string | Date; orders: number | string };
type DistributionRow = { key: string | null; orders: number | string };
type HourRow = { hour: number | string; orders: number | string };
type ItemRow = {
    name: string;
    quantity: number | string;
    revenue_cents: number | string | null;
};
type CategoryRow = {
    name: string;
    orders: number | string;
    quantity: number | string;
};
type CategoryPairRow = {
    first_category: string;
    second_category: string;
    orders: number | string;
};
type CategoryCombinationRow = {
    combined_orders: number | string;
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

function isDate(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function numberValue(value: number | string | null | undefined): number {
    return Number(value) || 0;
}

function dateValue(value: string | Date): string {
    if (value instanceof Date) return value.toISOString().slice(0, 10);
    return String(value).slice(0, 10);
}

async function getAuthenticatedUserId(
    request: Request
): Promise<
    { userId: string; email: string | null } | { response: NextResponse }
> {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
        return {
            response: NextResponse.json(
                { error: "Não autenticado." },
                { status: 401 }
            ),
        };
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
        return {
            response: NextResponse.json(
                { error: "Sessão inválida ou expirada." },
                { status: 401 }
            ),
        };
    }

    return {
        userId: user.id,
        email: user.email?.trim().toLowerCase() || null,
    };
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const authentication = await getAuthenticatedUserId(request);
        if ("response" in authentication) return authentication.response;

        const { id } = await context.params;
        const searchParams = new URL(request.url).searchParams;
        const from = searchParams.get("from");
        const to = searchParams.get("to");
        if (!id || !isDate(from) || !isDate(to)) {
            return NextResponse.json(
                { error: "Restaurante e período são obrigatórios." },
                { status: 400 }
            );
        }

        const restaurantResult = await query<RestaurantRow>(
            `SELECT url_slug, user_id FROM restaurants WHERE id = $1 LIMIT 1`,
            [id]
        );
        const restaurant = restaurantResult.rows[0];
        if (
            !restaurant ||
            (restaurant.user_id !== authentication.userId &&
                authentication.email !== ALLOWED_DEV_EMAIL)
        ) {
            return NextResponse.json(
                { error: "Acesso negado ao restaurante." },
                { status: 403 }
            );
        }

        const boundsResult = await query<BoundsRow>(
            `SELECT ($1::date::timestamp AT TIME ZONE $3) AS start_at, (($2::date + 1)::timestamp AT TIME ZONE $3) AS end_at`,
            [from, to, TIME_ZONE]
        );
        const bounds = boundsResult.rows[0];
        if (!bounds) throw new Error("Não foi possível calcular o período.");
        const startAt = new Date(bounds.start_at);
        const endAt = new Date(bounds.end_at);
        const rangeParams = [id, startAt.toISOString(), endAt.toISOString()];

        const [
            summaryResult,
            unitsResult,
            revenueSeriesResult,
            orderSeriesResult,
            paymentResult,
            fulfillmentResult,
            hourlyResult,
            itemsResult,
            categoriesResult,
            categoryPairsResult,
            categoryCombinationResult,
            consumerSeries,
        ] = await Promise.all([
            query<SummaryRow>(
                `
                SELECT
                    COUNT(*)::int AS created_orders,
                    COUNT(*) FILTER (WHERE status = 'done')::int AS completed_orders,
                    COUNT(*) FILTER (WHERE status = 'canceled')::int AS canceled_orders,
                    COALESCE(SUM(total_cents) FILTER (WHERE status = 'done'), 0) AS revenue_cents,
                    COALESCE(AVG(total_cents) FILTER (WHERE status = 'done'), 0) AS average_ticket_cents,
                    COALESCE(AVG(delivery_cents) FILTER (WHERE status = 'done' AND delivery_cents > 0), 0) AS average_delivery_fee_cents,
                    COUNT(*) FILTER (WHERE status = 'done' AND LOWER(COALESCE(is_delivery, '')) IN ('entrega', 'true', 'delivery'))::int AS delivery_orders,
                    COUNT(*) FILTER (WHERE status = 'done' AND LOWER(COALESCE(is_delivery, '')) IN ('entrega', 'true', 'delivery', 'retirada', 'false', 'pickup'))::int AS known_fulfillment_orders,
                    COUNT(*) FILTER (WHERE status = 'done' AND coupon_id IS NOT NULL)::int AS coupon_orders
                FROM orders
                WHERE restaurant_id = $1
                  AND created_at >= $2
                  AND created_at < $3
                `,
                rangeParams
            ),
            query<UnitsRow>(
                `
                SELECT COALESCE(SUM(oi.quantity), 0) AS units
                FROM order_items oi
                INNER JOIN orders o ON o.id = oi.order_id
                WHERE o.restaurant_id = $1
                  AND o.created_at >= $2
                  AND o.created_at < $3
                  AND o.status = 'done'
                `,
                rangeParams
            ),
            query<DailyRevenueRow>(
                `
                SELECT
                    (created_at AT TIME ZONE $4)::date AS date,
                    COALESCE(SUM(total_cents), 0) AS revenue_cents,
                    COUNT(*)::int AS orders
                FROM orders
                WHERE restaurant_id = $1
                  AND created_at >= $2
                  AND created_at < $3
                  AND status = 'done'
                GROUP BY date
                ORDER BY date ASC
                `,
                [...rangeParams, TIME_ZONE]
            ),
            query<DailyOrdersRow>(
                `
                SELECT
                    (created_at AT TIME ZONE $4)::date AS date,
                    COUNT(*)::int AS orders
                FROM orders
                WHERE restaurant_id = $1
                  AND created_at >= $2
                  AND created_at < $3
                GROUP BY date
                ORDER BY date ASC
                `,
                [...rangeParams, TIME_ZONE]
            ),
            query<DistributionRow>(
                `
                SELECT payment_method AS key, COUNT(*)::int AS orders
                FROM orders
                WHERE restaurant_id = $1
                  AND created_at >= $2
                  AND created_at < $3
                  AND status = 'done'
                GROUP BY payment_method
                ORDER BY orders DESC
                `,
                rangeParams
            ),
            query<DistributionRow>(
                `
                SELECT
                    CASE
                        WHEN LOWER(COALESCE(is_delivery, '')) IN ('entrega', 'true', 'delivery') THEN 'delivery'
                        WHEN LOWER(COALESCE(is_delivery, '')) IN ('retirada', 'false', 'pickup') THEN 'pickup'
                        ELSE 'unknown'
                    END AS key,
                    COUNT(*)::int AS orders
                FROM orders
                WHERE restaurant_id = $1
                  AND created_at >= $2
                  AND created_at < $3
                  AND status = 'done'
                GROUP BY key
                ORDER BY orders DESC
                `,
                rangeParams
            ),
            query<HourRow>(
                `
                SELECT
                    EXTRACT(HOUR FROM created_at AT TIME ZONE $4)::int AS hour,
                    COUNT(*)::int AS orders
                FROM orders
                WHERE restaurant_id = $1
                  AND created_at >= $2
                  AND created_at < $3
                  AND status = 'done'
                GROUP BY hour
                ORDER BY hour ASC
                `,
                [...rangeParams, TIME_ZONE]
            ),
            query<ItemRow>(
                `
                SELECT
                    oi.name,
                    SUM(oi.quantity)::int AS quantity,
                    COALESCE(SUM(oi.total_cents), 0) AS revenue_cents
                FROM order_items oi
                INNER JOIN orders o ON o.id = oi.order_id
                WHERE o.restaurant_id = $1
                  AND o.created_at >= $2
                  AND o.created_at < $3
                  AND o.status = 'done'
                GROUP BY COALESCE(oi.item_id::text, oi.name), oi.name
                ORDER BY quantity DESC, revenue_cents DESC, oi.name ASC
                `,
                rangeParams
            ),
            query<CategoryRow>(
                `
                SELECT
                    c.name,
                    COUNT(DISTINCT o.id)::int AS orders,
                    SUM(oi.quantity)::int AS quantity
                FROM orders o
                INNER JOIN order_items oi ON oi.order_id = o.id
                INNER JOIN items i ON i.id = oi.item_id
                INNER JOIN categories c ON c.id = i.category_id
                WHERE o.restaurant_id = $1
                  AND o.created_at >= $2
                  AND o.created_at < $3
                  AND o.status = 'done'
                GROUP BY c.id, c.name
                ORDER BY orders DESC, quantity DESC, c.name ASC
                `,
                rangeParams
            ),
            query<CategoryPairRow>(
                `
                WITH order_categories AS (
                    SELECT DISTINCT
                        o.id AS order_id,
                        c.id AS category_id,
                        c.name
                    FROM orders o
                    INNER JOIN order_items oi ON oi.order_id = o.id
                    INNER JOIN items i ON i.id = oi.item_id
                    INNER JOIN categories c ON c.id = i.category_id
                    WHERE o.restaurant_id = $1
                      AND o.created_at >= $2
                      AND o.created_at < $3
                      AND o.status = 'done'
                )
                SELECT
                    first_category.name AS first_category,
                    second_category.name AS second_category,
                    COUNT(*)::int AS orders
                FROM order_categories first_category
                INNER JOIN order_categories second_category
                    ON first_category.order_id = second_category.order_id
                   AND first_category.category_id < second_category.category_id
                GROUP BY
                    first_category.category_id,
                    first_category.name,
                    second_category.category_id,
                    second_category.name
                ORDER BY orders DESC, first_category.name ASC, second_category.name ASC
                LIMIT 12
                `,
                rangeParams
            ),
            query<CategoryCombinationRow>(
                `
                WITH categories_per_order AS (
                    SELECT
                        o.id AS order_id,
                        COUNT(DISTINCT i.category_id)::int AS category_count
                    FROM orders o
                    INNER JOIN order_items oi ON oi.order_id = o.id
                    INNER JOIN items i ON i.id = oi.item_id
                    WHERE o.restaurant_id = $1
                      AND o.created_at >= $2
                      AND o.created_at < $3
                      AND o.status = 'done'
                      AND i.category_id IS NOT NULL
                    GROUP BY o.id
                )
                SELECT
                    COUNT(*) FILTER (WHERE category_count >= 2)::int AS combined_orders
                FROM categories_per_order
                `,
                rangeParams
            ),
            loadPostHogConsumerTimeSeries(startAt.getTime(), endAt.getTime(), {
                restaurantId: id,
                restaurantSlug: restaurant.url_slug || "",
            }),
        ]);

        const summaryRow = summaryResult.rows[0];
        const createdOrders = numberValue(summaryRow?.created_orders);
        const completedOrders = numberValue(summaryRow?.completed_orders);
        const canceledOrders = numberValue(summaryRow?.canceled_orders);
        const deliveryOrders = numberValue(summaryRow?.delivery_orders);
        const knownFulfillmentOrders = numberValue(
            summaryRow?.known_fulfillment_orders
        );
        const couponOrders = numberValue(summaryRow?.coupon_orders);
        const units = numberValue(unitsResult.rows[0]?.units);
        const combinedCategoryOrders = numberValue(
            categoryCombinationResult.rows[0]?.combined_orders
        );

        const distribution = (rows: DistributionRow[]) => {
            const total = rows.reduce(
                (sum, row) => sum + numberValue(row.orders),
                0
            );
            return rows.map((row) => ({
                key: row.key || "unknown",
                orders: numberValue(row.orders),
                percentage:
                    total > 0
                        ? Number(
                              ((numberValue(row.orders) / total) * 100).toFixed(
                                  1
                              )
                          )
                        : 0,
            }));
        };

        return NextResponse.json(
            {
                summary: {
                    revenueCents: numberValue(summaryRow?.revenue_cents),
                    createdOrders,
                    completedOrders,
                    averageTicketCents: numberValue(
                        summaryRow?.average_ticket_cents
                    ),
                    deliveryRate:
                        knownFulfillmentOrders > 0
                            ? Number(
                                  (
                                      (deliveryOrders /
                                          knownFulfillmentOrders) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                    averageDeliveryFeeCents: numberValue(
                        summaryRow?.average_delivery_fee_cents
                    ),
                    cancellationRate:
                        createdOrders > 0
                            ? Number(
                                  (
                                      (canceledOrders / createdOrders) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                    averageItemsPerOrder:
                        completedOrders > 0
                            ? Number((units / completedOrders).toFixed(1))
                            : 0,
                    couponRate:
                        completedOrders > 0
                            ? Number(
                                  (
                                      (couponOrders / completedOrders) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                },
                revenueSeries: revenueSeriesResult.rows.map((row) => ({
                    date: dateValue(row.date),
                    revenueCents: numberValue(row.revenue_cents),
                    orders: numberValue(row.orders),
                })),
                orderSeries: orderSeriesResult.rows.map((row) => ({
                    date: dateValue(row.date),
                    orders: numberValue(row.orders),
                })),
                paymentTypes: distribution(paymentResult.rows),
                fulfillment: distribution(fulfillmentResult.rows),
                hourlyOrders: hourlyResult.rows.map((row) => ({
                    hour: numberValue(row.hour),
                    orders: numberValue(row.orders),
                })),
                items: itemsResult.rows.map((row) => ({
                    name: row.name,
                    quantity: numberValue(row.quantity),
                    revenueCents: numberValue(row.revenue_cents),
                })),
                categories: categoriesResult.rows.map((row) => ({
                    name: row.name,
                    orders: numberValue(row.orders),
                    quantity: numberValue(row.quantity),
                })),
                categoryPairs: categoryPairsResult.rows.map((row) => ({
                    firstCategory: row.first_category,
                    secondCategory: row.second_category,
                    orders: numberValue(row.orders),
                    rate:
                        completedOrders > 0
                            ? Number(
                                  (
                                      (numberValue(row.orders) /
                                          completedOrders) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                })),
                categoryCombination: {
                    combinedOrders: combinedCategoryOrders,
                    totalOrders: completedOrders,
                    rate:
                        completedOrders > 0
                            ? Number(
                                  (
                                      (combinedCategoryOrders /
                                          completedOrders) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                },
                consumer: {
                    postHogAvailable: consumerSeries.available,
                    series: consumerSeries.points,
                },
                generatedAt: new Date().toISOString(),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[ANALYTICS] Failed:", error);
        return NextResponse.json(
            { error: "Não foi possível carregar os dados de analytics." },
            { status: 500 }
        );
    }
}
