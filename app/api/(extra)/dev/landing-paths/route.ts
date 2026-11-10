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

const SOURCES = ["blog", "menus", "tools", "content", "other"] as const;

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

    // Keep iMenu's existing public-page catalog as the source of known non-menu URLs.
    const knownPaths = Array.from(new Set([
        "/", "/cardapio-web", "/delivery-direto", "/consumer",
        "/restaurante/registrar", "/restaurante/login", "/painel", "/dev",
        "/termos", "/privacidade",
        ...PUBLIC_CONTENT_PAGES.map(page => page.path),
    ].flatMap(path => path === "/" ? [path] : [path, path + "/"])));
    const knownList = knownPaths.map(path => "'" + path.replace(/'/g, "''") + "'").join(", ");

    // Count actual homepage pageviews with an identified preceding internal URL,
    // not generic clicks to a call-to-action or all visits to the source page.
    const referrer = "lower(ifNull(toString(properties.$referrer), ''))";
    const internal = "match(" + referrer + ", '^https?://(www[.])?imenuapp[.]com[.]br(/|[?#]|$)')";
    const sourcePath = "replaceRegexpOne(replaceRegexpOne(" + referrer +
        ", '^https?://(www[.])?imenuapp[.]com[.]br', ''), '[?#].*$', '')";
    const source = [
        "multiIf(not(" + internal + "), 'external',",
        "startsWith(" + sourcePath + ", '/blog'), 'blog',",
        "startsWith(" + sourcePath + ", '/ferramentas'), 'tools',",
        "startsWith(" + sourcePath + ", '/restaurantes/'), 'other',",
        sourcePath + " IN (" + knownList + "), 'content',",
        "match(" + sourcePath + ", '^/[a-z0-9_-]+/?$'), 'menus',",
        "'other')",
    ].join(" ");
    const hogql = [
        "SELECT source,",
        "uniqExactIf(distinct_id, timestamp >= toDateTime('" + timestamp(startAt) + "', 'UTC')) AS visitors,",
        "uniqExactIf(distinct_id, timestamp < toDateTime('" + timestamp(startAt) + "', 'UTC')) AS previous_visitors",
        "FROM (SELECT distinct_id, timestamp, " + source + " AS source",
        "FROM events WHERE event = '$pageview'",
        "AND timestamp >= toDateTime('" + timestamp(previousStart) + "', 'UTC')",
        "AND timestamp < toDateTime('" + timestamp(endAt) + "', 'UTC')",
        "AND toString(properties.$pathname) = '/'",
        "AND toString(properties.$host) IN ('www.imenuapp.com.br', 'imenuapp.com.br'))",
        "GROUP BY source",
    ].join(" ");

    try {
        const rows = await runPostHogQuery(hogql);
        const bySource = new Map(rows.map(row => [String(row[0]), row]));
        return NextResponse.json({
            paths: SOURCES.map(source => {
                const row = bySource.get(source);
                return {
                    source,
                    visitors: Number(row?.[1]) || 0,
                    previousVisitors: Number(row?.[2]) || 0,
                };
            }),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.warn("[DEV_LANDING_PATHS] PostHog unavailable:", error);
        return NextResponse.json({ error: "Não foi possível carregar os caminhos até a LP." }, { status: 502 });
    }
}
