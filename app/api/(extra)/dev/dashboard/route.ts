import { parseRange, toTimestamp, normalizePhone, ordersInside, distinctAccountSet, accountsWithMinPurchaseDays, isHandledOrder, customerQualifiedAccounts, type RangeKey } from "@/lib/dev/dashboardMetrics";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";

import { buildConsumerPipeline } from "@/lib/analytics/consumerPipeline";
import { loadPostHogConsumerMetrics } from "@/lib/analytics/posthogConsumer";
import { query } from "@/lib/database/sql";
import { loadPostHogMetrics, loadPostHogPanelTabUsage, loadPostHogSeoTraffic, loadPostHogPageViewTimeline, loadPostHogConsumerTimeline, type Bucket, type SeriesPoint } from "@/lib/dev/dashboardPosthog";
import { ADDON_PRODUCT_METRICS_SQL, buildProductOverview, type AddonProductMetricsRow } from "@/lib/analytics/productOverview";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;


type BoundsRow = {
    start_at: string | Date;
    end_at: string | Date;
};

type OrderRow = {
    account_id: string;
    status: string;
    total_cents: number | string | null;
    payment_method: string | null;
    customer_phone: string | null;
    created_at: string | Date;
};

type NormalizedOrder = {
    accountId: string;
    status: string;
    totalCents: number;
    paymentMethod: string;
    customerKey: string | null;
    createdAt: number;
};

type OnboardingFunnelRow = {
    registration_complete: number | string;
    step_1: number | string;
    step_2: number | string;
    step_3: number | string;
    step_4: number | string;
};

type OrderCountRow = {
    total_orders: number | string;
};

type DeviceUsageRow = {
    measured_users: number | string;
    mainly_mobile: number | string;
    mainly_desktop: number | string;
    tied: number | string;
};




function normalizeOrder(row: OrderRow): NormalizedOrder {
    return {
        accountId: row.account_id,
        status: row.status,
        totalCents: Math.max(0, Number(row.total_cents) || 0),
        paymentMethod: row.payment_method || "não informado",
        customerKey: normalizePhone(row.customer_phone),
        createdAt: toTimestamp(row.created_at),
    };
}

function localDateLabel(timestamp: number): string {
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
    }).format(new Date(timestamp));
}

function localMonthKey(timestamp: number): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: TIME_ZONE,
        year: "numeric",
        month: "2-digit",
    }).formatToParts(new Date(timestamp));
    const year = parts.find((part) => part.type === "year")?.value || "0000";
    const month = parts.find((part) => part.type === "month")?.value || "00";
    return `${year}-${month}`;
}

function buildBuckets(start: number, end: number, range: RangeKey): Bucket[] {
    const step = range === "90d" ? 7 * DAY_MS : DAY_MS;
    const buckets: Bucket[] = [];

    for (let cursor = start; cursor < end; cursor += step) {
        const bucketEnd = Math.min(cursor + step, end);
        const startLabel = localDateLabel(cursor);
        const endLabel = localDateLabel(Math.max(cursor, bucketEnd - 1));

        buckets.push({
            start: cursor,
            end: bucketEnd,
            label: step === DAY_MS || startLabel === endLabel
                ? startLabel
                : `${startLabel}–${endLabel}`,
        });
    }

    return buckets;
}



function distinctAccounts(orders: NormalizedOrder[]): number {
    return distinctAccountSet(orders).size;
}




function activeUserAccountSet(
    orders: NormalizedOrder[],
    asOf: number
): Set<string> {
    const eligible = accountsWithMinPurchaseDays(
        ordersInside(orders, asOf - 30 * DAY_MS, asOf),
        2
    );
    const recent = accountsWithMinPurchaseDays(
        ordersInside(orders, asOf - 14 * DAY_MS, asOf),
        1
    );

    return new Set(
        [...eligible].filter((accountId) => recent.has(accountId))
    );
}

