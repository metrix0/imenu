export type ProductKey = "imenu" | "ia_plus" | "qr_code_mesa";
export type ProductPageViews = Record<ProductKey, number | null>;
export type ProductOverviewMetrics = {
    pageViews: number | null;
    buyers: number;
    conversion: number | null;
    churnedUsers: number;
    churnBase: number;
    churn: number | null;
};
export type ProductOverview = Record<ProductKey, ProductOverviewMetrics>;
export type AddonProductMetricsRow = {
    product_key: string;
    buyers: number | string;
    churn_base: number | string;
    churned_users: number | string;
};

// Confirmed first purchases only; renewals and manual grants are not acquisitions.
// Churn is an owner losing all paid access, among owners paying at the period start.
export const ADDON_PRODUCT_METRICS_SQL = `
    WITH paid_addons AS (
        SELECT
            addon.product_key,
            COALESCE(restaurant.user_id::text, addon.restaurant_id::text) AS account_id,
            COALESCE(
                MIN(payment.paid_at),
                CASE
                    WHEN UPPER(addon.payzu_payment_status) IN ('PAID', 'COMPLETED', 'CONFIRMED')
                    THEN addon.activated_at
                END
            ) AS first_paid_at,
            CASE
                -- Prepaid access is saved as canceled even while its paid validity remains.
                WHEN addon.payment_provider = 'mercadopago' OR (
                    addon.payment_provider = 'payzu'
                    AND UPPER(addon.payzu_payment_method) = 'PIX'
                    AND NULLIF(addon.payzu_recurrence_id, '') IS NULL
                ) THEN addon.current_period_ends_at
                ELSE LEAST(addon.canceled_at, addon.current_period_ends_at)
            END AS lost_at
        FROM restaurant_addons AS addon
        INNER JOIN restaurants AS restaurant ON restaurant.id = addon.restaurant_id
        LEFT JOIN restaurant_addon_payments AS payment
            ON payment.addon_id = addon.id
           AND payment.paid_at IS NOT NULL
           AND payment.paid_at < $2::timestamptz
           AND payment.amount_cents > 0
           AND UPPER(payment.status) IN (
               'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'PAID', 'COMPLETED', 'APPROVED'
           )
        WHERE addon.product_key IN ('ia_plus', 'qr_code_mesa')
        GROUP BY addon.id, restaurant.user_id
    ),
    paid_accounts AS (
        SELECT
            product_key,
            account_id,
            MIN(first_paid_at) AS first_paid_at,
            BOOL_OR(first_paid_at < $1::timestamptz
                AND (lost_at IS NULL OR lost_at >= $1::timestamptz)) AS paying_at_start,
            BOOL_OR(lost_at IS NULL OR lost_at >= $2::timestamptz) AS paying_at_end
        FROM paid_addons
        WHERE first_paid_at IS NOT NULL AND first_paid_at < $2::timestamptz
        GROUP BY product_key, account_id
    )
    SELECT
        product.product_key,
        COUNT(account.account_id) FILTER (
            WHERE account.first_paid_at >= $1::timestamptz
        )::int AS buyers,
        COUNT(account.account_id) FILTER (
            WHERE account.paying_at_start
        )::int AS churn_base,
        COUNT(account.account_id) FILTER (
            WHERE account.paying_at_start AND NOT account.paying_at_end
        )::int AS churned_users
    FROM (VALUES ('ia_plus'), ('qr_code_mesa')) AS product(product_key)
    LEFT JOIN paid_accounts AS account ON account.product_key = product.product_key
    GROUP BY product.product_key
`;

function ratio(part: number, total: number | null): number | null {
    return total === null || total <= 0 ? null : Number(((part / total) * 100).toFixed(1));
}

export function buildProductOverview(
    pageViews: ProductPageViews,
    activatedUsers: number,
    imenuChurn: { count: number; base: number },
    addons: AddonProductMetricsRow[]
): ProductOverview {
    const metric = (key: ProductKey, buyers: number, count: number, base: number): ProductOverviewMetrics => ({
        pageViews: pageViews[key],
        buyers,
        conversion: ratio(buyers, pageViews[key]),
        churnedUsers: count,
        churnBase: base,
        churn: ratio(count, base),
    });
    const addonMetric = (key: "ia_plus" | "qr_code_mesa") => {
        const row = addons.find((row) => row.product_key === key);
        return metric(key, Number(row?.buyers) || 0, Number(row?.churned_users) || 0, Number(row?.churn_base) || 0);
    };
    return {
        imenu: metric("imenu", activatedUsers, imenuChurn.count, imenuChurn.base),
        ia_plus: addonMetric("ia_plus"),
        qr_code_mesa: addonMetric("qr_code_mesa"),
    };
}
