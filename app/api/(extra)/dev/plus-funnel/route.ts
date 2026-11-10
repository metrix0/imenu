import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { runPostHogQuery } from "@/lib/analytics/posthogQuery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Buyers = { current_buyers: number | string; previous_buyers: number | string };
type FunnelCounts = {
    panelUsers: number | null;
    exposures: number | null;
    modalViews: number | null;
    checkout: number | null;
    bought: number | null;
    sources: Record<string, number> | null;
};
const PLUS_SOURCES = ["sales_modal", "plus_page", "assistant_limit", "sales_section", "marketing_page", "legacy_pages"] as const;

function validDate(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value);
}
function timestamp(value: number): string {
    return new Date(value).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
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
    const previousStart = startAt - (endAt - startAt);
    const start = timestamp(startAt);
    const end = timestamp(endAt);
    const previous = timestamp(previousStart);
    const period = "timestamp >= toDateTime('" + previous + "', 'UTC') AND timestamp < toDateTime('" + end + "', 'UTC')";
    const rangeLabel = "if(timestamp >= toDateTime('" + start + "', 'UTC'), 'current', 'previous')";

    const usersSql = "SELECT " + rangeLabel + " AS range_label, " +
        "uniqExactIf(distinct_id, event IN ('panel_dashboard_viewed', 'panel_tab_opened')) AS panel_users, " +
        "uniqExactIf(distinct_id, event = 'imenu_plus_checkout_viewed') AS checkout_users " +
        "FROM events WHERE " + period + " GROUP BY range_label";

    // Exposures share the five-surface 7-day deduplication definition of Plus traffic.
    // Earlier panel pageviews are backfilled in-place, without creating synthetic events.
    // Old pageviews cannot prove that a specific Plus offer was visible.
    const exposuresSql = [
        "WITH touchpoints AS (SELECT", rangeLabel + " AS range_label, distinct_id, timestamp,",
        "if(event = 'imenu_plus_exposure_viewed', toString(properties.surface), 'legacy_pages') AS surface",
        "FROM events WHERE " + period,
        "AND ((event = 'imenu_plus_exposure_viewed' AND toString(properties.surface) IN",
        "('sales_modal','plus_page','assistant_limit','sales_section','marketing_page'))",
        "OR (event = '$pageview' AND timestamp < toDateTime('2026-11-10 12:50:49', 'UTC')",
        "AND properties.$pathname IN ('/painel/marketing','/painel/marketing/',",
        "'/painel/vendas-ia','/painel/vendas-ia/',",
        "'/painel/assistente-ia','/painel/assistente-ia/'))))",
        "SELECT range_label, bucket, sum(visits) AS visits FROM (",
        "SELECT range_label, bucket, distinct_id,",
        "tupleElement(arrayFold((state, second) -> if(",
        "second >= tupleElement(state, 2) + 604800,",
        "(tupleElement(state, 1) + 1, second), state),",
        "arraySort(groupArray(toInt(toUnixTimestamp(timestamp)))),",
        "(toInt(0), toInt(-604800))), 1) AS visits",
        "FROM (SELECT range_label, distinct_id, timestamp,",
        "arrayJoin(['exposures', concat('source:', surface)]) AS bucket",
        "FROM touchpoints",
        "GROUP BY range_label, bucket, distinct_id)",
        "GROUP BY range_label, bucket"
    ].join(" ");

    // New Plus first purchases only; renewals and earlier legacy IA Plus payments are excluded.
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
        ") SELECT",
        "COUNT(*) FILTER (WHERE first_paid_at >= $1::timestamptz AND first_paid_at < $2::timestamptz)::int AS current_buyers,",
        "COUNT(*) FILTER (WHERE first_paid_at >= $4::timestamptz AND first_paid_at < $1::timestamptz)::int AS previous_buyers",
        "FROM first_plus_paid"
    ].join(" ");

    const [users, exposures, buyers] = await Promise.allSettled([
        runPostHogQuery(usersSql),
        runPostHogQuery(exposuresSql),
        query<Buyers>(buyersSql, [
            new Date(startAt).toISOString(),
            new Date(endAt).toISOString(),
            "2026-10-28T03:00:00Z",
            new Date(previousStart).toISOString(),
        ]),
    ]);
    if (users.status === "rejected" || exposures.status === "rejected") {
        console.warn("[PLUS_FUNNEL] PostHog unavailable.", 
            users.status === "rejected" ? users.reason : exposures.status === "rejected" ? exposures.reason : "");
    }
    if (buyers.status === "rejected") {
        console.error("[PLUS_FUNNEL] Buyers query failed:", buyers.reason);
    }

    const metrics = (label: "current" | "previous"): FunnelCounts => {
        const userRow = users.status === "fulfilled"
            ? users.value.find(row => row[0] === label) : undefined;
        const exposureRows = exposures.status === "fulfilled"
            ? exposures.value.filter(row => row[0] === label) : [];
        const getExposure = (key: string) => Number(exposureRows.find(row => row[1] === key)?.[2] || 0);
        const sources = exposures.status === "fulfilled"
            ? Object.fromEntries(PLUS_SOURCES.map(source => [source, getExposure("source:" + source)]))
            : null;
        return {
            panelUsers: users.status === "fulfilled" ? Number(userRow?.[1] || 0) : null,
            exposures: exposures.status === "fulfilled" ? getExposure("exposures") : null,
            modalViews: exposures.status === "fulfilled" && (label === "current" ? endAt : startAt) > Date.parse("2026-11-10T12:50:49Z")
                ? getExposure("source:sales_modal") : null,
            checkout: users.status === "fulfilled" ? Number(userRow?.[2] || 0) : null,
            bought: buyers.status === "fulfilled" ? Number(buyers.value.rows[0]?.[label === "current" ? "current_buyers" : "previous_buyers"] || 0) : null,
            sources,
        };
    };

    return NextResponse.json({
        ...metrics("current"),
        previous: metrics("previous"),
    }, { headers: { "Cache-Control": "no-store" } });
}
