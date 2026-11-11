import { query } from "@/lib/database/sql";
import { devPage, paged } from "./pagination";

const CRM_PAGE_SIZE = 10;

const PAID = `EXISTS(SELECT 1 FROM restaurant_addons a JOIN restaurant_addon_payments p ON p.addon_id=a.id
    WHERE a.restaurant_id=r.id AND p.amount_cents>0 AND p.paid_at IS NOT NULL
    AND UPPER(p.status) IN ('CONFIRMED','RECEIVED','RECEIVED_IN_CASH','PAID','COMPLETED','APPROVED'))
    OR EXISTS(SELECT 1 FROM restaurant_addons a WHERE a.restaurant_id=r.id AND a.activated_at IS NOT NULL
        AND UPPER(a.payzu_payment_status) IN ('PAID','COMPLETED','CONFIRMED'))`;
const PLUS_SINCE = `(SELECT MIN(a.activated_at) FROM restaurant_addons a WHERE a.restaurant_id=r.id AND a.product_key='ia_plus')`;
const PLUS = `EXISTS(SELECT 1 FROM restaurant_addons a WHERE a.restaurant_id=r.id AND a.product_key='ia_plus'
    AND (a.status='active' OR (a.status IN ('canceled','past_due') AND a.current_period_ends_at>NOW())))`;



const ACCOUNT = "COALESCE(r.user_id,r.id)";
const OWNED_ACCOUNT = "COALESCE(owned.user_id,owned.id)";
const PURCHASE_DAY = "(o.created_at AT TIME ZONE 'America/Sao_Paulo')::date";
const RECOVERY_AS_OF = "((date_trunc('day', NOW() AT TIME ZONE 'America/Sao_Paulo') + INTERVAL '20 hours') AT TIME ZONE 'America/Sao_Paulo')";
// Use grouped account ID sets so pagination and counts do not run per-row scans.
// The recovery sets match the daily 20:00 SP eligibility snapshot.
const ACCOUNT_PLUS = [
    ACCOUNT + " IN (SELECT " + OWNED_ACCOUNT + " FROM restaurant_addons addon",
    "JOIN restaurants owned ON owned.id=addon.restaurant_id",
    "WHERE addon.product_key = 'ia_plus'",
    "AND (addon.status='active' OR (addon.status IN ('canceled','past_due') AND addon.current_period_ends_at>NOW())))",
].join(" ");
const doneOrders = (asOf: string, having: string) => [
    ACCOUNT + " IN (SELECT " + OWNED_ACCOUNT + " FROM orders o JOIN restaurants owned ON owned.id=o.restaurant_id",
    "WHERE o.table_id IS NULL AND o.status='done'",
    "AND o.created_at >= " + asOf + " - INTERVAL '30 days' AND o.created_at < " + asOf,
    "GROUP BY " + OWNED_ACCOUNT + " HAVING " + having + ")",
].join(" ");
const ABANDONED = doneOrders(RECOVERY_AS_OF, [
    "COUNT(DISTINCT " + PURCHASE_DAY + ") >= 2",
    "AND MAX(o.created_at) >= " + RECOVERY_AS_OF + " - INTERVAL '15 days'",
    "AND MAX(o.created_at) < " + RECOVERY_AS_OF + " - INTERVAL '14 days'",
].join(" "));
const ACTIVITY: Record<string, string> = {
    active: doneOrders("NOW()", [
        "COUNT(DISTINCT " + PURCHASE_DAY + ") >= 2",
        "AND COUNT(DISTINCT " + PURCHASE_DAY + ") FILTER (WHERE o.created_at >= NOW() - INTERVAL '14 days') >= 1",
    ].join(" ")),
    active_customers: [
        ACCOUNT + " IN (SELECT " + OWNED_ACCOUNT + " FROM orders o JOIN restaurants owned ON owned.id=o.restaurant_id",
        "CROSS JOIN LATERAL (SELECT regexp_replace(COALESCE(o.customer_phone,''),'[^0-9]','','g') AS digits) raw",
        "CROSS JOIN LATERAL (SELECT CASE WHEN raw.digits LIKE '55%' AND length(raw.digits) IN (12,13)",
        "THEN substring(raw.digits FROM 3) ELSE raw.digits END AS phone) normalized",
        "WHERE o.table_id IS NULL",
        "AND o.status IS DISTINCT FROM 'canceled' AND o.status IS DISTINCT FROM 'pending_online_payment'",
        "AND o.created_at >= NOW() - INTERVAL '30 days' AND o.created_at < NOW()",
        "GROUP BY " + OWNED_ACCOUNT,
        "HAVING COUNT(*) FILTER (WHERE length(normalized.phone) >= 10) >= 4",
        "AND COUNT(DISTINCT normalized.phone) FILTER (WHERE length(normalized.phone) >= 10) >= 4)",
    ].join(" "),
    abandoned_plus: "(" + ABANDONED + " AND " + ACCOUNT_PLUS + ")",
    abandoned_imenu: "(" + ABANDONED + " AND NOT " + ACCOUNT_PLUS + ")",
    single_day: [
        ACCOUNT + " IN (SELECT " + OWNED_ACCOUNT + " FROM restaurants owned JOIN orders o ON o.restaurant_id=owned.id",
        "WHERE owned.creation_step=4 AND owned.first_time=false",
        "AND o.table_id IS NULL AND o.created_at >= " + RECOVERY_AS_OF + " - INTERVAL '14 days'",
        "AND o.created_at < " + RECOVERY_AS_OF,
        "GROUP BY owned.id, " + OWNED_ACCOUNT + " HAVING COUNT(DISTINCT " + PURCHASE_DAY + ")=1)",
    ].join(" "),
    no_first_order: [
        ACCOUNT + " IN (SELECT " + OWNED_ACCOUNT + " FROM restaurants owned",
        "WHERE owned.creation_step=4 AND owned.first_time=false",
        "AND owned.onboarding_completed_at >= " + RECOVERY_AS_OF + " - INTERVAL '48 hours'",
        "AND owned.onboarding_completed_at < " + RECOVERY_AS_OF + " - INTERVAL '24 hours'",
        "AND NOT EXISTS (SELECT 1 FROM orders o JOIN restaurants other ON other.id=o.restaurant_id",
        "WHERE COALESCE(other.user_id,other.id)=" + OWNED_ACCOUNT + "))",
    ].join(" "),
};

