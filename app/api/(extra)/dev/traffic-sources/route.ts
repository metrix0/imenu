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
    const previousStart = startAt - (endAt - startAt);

    // Explicit iMenu-owned pages. Restaurant storefront slugs and panel pages are excluded.
    const paths = Array.from(new Set([
        "/", "/restaurante/registrar", "/cardapio-web", "/delivery-direto", "/consumer",
        ...PUBLIC_CONTENT_PAGES.map(page => page.path),
    ].flatMap(path => path === "/" ? [path] : [path, path + "/"])));
    const pathList = paths.map(path => "'" + path.replace(/'/g, "''") + "'").join(", ");

    // Keep the original distinct visitor totals. Additional rows describe
    // observed session referrers/UTMs; they are not additive to the parent.
    const origin = `multiIf(
            lower(ifNull(toString(session.$entry_utm_source), '')) IN ('ig','instagram','instagram.com'), 'Instagram',
            lower(ifNull(toString(session.$entry_utm_source), '')) IN ('fb','facebook','facebook.com'), 'Facebook',
            lower(ifNull(toString(session.$entry_utm_source), '')) IN ('wa','whatsapp','whatsapp.com'), 'WhatsApp',
            lower(ifNull(toString(session.$entry_utm_source), '')) IN ('google','google.com','google_ads','adwords'), 'Google',
            lower(ifNull(toString(session.$entry_utm_source), '')) IN ('bing','msn','microsoft'), 'Bing',
            lower(ifNull(toString(session.$entry_utm_source), '')) IN ('tt','tiktok'), 'TikTok',
            lower(ifNull(toString(session.$entry_utm_source), '')) LIKE '%chatgpt%' OR lower(ifNull(toString(session.$entry_utm_source), '')) LIKE '%openai%', 'ChatGPT',
            lower(ifNull(toString(session.$entry_utm_source), '')) LIKE '%gemini%', 'Gemini',
            lower(ifNull(toString(session.$entry_utm_source), '')) LIKE '%perplexity%', 'Perplexity',
            lower(ifNull(toString(session.$entry_utm_source), '')) LIKE '%claude%', 'Claude',
            notEmpty(lower(ifNull(toString(session.$entry_utm_source), ''))), lower(ifNull(toString(session.$entry_utm_source), '')),
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%gemini%', 'Gemini',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%chatgpt%' OR lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%openai%', 'ChatGPT',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%perplexity%', 'Perplexity',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%claude.ai%', 'Claude',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%instagram%', 'Instagram',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%facebook%', 'Facebook',
            lower(ifNull(toString(session.$entry_referring_domain), '')) IN ('l.wl.co','whatsapp.com','web.whatsapp.com'), 'WhatsApp',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%tiktok%', 'TikTok',
            lower(ifNull(toString(session.$entry_referring_domain), '')) IN ('t.co','x.com','twitter.com'), 'X/Twitter',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%linkedin%', 'LinkedIn',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%youtube%' OR lower(ifNull(toString(session.$entry_referring_domain), '')) = 'youtu.be', 'YouTube',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%pinterest%', 'Pinterest',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%reddit%', 'Reddit',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%mail.google%' OR lower(ifNull(toString(session.$entry_referring_domain), '')) = 'com.google.android.gm', 'Gmail',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%outlook%' OR lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%hotmail%', 'Outlook',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%bing%' OR lower(ifNull(toString(session.$entry_referring_domain), '')) = 'ntp.msn.com', 'Bing',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%duckduckgo%', 'DuckDuckGo',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%ecosia%', 'Ecosia',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%yahoo%', 'Yahoo',
            lower(ifNull(toString(session.$entry_referring_domain), '')) LIKE '%google%', 'Google',
            lower(ifNull(toString(session.$entry_referring_domain), '')) IN ('','$direct'), '',
            lower(ifNull(toString(session.$entry_referring_domain), ''))
        )`;
    const hogql = [
        "SELECT period, channel, source, uniqExact(distinct_id) AS visitors",
        "FROM (",
        "  SELECT distinct_id, period, channel, arrayJoin(['', origin]) AS source",
        "  FROM (",
        "    SELECT distinct_id,",
        "      if(timestamp >= toDateTime('" + timestamp(startAt) + "', 'UTC'), 'current', 'previous') AS period,",
        "      if(empty(ifNull(toString(session.$channel_type), '')), 'Unknown', toString(session.$channel_type)) AS channel,",
        "      " + origin + " AS origin",
        "    FROM events",
        "    WHERE event = '$pageview'",
        "    AND timestamp >= toDateTime('" + timestamp(previousStart) + "', 'UTC')",
        "    AND timestamp < toDateTime('" + timestamp(endAt) + "', 'UTC')",
        "    AND toString(properties.$host) IN ('www.imenuapp.com.br', 'imenuapp.com.br')",
        "    AND (toString(properties.$pathname) IN (" + pathList + ")",
        "    OR startsWith(toString(properties.$pathname), '/restaurantes/'))",
        "  )",
        ")",
        "GROUP BY period, channel, source",
        "ORDER BY visitors DESC",
        "LIMIT 500",
    ].join("\n");

    try {
        const rows = await runPostHogQuery(hogql);
        type ChannelGroup = {
            channel: string;
            visitors: number;
            sources: Array<{ source: string; visitors: number }>;
        };
        const periods = {
            current: new Map<string, ChannelGroup>(),
            previous: new Map<string, ChannelGroup>(),
        };
        for (const row of rows) {
            const period = row[0] === "previous" ? "previous" : "current";
            const channel = String(row[1] || "Unknown");
            const source = String(row[2] || "");
            const visitors = Number(row[3]) || 0;
            const channels = periods[period];
            if (!channels.has(channel)) {
                channels.set(channel, { channel, visitors: 0, sources: [] });
            }
            const group = channels.get(channel)!;
            if (source) group.sources.push({ source, visitors });
            else group.visitors = visitors;
        }
        return NextResponse.json({
            channels: [...periods.current.values()]
                .sort((a, b) => b.visitors - a.visitors)
                .map(group => {
                    const prior = periods.previous.get(group.channel);
                    return {
                        ...group,
                        previousVisitors: prior?.visitors ?? 0,
                        sources: group.sources
                            .sort((a, b) => b.visitors - a.visitors)
                            .map(source => ({
                                ...source,
                                previousVisitors: prior?.sources.find(p => p.source === source.source)?.visitors ?? 0,
                            })),
                    };
                }),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.warn("[DEV_TRAFFIC_SOURCES] PostHog unavailable:", error);
        return NextResponse.json({ error: "Não foi possível carregar as origens do tráfego." }, { status: 502 });
    }
}
