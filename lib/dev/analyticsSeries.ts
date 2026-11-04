import { query } from "@/lib/database/sql";
import type { Bucket } from "./dashboardPosthog";
import { ADDON_PRODUCT_METRICS_CTE } from "@/lib/analytics/productOverview";

export async function loadAcquisitionSeries(buckets: Bucket[]) {
    const start = new Date(buckets[0].start).toISOString();
    const end = new Date(buckets[buckets.length - 1].end).toISOString();
    const registrations = await query<{ created_at: string }>(`SELECT created_at FROM auth.users
        WHERE created_at >= $1 AND created_at < $2 AND deleted_at IS NULL AND COALESCE(is_anonymous,false)=false`, [start, end]);
    // Use the same paid-account CTE and first-purchase definition as the existing KPI.
    const purchases = await query<{ first_paid_at: string }>(ADDON_PRODUCT_METRICS_CTE +
        "SELECT first_paid_at FROM paid_accounts WHERE product_key='ia_plus' AND first_paid_at >= $1::timestamptz AND first_paid_at < $2::timestamptz", [start, end]);
    const series = (rows: string[]) => buckets.map(bucket => ({ label: bucket.label, value: rows.filter(value => { const at = new Date(value).getTime(); return at >= bucket.start && at < bucket.end; }).length }));
    return { registrations: series(registrations.rows.map(row => row.created_at)), subscriptions: series(purchases.rows.map(row => row.first_paid_at)) };
}