function distinctCustomers(orders: NormalizedOrder[]): number {
    return new Set(
        orders
            .map((order) => order.customerKey)
            .filter((value): value is string => Boolean(value))
    ).size;
}

function firstOrderByAccount(orders: NormalizedOrder[]): Map<string, number> {
    const firstOrders = new Map<string, number>();

    for (const order of orders) {
        if (!firstOrders.has(order.accountId)) {
            firstOrders.set(order.accountId, order.createdAt);
        }
    }

    return firstOrders;
}

function activatedAccountSet(
    firstOrders: Map<string, number>,
    start: number,
    end: number
): Set<string> {
    return new Set(
        [...firstOrders.entries()]
            .filter(([, firstOrderAt]) => firstOrderAt >= start && firstOrderAt < end)
            .map(([accountId]) => accountId)
    );
}


function realActiveAccountSet(orders: NormalizedOrder[]): Set<string> {
    const clientsByAccount = new Map<string, Set<string>>();

    for (const order of orders) {
        if (order.status !== "done" || !order.customerKey) continue;
        const clients = clientsByAccount.get(order.accountId) || new Set<string>();
        clients.add(order.customerKey);
        clientsByAccount.set(order.accountId, clients);
    }

    return new Set(
        [...clientsByAccount.entries()]
            .filter(([, clients]) => clients.size >= 2)
            .map(([accountId]) => accountId)
    );
}

function realActiveAccounts(orders: NormalizedOrder[]): number {
    return realActiveAccountSet(orders).size;
}


function activeCustomersAt(
    orders: NormalizedOrder[],
    asOf: number
): number {
    return customerQualifiedAccounts(
        ordersInside(orders, asOf - 30 * DAY_MS, asOf)
    ).size;
}

function handledMoney(orders: NormalizedOrder[]): number {
    return orders
        .filter(isHandledOrder)
        .reduce((total, order) => total + order.totalCents, 0);
}

function onlineMoney(orders: NormalizedOrder[]): number {
    return orders
        .filter((order) => isHandledOrder(order) && order.paymentMethod === "pix")
        .reduce((total, order) => total + order.totalCents, 0);
}

function churnAccountSets(
    orders: NormalizedOrder[],
    asOf: number
): {
    abandonedActiveUsers: Set<string>;
    abandonedActiveCustomerUsers: Set<string>;
    eligibleActiveUsers: Set<string>;
    eligibleActiveCustomerUsers: Set<string>;
} {
    const eligibleActiveUsers = accountsWithMinPurchaseDays(
        ordersInside(orders, asOf - 30 * DAY_MS, asOf),
        2
    );
    const recentlyActiveUsers = accountsWithMinPurchaseDays(
        ordersInside(orders, asOf - 14 * DAY_MS, asOf),
        1
    );

    const inactivityStart = asOf - 7 * DAY_MS;
    const priorCustomerWindow = ordersInside(
        orders,
        inactivityStart - 30 * DAY_MS,
        inactivityStart
    );
    const accountsWithRecentOrders = distinctAccountSet(
        ordersInside(orders, inactivityStart, asOf)
    );
    const previouslyQualifiedCustomerAccounts =
        customerQualifiedAccounts(priorCustomerWindow);

    return {
        abandonedActiveUsers: new Set(
            [...eligibleActiveUsers].filter(
                (accountId) => !recentlyActiveUsers.has(accountId)
            )
        ),
        abandonedActiveCustomerUsers: new Set(
            [...previouslyQualifiedCustomerAccounts].filter(
                (accountId) => !accountsWithRecentOrders.has(accountId)
            )
        ),
        eligibleActiveUsers,
        eligibleActiveCustomerUsers: previouslyQualifiedCustomerAccounts,
    };
}

