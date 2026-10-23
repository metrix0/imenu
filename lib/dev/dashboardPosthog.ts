import { getPostHogConfig, postHogApiHost } from "@/lib/analytics/posthogQuery";
import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";
import { SEO_TRAFFIC_EVENTS } from "@/lib/analytics/seoTraffic";
import { PUBLIC_CONTENT_PAGES } from "@/lib/seo/publicContent";
import type { ProductPageViews } from "@/lib/analytics/productOverview";

export type Bucket = {
    start: number;
    end: number;
    label: string;
};

export type SeriesPoint = {
    label: string;
    value: number;
};

type PostHogMetrics = {
    available: boolean;
    productPageViews: ProductPageViews;
    landingViews: number | null;
    registerClicks: number | null;
    beforeStartViews: number | null;
    blogViews: number | null;
    publicContentPageViews: number | null;
    totalPageViews: number | null;
};

type PanelTabUsage = {
    available: boolean;
    totalOpens: number;
    tabs: Array<{
        tab: string;
        opens: number;
        percentage: number;
    }>;
};

type SeoTrafficMetrics = {
    available: boolean;
    pages: Array<{
        path: string;
        label: string;
        kind: string;
        visitors: number;
        homeVisitors: number;
        ratio: number;
    }>;
};

type ConsumerTimeline = {
    menuViews: SeriesPoint[];
    cartAdds: SeriesPoint[];
    averageCartCents: SeriesPoint[];
};

type PageViewTimeline = {
    landingPageViews: SeriesPoint[];
    publicContentPageViews: SeriesPoint[];
};

