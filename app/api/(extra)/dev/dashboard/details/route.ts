import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";
import { DID_NOT_ACTIVATE_BLAST_MESSAGE } from "@/lib/dev/didNotActivateBlast";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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
    customer_phone: string | null;
    created_at: string | Date;
};

type NormalizedOrder = {
    accountId: string;
    status: string;
    totalCents: number;
    customerKey: string | null;
    createdAt: number;
};

type AccountDetailsRow = {
    account_id: string;
    restaurant_name: string;
    phone: string | null;
    store_whatsapp: string | null;
};

type DidNotActivateRow = {
    restaurant_id: string;
    restaurant_name: string;
    owner_phone: string | null;
    order_attempts: number | string;
    last_order_at: string | Date;
    already_blasted_this_month: boolean;
};

type QrTablePurchaseSummaryRow = {
    onboarding_purchases: number | string;
    management_purchases: number | string;
};

type QrTableBuyerRow = {
    restaurant_id: string;
    restaurant_name: string;
    domain: string | null;
    slug: string | null;
    status: string;
    acquisition_source: string | null;
    activated_at: string | Date | null;
    current_period_ends_at: string | Date | null;
    table_count: number | string;
};

type AddonMonthlyRevenueRow = {
    product_key: string;
    subscription_count: number | string;
    monthly_revenue_cents: number | string | null;
};

type AddonBillingHealthRow = {
    current_payers: number | string;
    current_pix_payers: number | string;
    current_card_payers: number | string;
    current_pix_value_cents: number | string;
    pix_churn_base: number | string;
    card_churn_base: number | string;
    total_churn_base: number | string;
    pix_churn_count: number | string;
    card_churn_count: number | string;
    total_churn_count: number | string;
    new_payers_this_month: number | string;
    revenue_received_this_month_cents: number | string;
};

type PixPayerRow = {
    restaurant_id: string;
    restaurant_name: string;
    slug: string | null;
    product_key: string;
    amount_cents: number | string;
    paid_at: string | Date;
    current_period_ends_at: string | Date | null;
    active: boolean;
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
        customerKey: normalizePhone(row.customer_phone),
        createdAt: toTimestamp(row.created_at),
    };
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

const PURCHASE_DAY_FORMATTER = new Intl.DateTimeFormat("en-CA", {
    timeZone: TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
});

function purchaseDayKey(timestamp: number): string {
    return PURCHASE_DAY_FORMATTER.format(new Date(timestamp));
}

function accountsWithMinPurchaseDays(
    orders: NormalizedOrder[],
    minimumDays: number
): Set<string> {
    const daysByAccount = new Map<string, Set<string>>();

    for (const order of orders) {
        if (order.status !== "done") continue;
        const days = daysByAccount.get(order.accountId) || new Set<string>();
        days.add(purchaseDayKey(order.createdAt));
        daysByAccount.set(order.accountId, days);
    }

    return new Set(
        [...daysByAccount.entries()]
            .filter(([, days]) => days.size >= minimumDays)
            .map(([accountId]) => accountId)
    );
}