function churnAt(
    orders: NormalizedOrder[],
    asOf: number
): {
    abandonedActiveUsers: number;
    abandonedActiveCustomerUsers: number;
    eligibleActiveUsers: number;
    eligibleActiveCustomerUsers: number;
} {
    const sets = churnAccountSets(orders, asOf);
    return {
        abandonedActiveUsers: sets.abandonedActiveUsers.size,
        abandonedActiveCustomerUsers: sets.abandonedActiveCustomerUsers.size,
        eligibleActiveUsers: sets.eligibleActiveUsers.size,
        eligibleActiveCustomerUsers: sets.eligibleActiveCustomerUsers.size,
    };
}

function percentage(part: number, total: number): number {
    if (total <= 0) return 0;
    return Number(((part / total) * 100).toFixed(1));
}

function percentageChange(current: number, previous: number): number | null {
    if (previous === 0) return current === 0 ? 0 : null;
    return Number((((current - previous) / previous) * 100).toFixed(1));
}

function paymentLabel(value: string): string {
    const labels: Record<string, string> = {
        pix: "Pix online",
        "pix-entrega": "Pix na entrega",
        dinheiro: "Dinheiro",
        "trazer-maquininha": "Maquininha",
        "não informado": "Não informado",
    };
    return labels[value] || value;
}