export async function loadPostHogMetrics(
    startAt: number,
    endAt: number
): Promise<PostHogMetrics> {
    const config = getPostHogConfig();
    const personalApiKey = config?.personalApiKey;
    const projectId = config?.projectId;
    const rawHost = config?.rawHost;

    if (!personalApiKey || !projectId || !rawHost) {
        return {
            available: false,
            landingViews: null,
            productPageViews: { imenu: null, ia_plus: null, qr_code_mesa: null },
            registerClicks: null,
            beforeStartViews: null,
            blogViews: null,
            publicContentPageViews: null,
            totalPageViews: null,
        };
    }

    const start = new Date(startAt)
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "");
    const end = new Date(endAt)
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "");

    const publicContentPaths = [
        "/",
        ...PUBLIC_CONTENT_PAGES
            .filter((page) => page.kind !== "Ferramenta" && page.path !== "/ferramentas")
            .map((page) => page.path),
    ];
    const publicContentPathList = publicContentPaths
        .map((path) => `'${path.replace(/'/g, "\\'")}'`)
        .join(", ");

    const hogql = `
        SELECT
            uniqIf(
                distinct_id,
                event = '$pageview'
                AND properties.$pathname = '/'
            ) AS landing_views,
            uniqIf(
                distinct_id,
                event = '$pageview'
                AND properties.$pathname = '/restaurante/registrar'
            ) AS register_clicks,
            uniqIf(
                distinct_id,
                event = 'qr_code_mesa_onboarding_viewed'
            ) AS before_start_views,
            countIf(
                event = '$pageview'
                AND (
                    properties.$pathname = '/blog'
                    OR startsWith(toString(properties.$pathname), '/blog/')
                )
            ) AS blog_views,
            countIf(event = '$pageview') AS total_pageviews,
            countIf(event = '$pageview' AND properties.$pathname = '/') AS landing_pageviews,
            countIf(event = '$pageview' AND properties.$pathname IN (
                '/painel/vendas-ia', '/painel/assistente-ia',
                '/painel/vendas-ia/', '/painel/assistente-ia/', '/painel/marketing', '/painel/marketing/'
            )) AS ia_plus_pageviews,
            countIf(event = '$pageview' AND properties.$pathname IN (
                '/painel/mesas', '/painel/mesas/'
            )) AS qr_pageviews,
            countIf(
                event = '$pageview'
                AND properties.$pathname IN (${publicContentPathList})
            ) AS public_content_pageviews
        FROM events
        WHERE timestamp >= toDateTime('${start}', 'UTC')
          AND timestamp < toDateTime('${end}', 'UTC')
    `;

    try {
        const response = await fetch(
            `${postHogApiHost(rawHost)}/api/projects/${encodeURIComponent(
                projectId
            )}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${personalApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogql,
                    },
                }),
                signal: AbortSignal.timeout(15_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`PostHog query failed with ${response.status}.`);
        }

        const payload = (await response.json()) as { results?: unknown[][] };
        const row = payload.results?.[0];

        if (!row) throw new Error("PostHog returned no result row.");

        return {
            available: true,
            landingViews: Number(row[0]) || 0,
            registerClicks: Number(row[1]) || 0,
            beforeStartViews: Number(row[2]) || 0,
            blogViews: Number(row[3]) || 0,
            publicContentPageViews: Number(row[8]) || 0,
            totalPageViews: Number(row[4]) || 0,
            productPageViews: {
                imenu: Number(row[5]) || 0,
                ia_plus: Number(row[6]) || 0,
                qr_code_mesa: Number(row[7]) || 0,
            },
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD] PostHog metrics unavailable:", error);
        return {
            available: false,
            productPageViews: { imenu: null, ia_plus: null, qr_code_mesa: null },
            landingViews: null,
            registerClicks: null,
            beforeStartViews: null,
            blogViews: null,
            publicContentPageViews: null,
            totalPageViews: null,
        };
    }
}

export async function loadPostHogPanelTabUsage(
    startAt: number,
    endAt: number
): Promise<PanelTabUsage> {
    const config = getPostHogConfig();
    const personalApiKey = config?.personalApiKey;
    const projectId = config?.projectId;
    const rawHost = config?.rawHost;

    if (!personalApiKey || !projectId || !rawHost) {
        return { available: false, totalOpens: 0, tabs: [] };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const hogql = `
        SELECT
            toString(properties.tab) AS tab,
            count() AS opens
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event = 'panel_tab_opened'
          AND notEmpty(toString(properties.tab))
        GROUP BY tab
        ORDER BY opens DESC, tab ASC
        LIMIT 50
    `;

    try {
        const response = await fetch(
            `${postHogApiHost(rawHost)}/api/projects/${encodeURIComponent(
                projectId
            )}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${personalApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogql,
                    },
                }),
                signal: AbortSignal.timeout(15_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`PostHog query failed with ${response.status}.`);
        }

        const payload = (await response.json()) as { results?: unknown[][] };
        const rows = payload.results || [];
        const tabs = rows
            .map((row) => ({
                tab: String(row[0] || ""),
                opens: Number(row[1]) || 0,
            }))
            .filter((item) => item.tab && item.opens > 0);
        const totalOpens = tabs.reduce((sum, item) => sum + item.opens, 0);

        return {
            available: true,
            totalOpens,
            tabs: tabs.map((item) => ({
                ...item,
                percentage:
                    totalOpens > 0
                        ? Number(((item.opens / totalOpens) * 100).toFixed(1))
                        : 0,
            })),
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD] Panel tab usage unavailable:", error);
        return { available: false, totalOpens: 0, tabs: [] };
    }
}

