import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildConsumerPipeline } from "@/lib/analytics/consumerPipeline";
import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";
import { loadPostHogConsumerMetrics } from "@/lib/analytics/posthogConsumer";
import { SEO_TRAFFIC_EVENTS } from "@/lib/analytics/seoTraffic";
import { query } from "@/lib/database/sql";
import { PUBLIC_CONTENT_PAGES } from "@/lib/seo/publicContent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;

const RANGE_KEYS = ["7d", "this_week", "last_week", "30d", "90d"] as const;
type RangeKey = (typeof RANGE_KEYS)[number];

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

type Bucket = {
    start: number;
    end: number;
    label: string;
};

type SeriesPoint = {
    label: string;
    value: number;
};

type OnboardingFunnelRow = {
    registration_complete: number | string;
    step_1: number | string;
    step_2: number | string;
    step_3: number | string;
    step_4: number | string;
};

type PostHogMetrics = {
    available: boolean;
    landingViews: number | null;
    registerClicks: number | null;
    beforeStartViews: number | null;
    blogViews: number | null;
};

type SeoTrafficMetrics = {
    available: boolean;
    pages: Array<{
        path: string;
        label: string;
        kind: string;
        visitors: number;
        homeVisitors: number;
        ratio: number;
    }>;
};

type ConsumerTimeline = {
    menuViews: SeriesPoint[];
    cartAdds: SeriesPoint[];
    averageCartCents: SeriesPoint[];
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

function toTimestamp(value: string | Date): number {
    return value instanceof Date ? value.getTime() : new Date(value).getTime();
}

function normalizePhone(value: string | null): string | null {
    let digits = String(value || "").replace(/\D/g, "");

    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        digits = digits.slice(2);
    }

    return digits.length >= 10 ? digits : null;
}

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

function ordersInside(
    orders: NormalizedOrder[],
    start: number,
    end: number
): NormalizedOrder[] {
    return orders.filter((order) => order.createdAt >= start && order.createdAt < end);
}

function distinctAccountSet(orders: NormalizedOrder[]): Set<string> {
    return new Set(orders.map((order) => order.accountId));
}