function isHandledOrder(order: NormalizedOrder): boolean {
    return order.status !== "canceled" && order.status !== "pending_online_payment";
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

function postHogApiHost(value: string): string {
    return value
        .trim()
        .replace(/\/+$/, "")
        .replace("://us.i.posthog.com", "://us.posthog.com")
        .replace("://eu.i.posthog.com", "://eu.posthog.com");
}

function getPostHogConfig(): {
    personalApiKey: string;
    projectId: string;
    rawHost: string;
} | null {
    const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
    const rawHost =
        process.env.POSTHOG_API_HOST?.trim() ||
        process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

    if (!personalApiKey || !projectId || !rawHost) return null;
    return { personalApiKey, projectId, rawHost };
}

async function runPostHogQuery(hogql: string): Promise<unknown[][]> {
    const config = getPostHogConfig();
    if (!config) throw new Error("PostHog não configurado.");

    const response = await fetch(
        `${postHogApiHost(config.rawHost)}/api/projects/${encodeURIComponent(
            config.projectId
        )}/query/`,
        {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.personalApiKey}`,
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
    return payload.results || [];
}

async function loadTrafficSummary(
    startAt: number,
    endAt: number
): Promise<{ appViews: number | null; landingViews: number | null }> {
    if (!getPostHogConfig()) {
        return { appViews: null, landingViews: null };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const hogql = `
        SELECT
            countIf(
                event = '$pageview'
                AND (
                    properties.$pathname = '/blog'
                    OR startsWith(toString(properties.$pathname), '/blog/')
                    OR properties.$pathname = '/ferramentas'
                    OR startsWith(toString(properties.$pathname), '/ferramentas/')
                    OR properties.$pathname = '/cardapio-digital'
                    OR properties.$pathname = '/cardapio-digital-gratuito'
                    OR properties.$pathname = '/gestor-de-pedidos'
                    OR properties.$pathname = '/goomer'
                    OR properties.$pathname = '/anota-ai'
                    OR properties.$pathname = '/saipos'
                    OR properties.$pathname = '/restaurantes'
                    OR startsWith(toString(properties.$pathname), '/restaurantes/')
                    OR properties.$pathname = '/restaurante'
                    OR startsWith(toString(properties.$pathname), '/restaurante/')
                )
            ) AS app_views,
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/'
            ) AS landing_views
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
    `;

    try {
        const row = (await runPostHogQuery(hogql))[0];
        if (!row) throw new Error("PostHog returned no result row.");

        return {
            appViews: Number(row[0]) || 0,
            landingViews: Number(row[1]) || 0,
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD_DETAILS] PostHog unavailable:", error);
        return { appViews: null, landingViews: null };
    }
}

async function loadFunnelSummary(
    startAt: number,
    endAt: number
): Promise<{
    registrationComplete: number | null;
    step1Views: number | null;
    step2Views: number | null;
    step3Views: number | null;
    step4Views: number | null;
    orderedConsumers: number | null;
}> {
    if (!getPostHogConfig()) {
        return {
            registrationComplete: null,
            step1Views: null,
            step2Views: null,
            step3Views: null,
            step4Views: null,
            orderedConsumers: null,
        };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const orderPathRegex =
        '^/[^/]+/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    const legacyOrderPathRegex =
        '^/pedido/[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$';
    const onboardingHogql = `
        SELECT
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/criar/cardapio'
            ),
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/criar/disponibilidade'
            ),
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/criar/loja'
            ),
            countIf(
                event = '$pageview'
                AND properties.$pathname = '/restaurante/criar/localizacao'
            )
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
    `;
    const orderedHogql = `
        SELECT count()
        FROM (
            SELECT distinct_id
            FROM events
            WHERE timestamp >= parseDateTimeBestEffort('${start}')
              AND timestamp < parseDateTimeBestEffort('${end}')
              AND event IN (
                  '$pageview',
                  '${CONSUMER_EVENTS.paymentStarted}'
              )
            GROUP BY distinct_id
            HAVING countIf(
                event = '${CONSUMER_EVENTS.paymentStarted}'
            ) > 0
              AND countIf(
                    event = '$pageview'
                    AND (
                        match(toString(properties.$pathname), '${orderPathRegex}')
                        OR match(toString(properties.$pathname), '${legacyOrderPathRegex}')
                    )
              ) > 0
        )
    `;

    try {
        const [onboardingRows, orderedRows] = await Promise.all([
            runPostHogQuery(onboardingHogql),
            runPostHogQuery(orderedHogql),
        ]);
        const onboardingRow = onboardingRows[0];
        if (!onboardingRow) throw new Error("PostHog returned no onboarding result row.");

        const step1Views = Number(onboardingRow[0]) || 0;
        return {
            registrationComplete: step1Views,
            step1Views,
            step2Views: Number(onboardingRow[1]) || 0,
            step3Views: Number(onboardingRow[2]) || 0,
            step4Views: Number(onboardingRow[3]) || 0,
            orderedConsumers: Number(orderedRows[0]?.[0]) || 0,
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD_DETAILS] Funnel metrics unavailable:", error);
        return {
            registrationComplete: null,
            step1Views: null,
            step2Views: null,
            step3Views: null,
            step4Views: null,
            orderedConsumers: null,
        };
    }
}

async function loadQrTableFunnelSummary(
    startAt: number,
    endAt: number
): Promise<{
    onboardingViewed: number | null;
    onboardingSelected: number | null;
    onboardingLearnMore: number | null;
    managementViewed: number | null;
    managementLearnMore: number | null;
}> {
    if (!getPostHogConfig()) {
        return {
            onboardingViewed: null,
            onboardingSelected: null,
            onboardingLearnMore: null,
            managementViewed: null,
            managementLearnMore: null,
        };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const hogql = `
        SELECT
            uniqIf(distinct_id, event = 'qr_code_mesa_onboarding_viewed'),
            uniqIf(distinct_id, event = 'qr_code_mesa_onboarding_selected'),
            uniqIf(
                distinct_id,
                event = 'qr_code_mesa_learn_more_viewed'
                AND properties.source = 'onboarding'
            ),
            uniqIf(
                distinct_id,
                event IN (
                    'qr_code_mesa_page_viewed',
                    'qr_code_mesa_settings_viewed'
                )
            ),
            uniqIf(
                distinct_id,
                event = 'qr_code_mesa_learn_more_viewed'
                AND properties.source IN ('mesas', 'settings')
            )
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
    `;

    try {
        const row = (await runPostHogQuery(hogql))[0];
        if (!row) throw new Error("PostHog returned no result row.");

        return {
            onboardingViewed: Number(row[0]) || 0,
            onboardingSelected: Number(row[1]) || 0,
            onboardingLearnMore: Number(row[2]) || 0,
            managementViewed: Number(row[3]) || 0,
            managementLearnMore: Number(row[4]) || 0,
        };
    } catch (error) {
        console.warn(
            "[DEV_DASHBOARD_DETAILS] QR Code Mesa funnel unavailable:",
            error
        );
        return {
            onboardingViewed: null,
            onboardingSelected: null,
            onboardingLearnMore: null,
            managementViewed: null,
            managementLearnMore: null,
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
        const inactivityStart = endAt - 7 * DAY_MS;
        const historyStart = inactivityStart - 30 * DAY_MS;
        const didNotActivateStart = endAt - 30 * DAY_MS;

        const [
            historyResult,
            accountDetailsResult,
            didNotActivateResult,
            trafficSummary,
            funnelSummary,
            qrTableFunnelSummary,
            qrTablePurchaseSummaryResult,
            qrTableBuyersResult,
            addonMonthlyRevenueResult,
            addonBillingHealthResult,
            pixPayersResult,
        ] = await Promise.all([
            query<OrderRow>(
                `
                    SELECT
                        COALESCE(r.user_id::text, o.restaurant_id::text) AS account_id,
                        o.status::text AS status,
                        o.total_cents,
                        o.customer_phone,
                        o.created_at
                    FROM orders AS o
                    LEFT JOIN restaurants AS r
                        ON r.id = o.restaurant_id
                    WHERE o.created_at >= $1
                      AND o.created_at < $2
                      AND o.table_id IS NULL
                    ORDER BY o.created_at ASC
                `,
                [
                    new Date(historyStart).toISOString(),
                    new Date(endAt).toISOString(),
                ]
            ),
            query<AccountDetailsRow>(
                `
                    SELECT
                        COALESCE(user_id::text, id::text) AS account_id,
                        string_agg(
                            DISTINCT COALESCE(NULLIF(BTRIM(name), ''), 'Restaurante'),
                            ', '
                        ) AS restaurant_name,
                        string_agg(
                            DISTINCT NULLIF(BTRIM(phone), ''),
                            ', '
                        ) FILTER (WHERE NULLIF(BTRIM(phone), '') IS NOT NULL) AS phone,
                        string_agg(
                            DISTINCT NULLIF(BTRIM(store_whatsapp), ''),
                            ', '
                        ) FILTER (WHERE NULLIF(BTRIM(store_whatsapp), '') IS NOT NULL) AS store_whatsapp
                    FROM restaurants
                    GROUP BY COALESCE(user_id::text, id::text)
                `
            ),
            query<DidNotActivateRow>(
                `
                    WITH raw_candidates AS (
                        SELECT
                            r.id::text AS restaurant_id,
                            COALESCE(
                                NULLIF(BTRIM(r.name), ''),
                                'Restaurante'
                            ) AS restaurant_name,
                            COALESCE(
                                NULLIF(
                                    regexp_replace(
                                        COALESCE(r.phone, ''),
                                        '[^0-9]',
                                        '',
                                        'g'
                                    ),
                                    ''
                                ),
                                NULLIF(
                                    regexp_replace(
                                        COALESCE(
                                            u.raw_user_meta_data->>'phone',
                                            ''
                                        ),
                                        '[^0-9]',
                                        '',
                                        'g'
                                    ),
                                    ''
                                )
                            ) AS owner_phone_raw,
                            COUNT(*)::int AS order_attempts,
                            MAX(o.created_at) AS last_order_at
                        FROM restaurants AS r
                        INNER JOIN orders AS o
                            ON o.restaurant_id = r.id
                        LEFT JOIN auth.users AS u
                            ON u.id = r.user_id
                        WHERE o.created_at >= $1
                          AND o.created_at < $2
                          AND o.table_id IS NULL
                        GROUP BY
                            r.id,
                            r.name,
                            r.phone,
                            u.raw_user_meta_data
                        HAVING COUNT(
                            DISTINCT (
                                o.created_at AT TIME ZONE $3
                            )::date
                        ) = 1
                    ),
                    candidates AS (
                        SELECT
                            restaurant_id,
                            restaurant_name,
                            CASE
                                WHEN owner_phone_raw LIKE '55%'
                                  AND LENGTH(owner_phone_raw) IN (12, 13)
                                    THEN SUBSTRING(owner_phone_raw FROM 3)
                                ELSE owner_phone_raw
                            END AS owner_phone,
                            order_attempts,
                            last_order_at
                        FROM raw_candidates
                    )
                    SELECT
                        candidate.*,
                        EXISTS (
                            SELECT 1
                            FROM support_blast_recipients AS recipient
                            INNER JOIN support_blast_campaigns AS campaign
                                ON campaign.id = recipient.campaign_id
                            WHERE recipient.status = 'sent'
                              AND campaign.message = $4
                              AND campaign.created_at >=
                                  date_trunc(
                                      'month',
                                      NOW() AT TIME ZONE $3
                                  ) AT TIME ZONE $3
                              AND candidate.owner_phone IS NOT NULL
                              AND recipient.phone =
                                  '55' || candidate.owner_phone
                        ) AS already_blasted_this_month
                    FROM candidates AS candidate
                    ORDER BY
                        candidate.last_order_at DESC,
                        candidate.restaurant_name
                `,
                [
                    new Date(didNotActivateStart).toISOString(),
                    new Date(endAt).toISOString(),
                    TIME_ZONE,
                    DID_NOT_ACTIVATE_BLAST_MESSAGE,
                ]
            ),
            loadTrafficSummary(startAt, endAt),
            loadFunnelSummary(startAt, endAt),
            loadQrTableFunnelSummary(startAt, endAt),
            query<QrTablePurchaseSummaryRow>(
                `
                    SELECT
                        COUNT(*) FILTER (
                            WHERE acquisition_source = 'onboarding'
                        ) AS onboarding_purchases,
                        COUNT(*) FILTER (
                            WHERE acquisition_source IN ('mesas', 'settings')
                        ) AS management_purchases
                    FROM restaurant_addons
                    WHERE product_key = 'qr_code_mesa'
                      AND activated_at >= $1
                      AND activated_at < $2
                `,
                [new Date(startAt).toISOString(), new Date(endAt).toISOString()]
            ),
            query<QrTableBuyerRow>(
                `
                    SELECT
                        addon.restaurant_id,
                        COALESCE(NULLIF(BTRIM(restaurant.name), ''), 'Restaurante') AS restaurant_name,
                        NULLIF(BTRIM(restaurant.custom_domain), '') AS domain,
                        NULLIF(BTRIM(restaurant.url_slug), '') AS slug,
                        addon.status,
                        addon.acquisition_source,
                        addon.activated_at,
                        addon.current_period_ends_at,
                        COUNT(table_item.id) FILTER (
                            WHERE table_item.is_active = true
                        ) AS table_count
                    FROM restaurant_addons AS addon
                    INNER JOIN restaurants AS restaurant
                        ON restaurant.id = addon.restaurant_id
                    LEFT JOIN restaurant_tables AS table_item
                        ON table_item.restaurant_id = addon.restaurant_id
                    WHERE addon.product_key = 'qr_code_mesa'
                      AND (
                          addon.status = 'active'
                          OR (
                              addon.status IN ('canceled', 'past_due')
                              AND addon.current_period_ends_at > NOW()
                          )
                      )
                    GROUP BY
                        addon.restaurant_id,
                        restaurant.name,
                        restaurant.custom_domain,
                        restaurant.url_slug,
                        addon.status,
                        addon.acquisition_source,
                        addon.activated_at,
                        addon.current_period_ends_at
                    ORDER BY addon.activated_at DESC NULLS LAST
                `
            ),
            query<AddonMonthlyRevenueRow>(
                `
                    SELECT
                        product_key,
                        COUNT(*) AS subscription_count,
                        SUM(price_cents) AS monthly_revenue_cents
                    FROM restaurant_addons
                    WHERE status = 'active'
                      AND billing_cycle = 'monthly'
                      AND (
                          asaas_subscription_id IS NOT NULL
                          OR payzu_recurrence_id IS NOT NULL
                      )
                    GROUP BY product_key
                    ORDER BY product_key
                `
            ),
            query<AddonBillingHealthRow>(
                `
                    WITH latest_payment AS (
                        SELECT DISTINCT ON (addon.id)
                            addon.id AS addon_id,
                            addon.restaurant_id,
                            addon.product_key,
                            addon.status,
                            addon.activated_at,
                            addon.canceled_at,
                            addon.current_period_ends_at,
                            payment.billing_type,
                            payment.amount_cents,
                            payment.paid_at
                        FROM restaurant_addons AS addon
                        INNER JOIN restaurant_addon_payments AS payment
                            ON payment.addon_id = addon.id
                           AND payment.paid_at IS NOT NULL
                        ORDER BY addon.id, payment.paid_at DESC, payment.id DESC
                    ),
                    bounds AS (
                        SELECT
                            NOW() - INTERVAL '30 days' AS churn_start,
                            date_trunc('month', NOW() AT TIME ZONE $1)
                                AT TIME ZONE $1 AS month_start,
                            (date_trunc('month', NOW() AT TIME ZONE $1)
                                + INTERVAL '1 month') AT TIME ZONE $1 AS month_end
                    ),
                    base AS (
                        SELECT latest.*
                        FROM latest_payment AS latest
                        CROSS JOIN bounds
                        WHERE latest.current_period_ends_at > bounds.churn_start
                          AND COALESCE(latest.activated_at, latest.paid_at) < NOW()
                    ),
                    churned AS (
                        SELECT latest.*
                        FROM latest_payment AS latest
                        CROSS JOIN bounds
                        WHERE (
                            latest.billing_type = 'CREDIT_CARD'
                            AND latest.canceled_at >= bounds.churn_start
                            AND latest.canceled_at < NOW()
                        ) OR (
                            latest.billing_type = 'PIX'
                            AND latest.current_period_ends_at >= bounds.churn_start
                            AND latest.current_period_ends_at < NOW()
                        )
                    ),
                    current_paid AS (
                        SELECT latest.*
                        FROM latest_payment AS latest
                        WHERE (
                            latest.billing_type = 'PIX'
                            AND latest.current_period_ends_at > NOW()
                        ) OR (
                            latest.billing_type = 'CREDIT_CARD'
                            AND latest.status = 'active'
                            AND latest.current_period_ends_at > NOW()
                        )
                    ),
                    first_paid AS (
                        SELECT
                            addon.restaurant_id,
                            MIN(payment.paid_at) AS first_paid_at
                        FROM restaurant_addons AS addon
                        INNER JOIN restaurant_addon_payments AS payment
                            ON payment.addon_id = addon.id
                           AND payment.paid_at IS NOT NULL
                        GROUP BY addon.restaurant_id
                    )
                    SELECT
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM current_paid
                        ) AS current_payers,
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM current_paid
                            WHERE billing_type = 'PIX'
                        ) AS current_pix_payers,
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM current_paid
                            WHERE billing_type = 'CREDIT_CARD'
                        ) AS current_card_payers,
                        (
                            SELECT COALESCE(SUM(amount_cents), 0)
                            FROM current_paid
                            WHERE billing_type = 'PIX'
                        ) AS current_pix_value_cents,
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM base
                            WHERE billing_type = 'PIX'
                        ) AS pix_churn_base,
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM base
                            WHERE billing_type = 'CREDIT_CARD'
                        ) AS card_churn_base,
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM base
                        ) AS total_churn_base,
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM churned
                            WHERE billing_type = 'PIX'
                        ) AS pix_churn_count,
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM churned
                            WHERE billing_type = 'CREDIT_CARD'
                        ) AS card_churn_count,
                        (
                            SELECT COUNT(DISTINCT restaurant_id)
                            FROM churned
                        ) AS total_churn_count,
                        (
                            SELECT COUNT(*)
                            FROM first_paid
                            CROSS JOIN bounds
                            WHERE first_paid_at >= bounds.month_start
                              AND first_paid_at < LEAST(bounds.month_end, NOW())
                        ) AS new_payers_this_month,
                        (
                            SELECT COALESCE(SUM(payment.amount_cents), 0)
                            FROM restaurant_addon_payments AS payment
                            CROSS JOIN bounds
                            WHERE payment.paid_at >= bounds.month_start
                              AND payment.paid_at < LEAST(bounds.month_end, NOW())
                        ) AS revenue_received_this_month_cents
                `,
                [TIME_ZONE]
            ),
            query<PixPayerRow>(
                `
                    SELECT DISTINCT ON (addon.id)
                        addon.restaurant_id,
                        COALESCE(
                            NULLIF(BTRIM(restaurant.name), ''),
                            'Restaurante'
                        ) AS restaurant_name,
                        NULLIF(BTRIM(restaurant.url_slug), '') AS slug,
                        addon.product_key,
                        payment.amount_cents,
                        payment.paid_at,
                        addon.current_period_ends_at,
                        addon.current_period_ends_at > NOW() AS active
                    FROM restaurant_addons AS addon
                    INNER JOIN restaurants AS restaurant
                        ON restaurant.id = addon.restaurant_id
                    INNER JOIN restaurant_addon_payments AS payment
                        ON payment.addon_id = addon.id
                       AND payment.paid_at IS NOT NULL
                       AND payment.billing_type = 'PIX'
                    ORDER BY addon.id, payment.paid_at DESC, payment.id DESC
                `
            ),
        ]);

        const history = historyResult.rows.map(normalizeOrder);
        const last30DayDoneOrders = ordersInside(
            history,
            endAt - 30 * DAY_MS,
            endAt
        ).filter((order) => order.status === "done");
        const last14DayDoneOrders = ordersInside(
            history,
            endAt - 14 * DAY_MS,
            endAt
        ).filter((order) => order.status === "done");
        const eligibleActiveAccounts = accountsWithMinPurchaseDays(
            last30DayDoneOrders,
            2
        );
        const recentlyActiveAccounts = accountsWithMinPurchaseDays(
            last14DayDoneOrders,
            1
        );
        const accountsWithRecentOrders = distinctAccountSet(
            ordersInside(history, inactivityStart, endAt)
        );
        const previouslyQualifiedCustomerAccounts = customerQualifiedAccounts(
            ordersInside(history, inactivityStart - 30 * DAY_MS, inactivityStart)
        );
        const abandonedAccounts = [...eligibleActiveAccounts].filter(
            (accountId) => !recentlyActiveAccounts.has(accountId)
        );

        const accountDetails = new Map(
            accountDetailsResult.rows.map((row) => [row.account_id, row])
        );

        const didNotActivateUsers = didNotActivateResult.rows.map((row) => ({
            restaurantId: row.restaurant_id,
            restaurantName: row.restaurant_name,
            ownerPhone: row.owner_phone,
            orderAttempts: Number(row.order_attempts) || 0,
            lastOrderAt: new Date(row.last_order_at).toISOString(),
            alreadyBlastedThisMonth: row.already_blasted_this_month === true,
        }));

        const abandonedUsers = abandonedAccounts
            .map((accountId) => {
                const priorOrders = last30DayDoneOrders.filter(
                    (order) => order.accountId === accountId
                );
                const details = accountDetails.get(accountId);
                const customerKeys = new Set(
                    priorOrders
                        .map((order) => order.customerKey)
                        .filter((value): value is string => Boolean(value))
                );
                const lastOrderAt = priorOrders.reduce(
                    (latest, order) => Math.max(latest, order.createdAt),
                    0
                );

                return {
                    accountId,
                    restaurantName: details?.restaurant_name || "Restaurante",
                    phone: details?.phone || null,
                    storeWhatsapp: details?.store_whatsapp || null,
                    activeCustomerAbandoned:
                        previouslyQualifiedCustomerAccounts.has(accountId),
                    last30DaysOrders: priorOrders.length,
                    last30DaysCustomers: customerKeys.size,
                    last30DaysGmvCents: priorOrders.reduce(
                        (total, order) => total + order.totalCents,
                        0
                    ),
                    lastOrderAt: lastOrderAt
                        ? new Date(lastOrderAt).toISOString()
                        : null,
                };
            })
            .sort(
                (a, b) =>
                    Number(b.activeCustomerAbandoned) -
                        Number(a.activeCustomerAbandoned) ||
                    b.last30DaysGmvCents - a.last30DaysGmvCents ||
                    a.restaurantName.localeCompare(b.restaurantName, "pt-BR")
            );

        const qrTablePurchaseSummary =
            qrTablePurchaseSummaryResult.rows[0];
        const qrTable = {
            onboarding: {
                viewed: qrTableFunnelSummary.onboardingViewed,
                selected: qrTableFunnelSummary.onboardingSelected,
                learnMore: qrTableFunnelSummary.onboardingLearnMore,
                purchased: Number(
                    qrTablePurchaseSummary?.onboarding_purchases
                ) || 0,
            },
            management: {
                viewed: qrTableFunnelSummary.managementViewed,
                learnMore: qrTableFunnelSummary.managementLearnMore,
                purchased: Number(
                    qrTablePurchaseSummary?.management_purchases
                ) || 0,
            },
            buyers: qrTableBuyersResult.rows.map((buyer) => ({
                restaurantId: buyer.restaurant_id,
                restaurantName: buyer.restaurant_name,
                domain: buyer.domain,
                slug: buyer.slug,
                status: buyer.status,
                source: buyer.acquisition_source,
                activatedAt: buyer.activated_at
                    ? new Date(buyer.activated_at).toISOString()
                    : null,
                currentPeriodEndsAt: buyer.current_period_ends_at
                    ? new Date(buyer.current_period_ends_at).toISOString()
                    : null,
                tableCount: Number(buyer.table_count) || 0,
            })),
        };

        const monthlyRevenueAddons = addonMonthlyRevenueResult.rows.map((addon) => ({
            productKey: addon.product_key,
            subscriptionCount: Number(addon.subscription_count) || 0,
            monthlyRevenueCents: Number(addon.monthly_revenue_cents) || 0,
        }));
        const addonBillingHealth = addonBillingHealthResult.rows[0];
        const monthlyRevenue = {
            addons: monthlyRevenueAddons,
            totalMonthlyRevenueCents: monthlyRevenueAddons.reduce(
                (total, addon) => total + addon.monthlyRevenueCents,
                0
            ),
            billing: {
                currentPayers: Number(addonBillingHealth?.current_payers) || 0,
                currentPixPayers:
                    Number(addonBillingHealth?.current_pix_payers) || 0,
                currentCardPayers:
                    Number(addonBillingHealth?.current_card_payers) || 0,
                currentPixValueCents:
                    Number(addonBillingHealth?.current_pix_value_cents) || 0,
                newPayersThisMonth:
                    Number(addonBillingHealth?.new_payers_this_month) || 0,
                revenueReceivedThisMonthCents:
                    Number(
                        addonBillingHealth?.revenue_received_this_month_cents
                    ) || 0,
                churn30d: {
                    pix: {
                        count: Number(addonBillingHealth?.pix_churn_count) || 0,
                        base: Number(addonBillingHealth?.pix_churn_base) || 0,
                    },
                    card: {
                        count: Number(addonBillingHealth?.card_churn_count) || 0,
                        base: Number(addonBillingHealth?.card_churn_base) || 0,
                    },
                    total: {
                        count: Number(addonBillingHealth?.total_churn_count) || 0,
                        base: Number(addonBillingHealth?.total_churn_base) || 0,
                    },
                },
            },
            pixPayers: pixPayersResult.rows
                .map((payer) => ({
                    restaurantId: payer.restaurant_id,
                    restaurantName: payer.restaurant_name,
                    slug: payer.slug,
                    productKey: payer.product_key,
                    amountCents: Number(payer.amount_cents) || 0,
                    paidAt: new Date(payer.paid_at).toISOString(),
                    currentPeriodEndsAt: payer.current_period_ends_at
                        ? new Date(payer.current_period_ends_at).toISOString()
                        : null,
                    active: payer.active,
                }))
                .sort(
                    (a, b) =>
                        new Date(b.paidAt).getTime() -
                        new Date(a.paidAt).getTime()
                ),
        };

        return NextResponse.json(
            {
                didNotActivateUsers,
                abandonedUsers,
                trafficSummary,
                funnelSummary,
                monthlyRevenue,
                qrTable,
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[DEV_DASHBOARD_DETAILS] Failed:", error);
        return NextResponse.json(
            { error: "Não foi possível carregar os detalhes do dashboard." },
            { status: 500 }
        );
    }
}
