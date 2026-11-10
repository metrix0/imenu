import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { runPostHogQuery } from "@/lib/analytics/posthogQuery";
import { PUBLIC_CONTENT_PAGES } from "@/lib/seo/publicContent";
import { SEO_TRAFFIC_EVENTS } from "@/lib/analytics/seoTraffic";

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
        "/termos", "/privacidade", "/motoboy", "/garcom",
        ...PUBLIC_CONTENT_PAGES.map(page => page.path),
    ].flatMap(path => path === "/" ? [path] : [path, path + "/"])));
    const knownList = knownPaths.map(path => "'" + path.replace(/'/g, "''") + "'").join(", ");
    // Reuse the legacy dashboard's content taxonomy, including articles like
    // /cardapio-digital, rather than treating only /blog/* as blog content.
    const articlePaths = Array.from(new Set([
        "/blog", ...PUBLIC_CONTENT_PAGES.filter(page => page.kind === "Conteúdo").map(page => page.path),
    ].flatMap(path => [path, path + "/"])));
    const articleList = articlePaths.map(path => "'" + path.replace(/'/g, "''") + "'").join(", ");

    // A single-page navigation retains the browser's original referrer. Use the
    // preceding pageview in the same PostHog session, falling back to an
    // internal referrer only when no preceding pageview was recorded.
    const sourcePath = "source_path";
    const knownSource = sourcePath + " IN (" + knownList + ")";
    const source = [
        "multiIf(",
        "startsWith(" + sourcePath + ", '/blog') OR " + sourcePath + " IN (" + articleList + "), 'blog',",
        "startsWith(" + sourcePath + ", '/ferramentas'), 'tools',",
        "startsWith(" + sourcePath + ", '/restaurantes/'), 'content',",
        knownSource + ", 'content',",
        "startsWith(" + sourcePath + ", '/mesa/') OR startsWith(" + sourcePath + ", '/vitrine/')",
        "OR match(" + sourcePath + ", '^/[a-z0-9_-]+/?$'), 'menus',",
        "'other')",
    ].join(" ");
    const referrer = "lower(ifNull(referrer, ''))";
    const internalReferrer = "match(" + referrer + ", '^https?://(www[.])?imenuapp[.]com[.]br(/|[?#]|$)')";
    const referrerPath = "replaceRegexpOne(replaceRegexpOne(" + referrer +
        ", '^https?://(www[.])?imenuapp[.]com[.]br', ''), '[?#].*$', '')";
    const previousPath = "if(prev_path != '', prev_path, if(" +
        internalReferrer + ", " + referrerPath + ", ''))";
    const homepageQuery = (byPath: boolean) => [
        "SELECT source" + (byPath ? ", source_path" : "") + ",",
        "uniqExactIf(distinct_id, timestamp >= toDateTime('" + timestamp(startAt) + "', 'UTC')) AS visitors,",
        "uniqExactIf(distinct_id, timestamp < toDateTime('" + timestamp(startAt) + "', 'UTC')) AS previous_visitors",
        "FROM (SELECT distinct_id, timestamp, " + source + " AS source, source_path",
        "FROM (SELECT distinct_id, timestamp, " + previousPath + " AS source_path",
        "FROM (SELECT distinct_id, timestamp, toString(properties.$pathname) AS path,",
        "toString(properties.$referrer) AS referrer,",
        "lagInFrame(toString(properties.$pathname), 1, '') OVER",
        "(PARTITION BY distinct_id, `$session_id` ORDER BY timestamp",
        "ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW) AS prev_path",
        "FROM events WHERE event = '$pageview'",
        // Include an earlier pageview so arrivals at the period boundary
        // can still be attributed to the prior route.
        "AND timestamp >= toDateTime('" + timestamp(previousStart - 60 * 60 * 1000) + "', 'UTC')",
        "AND timestamp < toDateTime('" + timestamp(endAt) + "', 'UTC')",
        "AND toString(properties.$host) IN ('www.imenuapp.com.br', 'imenuapp.com.br'))",
        "WHERE path = '/' AND timestamp >= toDateTime('" + timestamp(previousStart) + "', 'UTC'))",
        "WHERE source_path NOT IN ('', '/'))",
        "GROUP BY source" + (byPath ? ", source_path" : ""),
    ].join(" ");
    const hogql = homepageQuery(false);
    const homepagePagesHogql = homepageQuery(true);

    // These are the exact visitor/click events used by the old SEO dashboard.
    // They measure reach and click intent, NOT confirmed homepage arrivals.
    const seoPath = "toString(if(event = '" + SEO_TRAFFIC_EVENTS.pageViewed +
        "', properties.path, properties.source_path))";
    const seoSource = [
        "multiIf(",
        "startsWith(" + seoPath + ", '/blog') OR " + seoPath + " IN (" + articleList + "), 'blog',",
        "startsWith(" + seoPath + ", '/ferramentas'), 'tools',",
        "startsWith(" + seoPath + ", '/restaurantes/'), 'other',",
        seoPath + " IN (" + knownList + "), 'content',",
        "'other')",
    ].join(" ");
    const seoQuery = (byPath: boolean) => [
        "SELECT source" + (byPath ? ", source_path" : "") + ",",
        "uniqExactIf(distinct_id, event = '" + SEO_TRAFFIC_EVENTS.pageViewed +
            "' AND timestamp >= toDateTime('" + timestamp(startAt) + "', 'UTC')) AS source_visitors,",
        "uniqExactIf(distinct_id, event = '" + SEO_TRAFFIC_EVENTS.homeClicked +
            "' AND timestamp >= toDateTime('" + timestamp(startAt) + "', 'UTC')) AS home_clicks,",
        "uniqExactIf(distinct_id, event = '" + SEO_TRAFFIC_EVENTS.pageViewed +
            "' AND timestamp < toDateTime('" + timestamp(startAt) + "', 'UTC')) AS previous_source_visitors,",
        "uniqExactIf(distinct_id, event = '" + SEO_TRAFFIC_EVENTS.homeClicked +
            "' AND timestamp < toDateTime('" + timestamp(startAt) + "', 'UTC')) AS previous_home_clicks",
        "FROM (SELECT distinct_id, timestamp, event, " + seoSource + " AS source, " + seoPath + " AS source_path",
        "FROM events WHERE event IN ('" + SEO_TRAFFIC_EVENTS.pageViewed +
            "', '" + SEO_TRAFFIC_EVENTS.homeClicked + "')",
        "AND timestamp >= toDateTime('" + timestamp(previousStart) + "', 'UTC')",
        "AND timestamp < toDateTime('" + timestamp(endAt) + "', 'UTC'))",
        "GROUP BY source" + (byPath ? ", source_path" : ""),
    ].join(" ");
    const seoHogql = seoQuery(false);
    const seoPagesHogql = seoQuery(true);

    try {
        // Keep the existing, proven totals query intact. Details are calculated
        // separately by page, using the same source classification and metric.
        const [rows, seoRows, homepageDetails, seoDetails] = await Promise.all([
            runPostHogQuery(hogql),
            runPostHogQuery(seoHogql),
            runPostHogQuery(homepagePagesHogql),
            runPostHogQuery(seoPagesHogql),
        ]);
        const bySource = new Map(rows.map(row => [String(row[0]), row]));
        const seoBySource = new Map(seoRows.map(row => [String(row[0]), row]));
        const breakdown = (data: unknown[][], valueColumn: number, previousColumn: number) => {
            const pages = new Map<string, { path: string; visitors: number; previousVisitors: number }[]>();
            for (const row of data) {
                const source = String(row[0] ?? "");
                const path = String(row[1] ?? "");
                if (!SOURCES.some(key => key === source) || !path.startsWith("/")) continue;
                const visitors = Number(row[valueColumn]) || 0;
                const previousVisitors = Number(row[previousColumn]) || 0;
                if (!visitors && !previousVisitors) continue;
                const entries = pages.get(source) ?? [];
                entries.push({ path, visitors, previousVisitors });
                pages.set(source, entries);
            }
            for (const entries of pages.values()) {
                entries.sort((a, b) => b.visitors - a.visitors || b.previousVisitors - a.previousVisitors || a.path.localeCompare(b.path));
            }
            return pages;
        };
        const pageviewPages = breakdown(homepageDetails, 2, 3);
        const clickPages = breakdown(seoDetails, 3, 5);
        return NextResponse.json({
            paths: SOURCES.map(source => {
                const row = bySource.get(source);
                const seo = seoBySource.get(source);
                // SEO links have explicit click tracking. Menus and other
                // internal routes use observed homepage arrivals instead.
                const seoClicks = source === "blog" || source === "tools" || source === "content";
                return {
                    source,
                    visitors: seoClicks ? Number(seo?.[2]) || 0 : Number(row?.[1]) || 0,
                    previousVisitors: seoClicks ? Number(seo?.[4]) || 0 : Number(row?.[2]) || 0,
                    pages: (seoClicks ? clickPages : pageviewPages).get(source) ?? [],
                };
            }),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.warn("[DEV_LANDING_PATHS] PostHog unavailable:", error);
        return NextResponse.json({ error: "Não foi possível carregar os caminhos até a LP." }, { status: 502 });
    }
}