function distinctAccounts(orders: NormalizedOrder[]): number {
    return distinctAccountSet(orders).size;
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

function isHandledOrder(order: NormalizedOrder): boolean {
    return order.status !== "canceled" && order.status !== "pending_online_payment";
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

function customerQualifiedAccounts(orders: NormalizedOrder[]): Set<string> {
    const groups = new Map<string, { count: number; clients: Set<string> }>();

    for (const order of orders) {
        if (!isHandledOrder(order) || !order.customerKey) continue;
        const group = groups.get(order.accountId) || {
            count: 0,
            clients: new Set<string>(),
        };
        group.count += 1;
        group.clients.add(order.customerKey);
        groups.set(order.accountId, group);
    }

    return new Set(
        [...groups.entries()]
            .filter(([, group]) => group.count >= 4 && group.clients.size >= 4)
            .map(([accountId]) => accountId)
    );
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
    const inactivityStart = asOf - 7 * DAY_MS;
    const priorActiveWindow = ordersInside(
        orders,
        inactivityStart - 7 * DAY_MS,
        inactivityStart
    );
    const priorCustomerWindow = ordersInside(
        orders,
        inactivityStart - 30 * DAY_MS,
        inactivityStart
    );
    const accountsWithRecentOrders = distinctAccountSet(
        ordersInside(orders, inactivityStart, asOf)
    );
    const previouslyActiveAccounts = distinctAccountSet(
        priorActiveWindow.filter((order) => order.status === "done")
    );
    const previouslyQualifiedCustomerAccounts =
        customerQualifiedAccounts(priorCustomerWindow);

    return {
        abandonedActiveUsers: new Set(
            [...previouslyActiveAccounts].filter(
                (accountId) => !accountsWithRecentOrders.has(accountId)
            )
        ),
        abandonedActiveCustomerUsers: new Set(
            [...previouslyQualifiedCustomerAccounts].filter(
                (accountId) => !accountsWithRecentOrders.has(accountId)
            )
        ),
        eligibleActiveUsers: previouslyActiveAccounts,
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

function postHogApiHost(value: string): string {
    return value
        .trim()
        .replace(/\/+$/, "")
        .replace("://us.i.posthog.com", "://us.posthog.com")
        .replace("://eu.i.posthog.com", "://eu.posthog.com");
}

async function loadPostHogMetrics(
    startAt: number,
    endAt: number
): Promise<PostHogMetrics> {
    const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
    const rawHost =
        process.env.POSTHOG_API_HOST?.trim() ||
        process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

    if (!personalApiKey || !projectId || !rawHost) {
        return {
            available: false,
            landingViews: null,
            registerClicks: null,
            beforeStartViews: null,
            blogViews: null,
        };
    }

    const start = new Date(startAt)
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "");
    const end = new Date(endAt)
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "");

    const hogql = `
        SELECT
            countIf(event = '$pageview' AND properties.$pathname = '/') AS landing_views,
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/registrar'
            ) AS register_clicks,
            uniqIf(
                distinct_id,
                event = 'qr_code_mesa_onboarding_viewed'
            ) AS before_start_views,
            countIf(
                event = '$pageview'
                AND (
                    properties.$pathname = '/blog'
                    OR startsWith(toString(properties.$pathname), '/blog/')
                )
            ) AS blog_views
        FROM events
        WHERE timestamp >= toDateTime('${start}', 'UTC')
          AND timestamp < toDateTime('${end}', 'UTC')
    `;

    try {
        const response = await fetch(
            `${postHogApiHost(rawHost)}/api/projects/${encodeURIComponent(
                projectId
            )}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${personalApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogql,
                    },
                }),
                signal: AbortSignal.timeout(15_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`PostHog query failed with ${response.status}.`);
        }

        const payload = (await response.json()) as { results?: unknown[][] };
        const row = payload.results?.[0];

        if (!row) throw new Error("PostHog returned no result row.");

        return {
            available: true,
            landingViews: Number(row[0]) || 0,
            registerClicks: Number(row[1]) || 0,
            beforeStartViews: Number(row[2]) || 0,
            blogViews: Number(row[3]) || 0,
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD] PostHog metrics unavailable:", error);
        return {
            available: false,
            landingViews: null,
            registerClicks: null,
            beforeStartViews: null,
            blogViews: null,
        };
    }
}

async function loadPostHogSeoTraffic(
    startAt: number,
    endAt: number
): Promise<SeoTrafficMetrics> {
    const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
    const rawHost =
        process.env.POSTHOG_API_HOST?.trim() ||
        process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();
    const emptyPages = PUBLIC_CONTENT_PAGES.map((page) => ({
        ...page,
        visitors: 0,
        homeVisitors: 0,
        ratio: 0,
    }));

    if (!personalApiKey || !projectId || !rawHost) {
        return { available: false, pages: emptyPages };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const hogql = `
        SELECT
            if(
                event = '${SEO_TRAFFIC_EVENTS.pageViewed}',
                toString(properties.path),
                toString(properties.source_path)
            ) AS source_path,
            uniqIf(distinct_id, event = '${SEO_TRAFFIC_EVENTS.pageViewed}') AS visitors,
            uniqIf(distinct_id, event = '${SEO_TRAFFIC_EVENTS.homeClicked}') AS home_visitors
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event IN (
              '${SEO_TRAFFIC_EVENTS.pageViewed}',
              '${SEO_TRAFFIC_EVENTS.homeClicked}'
          )
        GROUP BY source_path
    `;

    try {
        const response = await fetch(
            `${postHogApiHost(rawHost)}/api/projects/${encodeURIComponent(
                projectId
            )}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${personalApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogql,
                    },
                }),
                signal: AbortSignal.timeout(15_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`PostHog query failed with ${response.status}.`);
        }

        const payload = (await response.json()) as { results?: unknown[][] };
        const metricsByPath = new Map(
            (payload.results || []).map((row) => [
                String(row[0] || ""),
                {
                    visitors: Number(row[1]) || 0,
                    homeVisitors: Number(row[2]) || 0,
                },
            ])
        );

        return {
            available: true,
            pages: PUBLIC_CONTENT_PAGES.map((page) => {
                const metrics = metricsByPath.get(page.path) || {
                    visitors: 0,
                    homeVisitors: 0,
                };
                return {
                    ...page,
                    ...metrics,
                    ratio:
                        metrics.visitors > 0
                            ? Number(
                                  (
                                      (metrics.homeVisitors / metrics.visitors) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                };
            }),
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD] SEO traffic unavailable:", error);
        return { available: false, pages: emptyPages };
    }
}


async function loadPostHogConsumerTimeline(
    buckets: Bucket[]
): Promise<ConsumerTimeline> {
    const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
    const rawHost =
        process.env.POSTHOG_API_HOST?.trim() ||
        process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

    if (!personalApiKey || !projectId || !rawHost || !buckets.length) {
        return {
            menuViews: [],
            cartAdds: [],
            averageCartCents: [],
        };
    }

    const bucketExpression = buckets
        .map(
            (bucket, index) => `
                timestamp >= parseDateTimeBestEffort('${new Date(
                    bucket.start
                ).toISOString()}')
                AND timestamp < parseDateTimeBestEffort('${new Date(
                    bucket.end
                ).toISOString()}'), ${index}`
        )
        .join(",");

    const start = new Date(buckets[0].start).toISOString();
    const end = new Date(buckets[buckets.length - 1].end).toISOString();
    const hogql = `
        SELECT
            multiIf(${bucketExpression}, -1) AS bucket_index,
            uniqIf(distinct_id, event = '${CONSUMER_EVENTS.menuViewed}') AS menu_views,
            uniqIf(distinct_id, event = '${CONSUMER_EVENTS.itemAddedToCart}') AS cart_adds,
            avgIf(
                properties.cart_total_cents,
                event = '${CONSUMER_EVENTS.itemAddedToCart}'
            ) AS average_cart_cents
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event IN (
              '${CONSUMER_EVENTS.menuViewed}',
              '${CONSUMER_EVENTS.itemAddedToCart}'
          )
          AND NOT startsWith(
              coalesce(toString(properties.$pathname), ''),
              '/mesa/'
          )
          AND NOT startsWith(
              coalesce(toString(properties.consumer_pathname), ''),
              '/mesa/'
          )
        GROUP BY bucket_index
        HAVING bucket_index >= 0
        ORDER BY bucket_index
    `;

    try {
        const response = await fetch(
            `${postHogApiHost(rawHost)}/api/projects/${encodeURIComponent(
                projectId
            )}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${personalApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogql,
                    },
                }),
                signal: AbortSignal.timeout(15_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`PostHog query failed with ${response.status}.`);
        }

        const payload = (await response.json()) as { results?: unknown[][] };
        const rows = payload.results || [];
        const byBucket = new Map<
            number,
            { menuViews: number; cartAdds: number; averageCartCents: number }
        >(
            rows.map(
                (row) =>
                    [
                        Number(row[0]),
                        {
                            menuViews: Number(row[1]) || 0,
                            cartAdds: Number(row[2]) || 0,
                            averageCartCents: Number(row[3]) || 0,
                        },
                    ] as const
            )
        );

        return {
            menuViews: buckets.map((bucket, index) => ({
                label: bucket.label,
                value: byBucket.get(index)?.menuViews || 0,
            })),
            cartAdds: buckets.map((bucket, index) => ({
                label: bucket.label,
                value: byBucket.get(index)?.cartAdds || 0,
            })),
            averageCartCents: buckets.map((bucket, index) => ({
                label: bucket.label,
                value: byBucket.get(index)?.averageCartCents || 0,
            })),
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD] Consumer timeline unavailable:", error);
        return {
            menuViews: [],
            cartAdds: [],
            averageCartCents: [],
        };
    }
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
        const startIso = new Date(startAt).toISOString();
        const endIso = new Date(endAt).toISOString();
        const buckets = buildBuckets(startAt, endAt, range);

        const [
            onboardingResult,
            postHog,
            consumerTracking,
            consumerTimeline,
            seoTraffic,
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
                loadPostHogConsumerMetrics(startAt, endAt),
                loadPostHogConsumerTimeline(buckets),
                loadPostHogSeoTraffic(startAt, endAt),
            ]);

        const onboardingRow = onboardingResult.rows[0];
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
            activeUsers: distinctAccounts(
                activeWindow.filter((order) => order.status === "done")
            ),
            realActiveUsers: realActiveAccounts(activeWindow),
            activeCustomerUsers: activeCustomerAccountSet.size,
            moneyHandledCents: handledMoney(selected),
            onlineMoneyHandledCents: onlineMoney(selected),
            abandonedActiveUsers: churnSets.abandonedActiveUsers.size,
            abandonedActiveCustomerUsers:
                churnSets.abandonedActiveCustomerUsers.size,
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
            const bucketDoneOrders = activeBucketWindow.filter(
                (order) => order.status === "done"
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
            metricSeries.activeUsers.push({
                label: bucket.label,
                value: distinctAccounts(bucketDoneOrders),
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
            distinctCustomers(selected.filter(isHandledOrder))
        );

        const pipeline = [
            {
                key: "landing_views",
                label: "Visualizações da landing page",
                value: postHog.landingViews,
                conversion: null,
                available: postHog.available,
                note: postHog.available ? "PostHog" : "PostHog ainda não conectado",
            },
            {
                key: "register_clicks",
                label: "Cliques em Registrar",
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
                key: "before_start",
                label: "Antes de começar",
                value: postHog.beforeStartViews,
                conversion: conversion(
                    postHog.beforeStartViews,
                    onboarding.registrationComplete
                ),
                available: postHog.available,
                note: postHog.available
                    ? "Acessaram a seleção de sistemas antes do passo 1"
                    : "PostHog ainda não conectado",
            },
            {
                key: "step_1",
                label: "Passo 1",
                value: onboarding.step1,
                conversion: conversion(
                    onboarding.step1,
                    postHog.beforeStartViews
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
                },
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
