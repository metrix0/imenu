import { query } from "@/lib/database/sql";
import { devPage, DEV_PAGE_SIZE, paged } from "./pagination";

export async function payoutHistory(params: URLSearchParams) {
    const page = devPage(params);
    const section = params.get("section");
    const runs = section === "runs";
    const from = runs ? "payout_automation_runs p" : "payouts p LEFT JOIN restaurants r ON r.id=p.restaurant_id LEFT JOIN auth.users u ON u.id=r.user_id";
    const where = section === "failed" ? "WHERE p.status IN ('failed','cancelled','canceled','refused')" : "";
    const [rows, count] = await Promise.all([
        query(`SELECT ${runs ? "p.*" : "p.*,r.name restaurant_name,r.payment_info pix_key,r.payment_info_type pix_key_type,COALESCE(NULLIF(u.raw_user_meta_data->>'phone',''),r.phone) owner_phone"} FROM ${from} ${where} ORDER BY ${runs ? "p.run_date DESC,p.started_at DESC" : "p.created_at DESC,p.id"} LIMIT $1 OFFSET $2`, [DEV_PAGE_SIZE, DEV_PAGE_SIZE * page]),
        query<{ total: number }>(`SELECT COUNT(*)::int total FROM ${runs ? "payout_automation_runs p" : "payouts p"} ${where}`),
    ]);
    return paged(rows.rows, count.rows[0].total, page);
}
