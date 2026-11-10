import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { runPostHogQuery } from "@/lib/analytics/posthogQuery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Buyers = { buyers: number | string };
function validDate(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value);
}
export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const startDate = params.get("startDate");
    const endDate = params.get("endDate");
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
        return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }
    const startAt = Date.parse(startDate + "T00:00:00-03:00");
    const endAt = Math.min(Date.now(), Date.parse(endDate + "T23:59:59.999-03:00") + 1);
    if (startAt >= endAt) {
        return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }
    const start = new Date(startAt).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
    const end = new Date(endAt).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
    const period = "timestamp >= toDateTime('" + start + "', 'UTC') AND timestamp < toDateTime('" + end + "', 'UTC')";
    const usersSql = "SELECT uniqExactIf(distinct_id, event IN ('panel_dashboard_viewed', 'panel_tab_opened')) AS panel_users, " +
        "uniqExactIf(distinct_id, event = 'imenu_plus_checkout_viewed') AS checkout_users FROM events WHERE " + period;
    // Same rolling-seven-day definition as the five-surface Plus exposure,
    // but deliberately exclude the sales_modal touchpoint.
    const trafficSql = [
        "SELECT ifNull(sum(visits), 0) FROM (",
        "SELECT distinct_id, tupleElement(arrayFold(",
        "(state, second) -> if(second >= tupleElement(state, 2) + 604800,",
        "(tupleElement(state, 1) + 1, second), state),",
        "arraySort(groupArray(toInt(toUnixTimestamp(timestamp)))),",
        "(toInt(0), toInt(-604800))), 1) AS visits",
        "FROM events WHERE event = 'imenu_plus_exposure_viewed'",
        "AND toString(properties.surface) IN ('plus_page', 'assistant_limit', 'sales_section', 'marketing_page')",
        "AND " + period,
        "GROUP BY distinct_id)"
    ].join(" ");
    // The first confirmed purchase after the new Plus launched, never legacy October payments or renewals.
    const buyersSql = [
        "WITH first_plus_paid AS (",
        "SELECT restaurant.user_id AS owner_id, MIN(payment.paid_at) AS first_paid_at",
        "FROM restaurant_addon_payments AS payment",
        "JOIN restaurant_addons AS addon ON addon.id = payment.addon_id",
        "JOIN restaurants AS restaurant ON restaurant.id = addon.restaurant_id",
        "WHERE addon.product_key = 'ia_plus'",
        "AND payment.paid_at >= $3::timestamptz",
        "AND payment.paid_at < $2::timestamptz",
        "AND payment.amount_cents > 0",
        "AND UPPER(payment.status) IN ('APPROVED', 'COMPLETED', 'CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'PAID')",
        "GROUP BY restaurant.user_id",
        ") SELECT COUNT(*)::int AS buyers FROM first_plus_paid",
        "WHERE first_paid_at >= $1::timestamptz"
    ].join(" ");
    const results = await Promise.allSettled([
        runPostHogQuery(usersSql),
        runPostHogQuery(trafficSql),
        query<Buyers>(buyersSql, [
            new Date(startAt).toISOString(), new Date(endAt).toISOString(), "2026-10-28T03:00:00Z",
        ]),
    ]);
    if (results[0].status === "rejected" || results[1].status === "rejected") {
        console.warn("[PLUS_FUNNEL] PostHog unavailable.");
    }
    if (results[2].status === "rejected") {
        console.error("[PLUS_FUNNEL] Buyer query failed:", results[2].reason);
    }
    return NextResponse.json({
        panelUsers: results[0].status === "fulfilled" ? Number(results[0].value[0]?.[0] || 0) : null,
        traffic: results[1].status === "fulfilled" ? Number(results[1].value[0]?.[0] || 0) : null,
        checkout: results[0].status === "fulfilled" ? Number(results[0].value[0]?.[1] || 0) : null,
        bought: results[2].status === "fulfilled" ? Number(results[2].value.rows[0]?.buyers || 0) : null,
    }, { headers: { "Cache-Control": "no-store" } });
}
