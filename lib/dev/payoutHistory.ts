import { query } from "@/lib/database/sql";
import { devPage, paged } from "./pagination";

export async function payoutHistory(params: URLSearchParams) {
    const pageSize = 10;
    const page = devPage(params);
    const section = params.get("section");
    const runs = section === "runs";
    const from = runs ? `payout_automation_runs p LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(x.gross_cents-x.amount_cents-COALESCE(x.payzu_fee_cents,0)),0)::integer AS paid_profit_cents
        FROM payouts x WHERE x.automation_run_id=p.id AND x.status='paid'
    ) paid ON TRUE LEFT JOIN LATERAL (
        SELECT COALESCE(json_agg(json_build_object(
            'id', x.id,
            'restaurant_name', COALESCE(r.name, 'Restaurante'),
            'amount_cents', x.amount_cents,
            'status', x.status,
            'failure_reason', x.failure_reason,
            'alert_status', notice.status
        ) ORDER BY x.created_at DESC), '[]'::json) AS troubled_payouts
        FROM payouts x
        LEFT JOIN restaurants r ON r.id=x.restaurant_id
        LEFT JOIN whatsapp_outbound_messages notice ON notice.dedupe_key =
            'support:payout:'||to_char(x.created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD')||':'||x.restaurant_id::text
        WHERE x.automation_run_id=p.id AND x.status NOT IN ('paid','processing')
    ) trouble ON TRUE` : "payouts p LEFT JOIN restaurants r ON r.id=p.restaurant_id LEFT JOIN auth.users u ON u.id=r.user_id";
    const alertJoin = section === "failed" ? `LEFT JOIN whatsapp_outbound_messages alert ON alert.dedupe_key =
        'support:payout:'||to_char(p.created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD')||':'||p.restaurant_id::text` : "";
    const alertColumns = section === "failed" ? ",alert.status alert_status,alert.context->>'message' alert_message,alert.last_error alert_error" : "";
    // Match the legacy dashboard's current operational window; full history remains available separately.
    const where = section === "failed" ? "WHERE p.status IN ('failed','cancelled') AND p.id IN (SELECT id FROM payouts ORDER BY created_at DESC LIMIT 100)" : "";
    const [rows, count] = await Promise.all([
        query(`SELECT ${runs ? "p.*,paid.paid_profit_cents,trouble.troubled_payouts" : "p.*,COALESCE(NULLIF(BTRIM(r.name), ''), INITCAP(REPLACE(r.url_slug, '-', ' ')), 'Restaurante') restaurant_name,r.payment_info pix_key,r.payment_info_type pix_key_type,COALESCE(NULLIF(u.raw_user_meta_data->>'phone',''),r.phone) owner_phone"}${alertColumns} FROM ${from} ${alertJoin} ${where} ORDER BY ${runs ? "p.run_date DESC,p.started_at DESC" : "p.created_at DESC,p.id"} LIMIT $1 OFFSET $2`, [pageSize, pageSize * page]),
        query<{ total: number }>(`SELECT COUNT(*)::int total FROM ${runs ? "payout_automation_runs p" : "payouts p"} ${where}`),
    ]);
    return paged(rows.rows, count.rows[0].total, page, pageSize);
}