export async function getCrm(params: URLSearchParams) {
    const page = devPage(params);
    const id = params.get("restaurant_id");
    if (id) {
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("Restaurante inválido.");
        const section = params.get("section");
        if (section === "payments" || section === "payouts") {
            const from = section === "payments" ? "restaurant_addon_payments p JOIN restaurant_addons a ON a.id=p.addon_id" : "payouts p";
            const condition = section === "payments" ? "a.restaurant_id=$1" : "p.restaurant_id=$1";
            const columns = section === "payments" ? "p.id,p.amount_cents,p.status,p.paid_at,p.created_at,p.billing_type,a.product_key" : "p.id,p.amount_cents,p.status,p.paid_at,p.created_at,p.failure_reason";
            const [rows, count] = await Promise.all([
                query(`SELECT ${columns} FROM ${from} WHERE ${condition} ORDER BY p.created_at DESC,p.id LIMIT $2 OFFSET $3`, [id, CRM_PAGE_SIZE, page * CRM_PAGE_SIZE]),
                query<{ total: number }>(`SELECT COUNT(*)::int total FROM ${from} WHERE ${condition}`, [id]),
            ]);
            return paged(rows.rows, count.rows[0].total, page, CRM_PAGE_SIZE);
        }
        const [restaurant, metrics, analysis] = await Promise.all([
            query(`SELECT r.id,r.name,r.url_slug,r.created_at,COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'),''),r.phone) phone,r.store_whatsapp AS store_phone,
                COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'),''),NULLIF(TRIM(r.phone),'')) AS owner_phone,(${PLUS_SINCE}) AS plus_since,r.payment_info,r.payment_info_type,u.email,
                r.creation_step,r.first_time,r.onboarding_completed_at,r.address->>'city' AS city,r.address->>'state' AS state,
                r.pickup_enabled,r.delivery_disabled,r.preorder_only,
                (${PAID}) AS has_paid,(${PLUS}) AS plus FROM restaurants r LEFT JOIN auth.users u ON u.id=r.user_id WHERE r.id=$1`, [id]),
            query(`SELECT COUNT(*)::int orders,COALESCE(SUM(total_cents),0)::bigint gmv_cents,
                COALESCE(SUM(total_cents) FILTER(WHERE payment_method IN ('pix','cartao')),0)::bigint online_cents,
                COALESCE(SUM(total_cents) FILTER(WHERE created_at >= date_trunc('month',NOW() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo'),0)::bigint monthly_gmv_cents
                FROM orders WHERE restaurant_id=$1 AND status IS DISTINCT FROM 'canceled' AND status IS DISTINCT FROM 'pending_online_payment'`, [id]),
            query(`SELECT id,finished_at,result->'report'->'potential_estimate' AS potential,
                COALESCE(result->'report'->>'summary',result->>'summary') AS summary
                FROM ia_vendas_runs WHERE restaurant_id=$1 AND kind='analysis' AND status='completed'
                ORDER BY created_at DESC LIMIT 1`, [id]),
        ]);
        return { restaurant: restaurant.rows[0] || null, metrics: metrics.rows[0], analysis: analysis.rows[0] || null };
    }
    const paidOnly = params.get("paid") === "1";
    const search = params.get("q")?.trim().slice(0, 200) || "";
    const plan = params.get("plan");
    const activity = ACTIVITY[params.get("activity") || ""];
    const conditions = [
        `($1='' OR r.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%' OR r.phone ILIKE '%'||$1||'%' OR r.store_whatsapp ILIKE '%'||$1||'%' OR u.raw_user_meta_data->>'phone' ILIKE '%'||$1||'%')`,
        ...(paidOnly ? [`(${PAID})`] : []),
        ...(plan === "plus" ? [`(${PLUS})`] : plan === "historical" ? [`(${PAID}) AND NOT (${PLUS})`] : plan === "free" ? [`NOT (${PAID})`] : []),
        ...(activity ? [activity] : []),
    ];
    const where = conditions.join(" AND ");
    // Only allow known SQL expressions; sorting must happen before LIMIT/OFFSET.
    const sortColumns: Record<string, string> = {
        name: "LOWER(r.name)",
        status: `CASE WHEN (${PLUS}) THEN 2 WHEN (${PAID}) THEN 1 ELSE 0 END`,
        store: "NULLIF(BTRIM(r.store_whatsapp), '')",
        owner: "COALESCE(NULLIF(BTRIM(u.raw_user_meta_data->>'phone'), ''), NULLIF(BTRIM(r.phone), ''))",
        created: "r.created_at",
        gmv: "gmv.gmv_cents",
    };
    const sortKey = params.get("sort") || "";
    const sortColumn = Object.prototype.hasOwnProperty.call(sortColumns, sortKey) ? sortColumns[sortKey] : null;
    const direction = params.get("direction") === "asc" ? "ASC" : "DESC";
    const orderBy = sortColumn
        ? `${sortColumn} ${direction} NULLS LAST, r.id`
        : `${paidOnly ? `(${PLUS}) DESC,` : ""} r.created_at DESC,r.id`;
    const [rows, count] = await Promise.all([
        query(`SELECT r.id,r.name,r.url_slug,r.created_at,COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'),''),r.phone) phone,r.store_whatsapp AS store_phone,
            COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'),''),NULLIF(TRIM(r.phone),'')) AS owner_phone,(${PLUS_SINCE}) AS plus_since,u.email,(${PAID}) AS has_paid,(${PLUS}) AS plus,
            COALESCE(gmv.gmv_cents,0) AS gmv_cents
            FROM restaurants r LEFT JOIN auth.users u ON u.id=r.user_id
            LEFT JOIN LATERAL (
                SELECT COALESCE(SUM(o.total_cents),0)::bigint AS gmv_cents
                FROM orders o WHERE o.restaurant_id=r.id
                  AND o.status IS DISTINCT FROM 'canceled'
                  AND o.status IS DISTINCT FROM 'pending_online_payment'
            ) gmv ON true
            WHERE ${where}
            ORDER BY ${orderBy} LIMIT $2 OFFSET $3`, [search, CRM_PAGE_SIZE, page * CRM_PAGE_SIZE]),
        query<{ total: number }>(`SELECT COUNT(*)::int total FROM restaurants r LEFT JOIN auth.users u ON u.id=r.user_id WHERE ${where}`, [search]),
    ]);
    return paged(rows.rows, count.rows[0].total, page, CRM_PAGE_SIZE);
}