export async function loadPostHogSeoTraffic(
    startAt: number,
    endAt: number
): Promise<SeoTrafficMetrics> {
    const config = getPostHogConfig();
    const personalApiKey = config?.personalApiKey;
    const projectId = config?.projectId;
    const rawHost = config?.rawHost;
    const emptyPages = PUBLIC_CONTENT_PAGES.map((page) => ({
        ...page,
        visitors: 0,
        homeVisitors: 0,
        ratio: 0,
    }));

    if (!personalApiKey || !projectId || !rawHost) {
        return { available: false, pages: emptyPages };
    }

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const hogql = `
        SELECT
            if(
                event = '${SEO_TRAFFIC_EVENTS.pageViewed}',
                toString(properties.path),
                toString(properties.source_path)
            ) AS source_path,
            uniqIf(distinct_id, event = '${SEO_TRAFFIC_EVENTS.pageViewed}') AS visitors,
            uniqIf(distinct_id, event = '${SEO_TRAFFIC_EVENTS.homeClicked}') AS home_visitors
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event IN (
              '${SEO_TRAFFIC_EVENTS.pageViewed}',
              '${SEO_TRAFFIC_EVENTS.homeClicked}'
          )
        GROUP BY source_path
    `;

    try {
        const response = await fetch(
            `${postHogApiHost(rawHost)}/api/projects/${encodeURIComponent(
                projectId
            )}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${personalApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogql,
                    },
                }),
                signal: AbortSignal.timeout(15_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`PostHog query failed with ${response.status}.`);
        }

        const payload = (await response.json()) as { results?: unknown[][] };
        const metricsByPath = new Map(
            (payload.results || []).map((row) => [
                String(row[0] || ""),
                {
                    visitors: Number(row[1]) || 0,
                    homeVisitors: Number(row[2]) || 0,
                },
            ])
        );

        return {
            available: true,
            pages: PUBLIC_CONTENT_PAGES.map((page) => {
                const metrics = metricsByPath.get(page.path) || {
                    visitors: 0,
                    homeVisitors: 0,
                };
                return {
                    ...page,
                    ...metrics,
                    ratio:
                        metrics.visitors > 0
                            ? Number(
                                  (
                                      (metrics.homeVisitors / metrics.visitors) *
                                      100
                                  ).toFixed(1)
                              )
                            : 0,
                };
            }).sort((a, b) => b.visitors - a.visitors),
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD] SEO traffic unavailable:", error);
        return { available: false, pages: emptyPages };
    }
}


export async function loadPostHogPageViewTimeline(
    buckets: Bucket[]
): Promise<PageViewTimeline> {
    const config = getPostHogConfig();
    const personalApiKey = config?.personalApiKey;
    const projectId = config?.projectId;
    const rawHost = config?.rawHost;

    if (!personalApiKey || !projectId || !rawHost || !buckets.length) {
        return {
            landingPageViews: [],
            publicContentPageViews: [],
        };
    }

    const publicContentPaths = [
        "/",
        ...PUBLIC_CONTENT_PAGES
            .filter((page) => page.kind !== "Ferramenta" && page.path !== "/ferramentas")
            .map((page) => page.path),
    ];
    const publicContentPathList = publicContentPaths
        .map((path) => `'${path.replace(/'/g, "\\'")}'`)
        .join(", ");
    const bucketExpression = buckets
        .map(
            (bucket, index) => `
                timestamp >= parseDateTimeBestEffort('${new Date(
                    bucket.start
                ).toISOString()}')
                AND timestamp < parseDateTimeBestEffort('${new Date(
                    bucket.end
                ).toISOString()}'), ${index}`
        )
        .join(",");

    const start = new Date(buckets[0].start).toISOString();
    const end = new Date(buckets[buckets.length - 1].end).toISOString();
    const hogql = `
        SELECT
            multiIf(${bucketExpression}, -1) AS bucket_index,
            countIf(properties.$pathname = '/') AS landing_pageviews,
            countIf(properties.$pathname IN (${publicContentPathList})) AS public_content_pageviews
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event = '$pageview'
        GROUP BY bucket_index
        HAVING bucket_index >= 0
        ORDER BY bucket_index
    `;

    try {
        const response = await fetch(
            `${postHogApiHost(rawHost)}/api/projects/${encodeURIComponent(
                projectId
            )}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${personalApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogql,
                    },
                }),
                signal: AbortSignal.timeout(15_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`PostHog query failed with ${response.status}.`);
        }

        const payload = (await response.json()) as { results?: unknown[][] };
        const byBucket = new Map(
            (payload.results || []).map(
                (row) =>
                    [
                        Number(row[0]),
                        {
                            landingPageViews: Number(row[1]) || 0,
                            publicContentPageViews: Number(row[2]) || 0,
                        },
                    ] as const
            )
        );

        return {
            landingPageViews: buckets.map((bucket, index) => ({
                label: bucket.label,
                value: byBucket.get(index)?.landingPageViews || 0,
            })),
            publicContentPageViews: buckets.map((bucket, index) => ({
                label: bucket.label,
                value: byBucket.get(index)?.publicContentPageViews || 0,
            })),
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD] Page view timeline unavailable:", error);
        return {
            landingPageViews: [],
            publicContentPageViews: [],
        };
    }
}


export async function loadPostHogConsumerTimeline(
    buckets: Bucket[]
): Promise<ConsumerTimeline> {
    const config = getPostHogConfig();
    const personalApiKey = config?.personalApiKey;
    const projectId = config?.projectId;
    const rawHost = config?.rawHost;

    if (!personalApiKey || !projectId || !rawHost || !buckets.length) {
        return {
            menuViews: [],
            cartAdds: [],
            averageCartCents: [],
        };
    }

    const bucketExpression = buckets
        .map(
            (bucket, index) => `
                timestamp >= parseDateTimeBestEffort('${new Date(
                    bucket.start
                ).toISOString()}')
                AND timestamp < parseDateTimeBestEffort('${new Date(
                    bucket.end
                ).toISOString()}'), ${index}`
        )
        .join(",");

    const start = new Date(buckets[0].start).toISOString();
    const end = new Date(buckets[buckets.length - 1].end).toISOString();
    const hogql = `
        SELECT
            multiIf(${bucketExpression}, -1) AS bucket_index,
            uniqIf(distinct_id, event = '${CONSUMER_EVENTS.menuViewed}') AS menu_views,
            uniqIf(distinct_id, event = '${CONSUMER_EVENTS.itemAddedToCart}') AS cart_adds,
            avgIf(
                properties.cart_total_cents,
                event = '${CONSUMER_EVENTS.itemAddedToCart}'
            ) AS average_cart_cents
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event IN (
              '${CONSUMER_EVENTS.menuViewed}',
              '${CONSUMER_EVENTS.itemAddedToCart}'
          )
          AND NOT startsWith(
              coalesce(toString(properties.$pathname), ''),
              '/mesa/'
          )
          AND NOT startsWith(
              coalesce(toString(properties.consumer_pathname), ''),
              '/mesa/'
          )
        GROUP BY bucket_index
        HAVING bucket_index >= 0
        ORDER BY bucket_index
    `;

    try {
        const response = await fetch(
            `${postHogApiHost(rawHost)}/api/projects/${encodeURIComponent(
                projectId
            )}/query/`,
            {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${personalApiKey}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    query: {
                        kind: "HogQLQuery",
                        query: hogql,
                    },
                }),
                signal: AbortSignal.timeout(15_000),
                cache: "no-store",
            }
        );

        if (!response.ok) {
            throw new Error(`PostHog query failed with ${response.status}.`);
        }

        const payload = (await response.json()) as { results?: unknown[][] };
        const rows = payload.results || [];
        const byBucket = new Map<
            number,
            { menuViews: number; cartAdds: number; averageCartCents: number }
        >(
            rows.map(
                (row) =>
                    [
                        Number(row[0]),
                        {
                            menuViews: Number(row[1]) || 0,
                            cartAdds: Number(row[2]) || 0,
                            averageCartCents: Number(row[3]) || 0,
                        },
                    ] as const
            )
        );

        return {
            menuViews: buckets.map((bucket, index) => ({
                label: bucket.label,
                value: byBucket.get(index)?.menuViews || 0,
            })),
            cartAdds: buckets.map((bucket, index) => ({
                label: bucket.label,
                value: byBucket.get(index)?.cartAdds || 0,
            })),
            averageCartCents: buckets.map((bucket, index) => ({
                label: bucket.label,
                value: byBucket.get(index)?.averageCartCents || 0,
            })),
        };
    } catch (error) {
        console.warn("[DEV_DASHBOARD] Consumer timeline unavailable:", error);
        return {
            menuViews: [],
            cartAdds: [],
            averageCartCents: [],
        };
    }
}