function conversion(current: number | null, previous: number | null): number | null {
    if (current === null || previous === null || previous <= 0) return null;
    return Number(((current / previous) * 100).toFixed(1));
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

        const startAt = toTimestamp(bounds.start_at);
        const endAt = toTimestamp(bounds.end_at);
        const previousStartAt = startAt - (endAt - startAt);
        const startIso = new Date(startAt).toISOString();
        const endIso = new Date(endAt).toISOString();
        const activeStartIso = new Date(endAt - 7 * DAY_MS).toISOString();
        const buckets = buildBuckets(startAt, endAt, range);

        const [
            onboardingResult,
            postHog,
            panelTabUsage,
            consumerTracking,
            consumerTimeline,
            pageViewTimeline,
            seoTraffic,
            orderCountResult,
            deviceUsageResult,
            addonProductMetricsResult,
        ] =
            await Promise.all([
                query<OnboardingFunnelRow>(
                `
                    WITH registration_cohort AS (
                        SELECT u.id
                        FROM auth.users AS u
                        WHERE u.created_at >= $1
                          AND u.created_at < $2
                          AND u.deleted_at IS NULL
                          AND COALESCE(u.is_anonymous, false) = false
                    )
                    SELECT
                        COUNT(DISTINCT cohort.id)::int AS registration_complete,
                        COUNT(DISTINCT cohort.id) FILTER (
                            WHERE restaurant.id IS NOT NULL
                        )::int AS step_1,
                        COUNT(DISTINCT cohort.id) FILTER (
                            WHERE restaurant.creation_step >= 2
                               OR restaurant.first_time = false
                        )::int AS step_2,
                        COUNT(DISTINCT cohort.id) FILTER (
                            WHERE restaurant.creation_step >= 3
                               OR restaurant.first_time = false
                        )::int AS step_3,
                        COUNT(DISTINCT cohort.id) FILTER (
                            WHERE restaurant.creation_step >= 4
                               OR restaurant.first_time = false
                        )::int AS step_4
                    FROM registration_cohort AS cohort
                    LEFT JOIN restaurants AS restaurant
                        ON restaurant.user_id = cohort.id
                `,
                    [startIso, endIso]
                ),
                loadPostHogMetrics(startAt, endAt),
                loadPostHogPanelTabUsage(startAt, endAt),
                loadPostHogConsumerMetrics(startAt, endAt),
                loadPostHogConsumerTimeline(buckets),
                loadPostHogPageViewTimeline(buckets),
                loadPostHogSeoTraffic(startAt, endAt),
                query<OrderCountRow>(
                    `
                        SELECT COUNT(*)::int AS total_orders
                        FROM orders
                        WHERE created_at >= $1
                          AND created_at < $2
                          AND status IS DISTINCT FROM 'canceled'
                          AND status IS DISTINCT FROM 'pending_online_payment'
                    `,
                    [startIso, endIso]
                ),
                query<DeviceUsageRow>(
                    `
                        WITH active_accounts AS (
                            SELECT DISTINCT r.user_id
                            FROM orders AS o
                            LEFT JOIN restaurants AS r
                                ON r.id = o.restaurant_id
                            WHERE o.created_at >= $1
                              AND o.created_at < $2
                              AND o.table_id IS NULL
                              AND o.status = 'done'
                              AND r.user_id IS NOT NULL
                        ),
                        sessions_by_user AS (
                            SELECT
                                account.user_id,
                                COUNT(session.id) FILTER (
                                    WHERE session.user_agent ~* '(Android|iPhone|iPad|iPod|Mobile)'
                                )::int AS mobile_sessions,
                                COUNT(session.id) FILTER (
                                    WHERE session.user_agent IS NOT NULL
                                      AND NOT (
                                          session.user_agent ~* '(Android|iPhone|iPad|iPod|Mobile)'
                                      )
                                )::int AS desktop_sessions
                            FROM active_accounts AS account
                            LEFT JOIN auth.sessions AS session
                                ON session.user_id = account.user_id
                            GROUP BY account.user_id
                        )
                        SELECT
                            COUNT(*) FILTER (
                                WHERE mobile_sessions + desktop_sessions > 0
                            )::int AS measured_users,
                            COUNT(*) FILTER (
                                WHERE mobile_sessions > desktop_sessions
                            )::int AS mainly_mobile,
                            COUNT(*) FILTER (
                                WHERE desktop_sessions > mobile_sessions
                            )::int AS mainly_desktop,
                            COUNT(*) FILTER (
                                WHERE mobile_sessions > 0
                                  AND mobile_sessions = desktop_sessions
                            )::int AS tied
                        FROM sessions_by_user
                    `,
                    [activeStartIso, endIso]
                ),
                query<AddonProductMetricsRow>(ADDON_PRODUCT_METRICS_SQL, [startIso, endIso]),
            ]);

        const onboardingRow = onboardingResult.rows[0];
        const deviceUsageRow = deviceUsageResult.rows[0];
        const measuredDeviceUsers =
            Number(deviceUsageRow?.measured_users) || 0;
        const mainlyMobileUsers =
            Number(deviceUsageRow?.mainly_mobile) || 0;
        const deviceUsage = {
            measuredUsers: measuredDeviceUsers,
            mainlyMobile: mainlyMobileUsers,
            mainlyDesktop: Number(deviceUsageRow?.mainly_desktop) || 0,
            tied: Number(deviceUsageRow?.tied) || 0,
            mainlyMobilePercentage:
                measuredDeviceUsers > 0
                    ? Number(
                          (
                              (mainlyMobileUsers / measuredDeviceUsers) *
                              100
                          ).toFixed(1)
                      )
                    : null,
        };

        const onboarding = {
            registrationComplete: Number(onboardingRow?.registration_complete) || 0,
            step1: Number(onboardingRow?.step_1) || 0,
            step2: Number(onboardingRow?.step_2) || 0,
            step3: Number(onboardingRow?.step_3) || 0,
            step4: Number(onboardingRow?.step_4) || 0,
        };

        const historyResult = await query<OrderRow>(
            `
                SELECT
                    COALESCE(r.user_id::text, o.restaurant_id::text) AS account_id,
                    o.status::text AS status,
                    o.total_cents,
                    o.payment_method,
                    o.customer_phone,
                    o.created_at
                FROM orders AS o
                LEFT JOIN restaurants AS r
                    ON r.id = o.restaurant_id
                WHERE o.created_at < $1
                  AND o.table_id IS NULL
                ORDER BY o.created_at ASC
            `,
            [new Date(endAt).toISOString()]
        );

        const history = historyResult.rows.map(normalizeOrder);
        const selected = ordersInside(history, startAt, endAt);
        const activeWindow = ordersInside(history, endAt - 7 * DAY_MS, endAt);
        const customerWindow = ordersInside(history, endAt - 30 * DAY_MS, endAt);
        const firstOrders = firstOrderByAccount(history);
        const activatedAccounts = activatedAccountSet(firstOrders, startAt, endAt);
        const activeCustomerAccountSet = customerQualifiedAccounts(customerWindow);
        const churnSets = churnAccountSets(history, endAt);
        const cards = {
            activatedUsers: activatedAccounts.size,
            activeUsers: activeUserAccountSet(history, endAt).size,
            realActiveUsers: realActiveAccounts(activeWindow),
            activeCustomerUsers: activeCustomerAccountSet.size,
            moneyHandledCents: handledMoney(selected),
            onlineMoneyHandledCents: onlineMoney(selected),
            abandonedActiveUsers: churnSets.abandonedActiveUsers.size,
            abandonedActiveCustomerUsers:
                churnSets.abandonedActiveCustomerUsers.size,
        };
        const previousSelected = ordersInside(history, previousStartAt, startAt);
        const previousActiveWindow = ordersInside(
            history,
            startAt - 7 * DAY_MS,
            startAt
        );
        const previousCustomerWindow = ordersInside(
            history,
            startAt - 30 * DAY_MS,
            startAt
        );
        const previousCards = {
            activatedUsers: activatedAccountSet(
                firstOrders,
                previousStartAt,
                startAt
            ).size,
            activeUsers: activeUserAccountSet(history, startAt).size,
            realActiveUsers: realActiveAccounts(previousActiveWindow),
            activeCustomerUsers: customerQualifiedAccounts(previousCustomerWindow).size,
            moneyHandledCents: handledMoney(previousSelected),
            onlineMoneyHandledCents: onlineMoney(previousSelected),
        };
        const cardChanges = {
            activatedUsers: percentageChange(
                cards.activatedUsers,
                previousCards.activatedUsers
            ),
            activeUsers: percentageChange(
                cards.activeUsers,
                previousCards.activeUsers
            ),
            realActiveUsers: percentageChange(
                cards.realActiveUsers,
                previousCards.realActiveUsers
            ),
            activeCustomerUsers: percentageChange(
                cards.activeCustomerUsers,
                previousCards.activeCustomerUsers
            ),
            moneyHandledCents: percentageChange(
                cards.moneyHandledCents,
                previousCards.moneyHandledCents
            ),
            onlineMoneyHandledCents: percentageChange(
                cards.onlineMoneyHandledCents,
                previousCards.onlineMoneyHandledCents
            ),
        };

        const accountNamesResult = await query<{
            account_id: string;
            restaurant_name: string;
        }>(
            `
                SELECT
                    COALESCE(user_id::text, id::text) AS account_id,
                    string_agg(
                        COALESCE(NULLIF(BTRIM(name), ''), 'Restaurante'),
                        ', '
                        ORDER BY COALESCE(NULLIF(BTRIM(name), ''), 'Restaurante')
                    ) AS restaurant_name
                FROM restaurants
                GROUP BY COALESCE(user_id::text, id::text)
            `
        );
        const accountNames = new Map(
            accountNamesResult.rows.map((row) => [
                row.account_id,
                row.restaurant_name,
            ])
        );
        const abandonedUsers = [...churnSets.abandonedActiveUsers]
            .map((accountId) => ({
                accountId,
                restaurantName: accountNames.get(accountId) || "Restaurante",
                activeCustomerAbandoned:
                    churnSets.abandonedActiveCustomerUsers.has(accountId),
            }))
            .sort(
                (a, b) =>
                    Number(b.activeCustomerAbandoned) -
                        Number(a.activeCustomerAbandoned) ||
                    a.restaurantName.localeCompare(b.restaurantName, "pt-BR")
            );

        const metricSeries = {
            activatedUsers: [] as SeriesPoint[],
            activatedUsersPerDay: [] as SeriesPoint[],
            activeUsers: [] as SeriesPoint[],
            realActiveUsers: [] as SeriesPoint[],
            activeCustomerUsers: [] as SeriesPoint[],
            moneyHandledCents: [] as SeriesPoint[],
            onlineMoneyHandledCents: [] as SeriesPoint[],
            abandonedActiveUsers: [] as SeriesPoint[],
            abandonedActiveCustomerUsers: [] as SeriesPoint[],
        };
        const abandonmentRates = {
            activeUsers: [] as SeriesPoint[],
            activeCustomerUsers: [] as SeriesPoint[],
        };

        const paymentMethods = new Set<string>();
        const paymentValuesByBucket: Array<Map<string, number>> = [];

        for (const bucket of buckets) {
            const bucketOrders = ordersInside(history, bucket.start, bucket.end);
            const activeBucketWindow = ordersInside(
                history,
                bucket.end - 7 * DAY_MS,
                bucket.end
            );
            const churn = churnAt(history, bucket.end);

            metricSeries.activatedUsers.push({
                label: bucket.label,
                value: activatedAccountSet(
                    firstOrders,
                    bucket.start,
                    bucket.end
                ).size,
            });
            metricSeries.activatedUsersPerDay.push({
                label: bucket.label,
                value: Number(
                    (
                        activatedAccountSet(
                            firstOrders,
                            bucket.end - 7 * DAY_MS,
                            bucket.end
                        ).size / 7
                    ).toFixed(2)
                ),
            });
            metricSeries.activeUsers.push({
                label: bucket.label,
                value: activeUserAccountSet(history, bucket.end).size,
            });
            metricSeries.realActiveUsers.push({
                label: bucket.label,
                value: realActiveAccounts(activeBucketWindow),
            });
            metricSeries.activeCustomerUsers.push({
                label: bucket.label,
                value: activeCustomersAt(history, bucket.end),
            });
            metricSeries.moneyHandledCents.push({
                label: bucket.label,
                value: handledMoney(bucketOrders),
            });
            metricSeries.onlineMoneyHandledCents.push({
                label: bucket.label,
                value: onlineMoney(bucketOrders),
            });
            metricSeries.abandonedActiveUsers.push({
                label: bucket.label,
                value: churn.abandonedActiveUsers,
            });
            metricSeries.abandonedActiveCustomerUsers.push({
                label: bucket.label,
                value: churn.abandonedActiveCustomerUsers,
            });
            abandonmentRates.activeUsers.push({
                label: bucket.label,
                value: percentage(
                    churn.abandonedActiveUsers,
                    churn.eligibleActiveUsers
                ),
            });
            abandonmentRates.activeCustomerUsers.push({
                label: bucket.label,
                value: percentage(
                    churn.abandonedActiveCustomerUsers,
                    churn.eligibleActiveCustomerUsers
                ),
            });

            const bucketPayments = new Map<string, number>();
            for (const order of bucketOrders.filter(isHandledOrder)) {
                paymentMethods.add(order.paymentMethod);
                bucketPayments.set(
                    order.paymentMethod,
                    (bucketPayments.get(order.paymentMethod) || 0) + order.totalCents
                );
            }
            paymentValuesByBucket.push(bucketPayments);
        }

        const paymentSeries = [...paymentMethods]
            .sort((a, b) => paymentLabel(a).localeCompare(paymentLabel(b), "pt-BR"))
            .map((method) => ({
                key: method,
                label: paymentLabel(method),
                values: paymentValuesByBucket.map((bucket) => bucket.get(method) || 0),
            }));

        const orderSeries = buckets.map((bucket) => ({
            label: bucket.label,
            value: distinctCustomers(
                ordersInside(history, bucket.start, bucket.end).filter(isHandledOrder)
            ),
        }));

        const consumerPipeline = buildConsumerPipeline(
            consumerTracking,
            Number(orderCountResult.rows[0]?.total_orders) || 0
        );

        const pipeline = [
            {
                key: "landing_views",
                label: "Visualizações LP Únicas",
                value: postHog.landingViews,
                conversion: null,
                available: postHog.available,
                note: postHog.available ? "PostHog" : "PostHog ainda não conectado",
            },
            {
                key: "register_clicks",
                label: "Cliques Registrar Únicos",
                value: postHog.registerClicks,
                conversion: conversion(postHog.registerClicks, postHog.landingViews),
                available: postHog.available,
                note: postHog.available
                    ? "Acessos à página /restaurante/registrar"
                    : "PostHog ainda não conectado",
            },
            {
                key: "registration_complete",
                label: "Registro completo",
                value: onboarding.registrationComplete,
                conversion: conversion(
                    onboarding.registrationComplete,
                    postHog.registerClicks
                ),
                available: true,
                note: postHog.available
                    ? "Contas criadas no Supabase Auth no período"
                    : "Supabase Auth; conversão anterior aguarda PostHog",
            },
            {
                key: "step_1",
                label: "Passo 1",
                value: onboarding.step1,
                conversion: conversion(
                    onboarding.step1,
                    onboarding.registrationComplete
                ),
                available: true,
                note: postHog.available
                    ? "Usuários que avançaram da seleção para a etapa 1"
                    : "Usuários da coorte que chegaram à etapa 1; conversão anterior aguarda PostHog",
            },
            {
                key: "step_2",
                label: "Passo 2",
                value: onboarding.step2,
                conversion: conversion(onboarding.step2, onboarding.step1),
                available: true,
                note: null,
            },
            {
                key: "step_3",
                label: "Passo 3",
                value: onboarding.step3,
                conversion: conversion(onboarding.step3, onboarding.step2),
                available: true,
                note: null,
            },
            {
                key: "step_4",
                label: "Passo 4",
                value: onboarding.step4,
                conversion: conversion(onboarding.step4, onboarding.step3),
                available: true,
                note: null,
            },
            {
                key: "activated_users",
                label: "Usuários ativados",
                value: cards.activatedUsers,
                conversion: null,
                available: true,
                note: "Mesmo valor do KPI: primeiro pedido da conta no período",
            },
        ];

        return NextResponse.json(
            {
                range: {
                    key: range,
                    startAt: new Date(startAt).toISOString(),
                    endAt: new Date(endAt).toISOString(),
                    bucket: range === "90d" ? "week" : "day",
                },
                cards,
                productOverview: buildProductOverview(
                    postHog.productPageViews,
                    cards.activatedUsers,
                    { count: churnSets.abandonedActiveUsers.size, base: churnSets.eligibleActiveUsers.size },
                    addonProductMetricsResult.rows,
                    panelTabUsage
                ),
                cardChanges,
                deviceUsage,
                series: metricSeries,
                abandonmentRates,
                abandonedUsers,
                paymentMethods: {
                    labels: buckets.map((bucket) => bucket.label),
                    datasets: paymentSeries,
                },
                pipeline,
                consumerPipeline,
                consumerTimeline: {
                    menuViews: consumerTimeline.menuViews,
                    cartAdds: consumerTimeline.cartAdds,
                    averageCartCents: consumerTimeline.averageCartCents,
                    orders: orderSeries,
                },
                tracking: {
                    postHogAvailable: postHog.available,
                    blogViews: postHog.blogViews,
                    publicContentPageViews: postHog.publicContentPageViews,
                    totalPageViews: postHog.totalPageViews,
                    timeline: pageViewTimeline,
                },
                panelTabs: panelTabUsage,
                traffic: seoTraffic,
                generatedAt: new Date().toISOString(),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[DEV_DASHBOARD] Failed:", error);
        return NextResponse.json(
            { error: "Não foi possível carregar o dashboard." },
            { status: 500 }
        );
    }
}
