import { parseRange, toTimestamp, normalizePhone, ordersInside, distinctAccountSet, accountsWithMinPurchaseDays, isHandledOrder, customerQualifiedAccounts, type RangeKey } from "@/lib/dev/dashboardMetrics";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";

import { DID_NOT_ACTIVATE_BLAST_MESSAGE } from "@/lib/dev/didNotActivateBlast";
import { query } from "@/lib/database/sql";
import { loadTrafficSummary, loadFunnelSummary, loadQrTableFunnelSummary } from "@/lib/dev/dashboardDetailsPosthog";

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

type AddonMonthlyProductPaymentsRow = {
    product_key: string;
    payers: number | string;
    confirmed_payments: number | string;
    received_cents: number | string;
};

type AddonPaymentDropoffRow = {
    product_key: string;
    restaurant_id: string;
    restaurant_name: string;
    status: string;
    billing_type: string | null;
    created_at: string | Date;
    total: number | string;
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




function normalizeOrder(row: OrderRow): NormalizedOrder {
    return {
        accountId: row.account_id,
        status: row.status,
        totalCents: Math.max(0, Number(row.total_cents) || 0),
        customerKey: normalizePhone(row.customer_phone),
        createdAt: toTimestamp(row.created_at),
    };
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
        const didNotActivateStart = endAt - 14 * DAY_MS;

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
            addonMonthlyProductPaymentsResult,
            addonPaymentDropoffsResult,
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
            query<AddonMonthlyProductPaymentsRow>(
                `
                    SELECT
                        addon.product_key,
                        COUNT(DISTINCT addon.restaurant_id)::int AS payers,
                        COUNT(*)::int AS confirmed_payments,
                        COALESCE(SUM(payment.amount_cents), 0)::bigint AS received_cents
                    FROM restaurant_addon_payments AS payment
                    INNER JOIN restaurant_addons AS addon
                        ON addon.id = payment.addon_id
                    WHERE addon.product_key IN ('qr_code_mesa', 'ia_plus')
                      AND payment.paid_at >=
                          date_trunc('month', NOW() AT TIME ZONE $1) AT TIME ZONE $1
                      AND payment.paid_at < NOW()
                      AND UPPER(payment.status) IN (
                          'APPROVED', 'COMPLETED', 'CONFIRMED', 'RECEIVED',
                          'RECEIVED_IN_CASH', 'PAID'
                      )
                    GROUP BY addon.product_key
                `,
                [TIME_ZONE]
            ),
            query<AddonPaymentDropoffRow>(
                `
                    WITH latest_attempt AS (
                        SELECT DISTINCT ON (payment.addon_id)
                            addon.product_key,
                            addon.restaurant_id,
                            COALESCE(NULLIF(BTRIM(restaurant.name), ''), 'Restaurante')
                                AS restaurant_name,
                            payment.status,
                            payment.billing_type,
                            payment.paid_at,
                            payment.created_at
                        FROM restaurant_addon_payments AS payment
                        INNER JOIN restaurant_addons AS addon
                            ON addon.id = payment.addon_id
                        INNER JOIN restaurants AS restaurant
                            ON restaurant.id = addon.restaurant_id
                        WHERE addon.product_key IN ('qr_code_mesa', 'ia_plus')
                          AND payment.created_at >=
                              date_trunc('month', NOW() AT TIME ZONE $1) AT TIME ZONE $1
                          AND payment.created_at < NOW()
                        ORDER BY payment.addon_id, payment.created_at DESC, payment.id DESC
                    ), unpaid AS (
                        SELECT *,
                            COUNT(*) OVER (PARTITION BY product_key)::int AS total
                        FROM latest_attempt
                        WHERE paid_at IS NULL
                          AND (
                              UPPER(status) IN (
                                  'CANCELLED', 'CANCELED', 'EXPIRED', 'FAILED',
                                  'REFUSED', 'OVERDUE'
                              )
                              OR (
                                  UPPER(status) IN ('PENDING', 'WAITING_PAYMENT', 'CREATED')
                                  AND created_at < NOW() - INTERVAL '2 hours'
                              )
                          )
                    ), ordered AS (
                        SELECT *,
                            ROW_NUMBER() OVER (
                                PARTITION BY product_key
                                ORDER BY created_at DESC, restaurant_id
                            ) AS row_number
                        FROM unpaid
                    )
                    SELECT product_key, restaurant_id, restaurant_name,
                        status, billing_type, created_at, total
                    FROM ordered
                    WHERE row_number <= 10
                    ORDER BY product_key, created_at DESC
                `,
                [TIME_ZONE]
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
        const monthlyRevenueProducts = (["qr_code_mesa", "ia_plus"] as const).map(
            (productKey) => {
                const paid = addonMonthlyProductPaymentsResult.rows.find(
                    (row) => row.product_key === productKey
                );
                const unpaid = addonPaymentDropoffsResult.rows.filter(
                    (row) => row.product_key === productKey
                );
                return {
                    productKey,
                    payersThisMonth: Number(paid?.payers) || 0,
                    confirmedPaymentsThisMonth: Number(paid?.confirmed_payments) || 0,
                    receivedThisMonthCents: Number(paid?.received_cents) || 0,
                    droppedTotal: Number(unpaid[0]?.total) || 0,
                    dropoffs: unpaid.map((row) => ({
                        restaurantId: row.restaurant_id,
                        restaurantName: row.restaurant_name,
                        status: row.status,
                        billingType: row.billing_type,
                        attemptedAt: new Date(row.created_at).toISOString(),
                    })),
                };
            }
        );
        const addonBillingHealth = addonBillingHealthResult.rows[0];
        const monthlyRevenue = {
            addons: monthlyRevenueAddons,
            products: monthlyRevenueProducts,
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
