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
    const age = params.get("age");
    const conditions = [
        `($1='' OR r.name ILIKE '%'||$1||'%' OR u.email ILIKE '%'||$1||'%' OR r.phone ILIKE '%'||$1||'%' OR r.store_whatsapp ILIKE '%'||$1||'%' OR u.raw_user_meta_data->>'phone' ILIKE '%'||$1||'%')`,
        ...(paidOnly ? [`(${PAID})`] : []),
        ...(plan === "plus" ? [`(${PLUS})`] : plan === "historical" ? [`(${PAID}) AND NOT (${PLUS})`] : plan === "free" ? [`NOT (${PAID})`] : []),
        ...(age === "30" ? ["r.created_at >= NOW() - INTERVAL '30 days'"] : age === "90" ? ["r.created_at >= NOW() - INTERVAL '90 days'"] : age === "older" ? ["r.created_at < NOW() - INTERVAL '90 days'"] : []),
    ];
    const where = conditions.join(" AND ");
    const [rows, count] = await Promise.all([
        query(`SELECT r.id,r.name,r.url_slug,r.created_at,COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'),''),r.phone) phone,r.store_whatsapp AS store_phone,
            COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'),''),NULLIF(TRIM(r.phone),'')) AS owner_phone,(${PLUS_SINCE}) AS plus_since,u.email,(${PAID}) AS has_paid,(${PLUS}) AS plus
            FROM restaurants r LEFT JOIN auth.users u ON u.id=r.user_id WHERE ${where}
            ORDER BY ${paidOnly ? `(${PLUS}) DESC,` : ""} r.created_at DESC,r.id LIMIT $2 OFFSET $3`, [search, CRM_PAGE_SIZE, page * CRM_PAGE_SIZE]),
        query<{ total: number }>(`SELECT COUNT(*)::int total FROM restaurants r LEFT JOIN auth.users u ON u.id=r.user_id WHERE ${where}`, [search]),
    ]);
    return paged(rows.rows, count.rows[0].total, page, CRM_PAGE_SIZE);
}
