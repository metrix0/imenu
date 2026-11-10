import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { runPostHogQuery } from "@/lib/analytics/posthogQuery";
import { PUBLIC_CONTENT_PAGES } from "@/lib/seo/publicContent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

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

    // Explicit iMenu-owned pages. Restaurant storefront slugs and panel pages are excluded.
    const paths = Array.from(new Set([
        "/", "/restaurante/registrar", "/cardapio-web", "/delivery-direto", "/consumer",
        ...PUBLIC_CONTENT_PAGES.map(page => page.path),
    ].flatMap(path => path === "/" ? [path] : [path, path + "/"])));
    const pathList = paths.map(path => "'" + path.replace(/'/g, "''") + "'").join(", ");

    // Use PostHog's native session channel classification, not inferred UTM rules.
    const hogql = [
        "SELECT",
        "if(empty(toString(session.$channel_type)), 'Unknown', toString(session.$channel_type)) AS channel,",
        "uniqExact(distinct_id) AS visitors",
        "FROM events",
        "WHERE event = '$pageview'",
        "AND timestamp >= toDateTime('" + timestamp(startAt) + "', 'UTC')",
        "AND timestamp < toDateTime('" + timestamp(endAt) + "', 'UTC')",
        "AND toString(properties.$host) IN ('www.imenuapp.com.br', 'imenuapp.com.br')",
        "AND (toString(properties.$pathname) IN (" + pathList + ")",
        "OR startsWith(toString(properties.$pathname), '/restaurantes/'))",
        "GROUP BY channel",
        "ORDER BY visitors DESC",
        "LIMIT 15",
    ].join("\n");

    try {
        const rows = await runPostHogQuery(hogql);
        return NextResponse.json({
            channels: rows.map(row => ({
                channel: String(row[0] || "Unknown"),
                visitors: Number(row[1]) || 0,
            })),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.warn("[DEV_TRAFFIC_SOURCES] PostHog unavailable:", error);
        return NextResponse.json({ error: "Não foi possível carregar as origens do tráfego." }, { status: 502 });
    }
}
