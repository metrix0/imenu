import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";
import type { ConsumerTrackingMetrics } from "@/lib/analytics/consumerPipeline";

export type ConsumerPostHogFilter = {
    restaurantId: string;
    restaurantSlug: string;
};

export type ConsumerTrafficSource = {
    source: string;
    clicks: number;
    uniqueConsumers: number;
};

export type ConsumerTimeSeriesPoint = {
    date: string;
    menuViews: number;
    averageCartCents: number;
};

export type ConsumerTimeSeriesMetrics = {
    available: boolean;
    points: ConsumerTimeSeriesPoint[];
};

type ConsumerPostHogMetrics = ConsumerTrackingMetrics & {
    sources: ConsumerTrafficSource[];
};

function apiHost(value: string): string {
    return value
        .trim()
        .replace(/\/+$/, "")
        .replace("://us.i.posthog.com", "://us.posthog.com")
        .replace("://eu.i.posthog.com", "://eu.posthog.com");
}

function hogqlString(value: string): string {
    return `'${value.replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
}

function unavailable(): ConsumerPostHogMetrics {
    return {
        available: false,
        menuViews: null,
        itemViews: null,
        addedToCart: null,
        averageCartCents: null,
        informationStarted: null,
        addressStarted: null,
        paymentStarted: null,
        sources: [],
    };
}

async function runHogQL(
    host: string,
    projectId: string,
    personalApiKey: string,
    hogql: string
): Promise<unknown[][]> {
    const response = await fetch(
        `${apiHost(host)}/api/projects/${encodeURIComponent(projectId)}/query/`,
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
        const errorBody = (await response.text()).trim();
        const details = errorBody ? `: ${errorBody.slice(0, 800)}` : "";
        throw new Error(
            `PostHog query failed with ${response.status}${details}`
        );
    }

    const payload = (await response.json()) as { results?: unknown[][] };
    return payload.results || [];
}

function getPostHogConfig() {
    const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
    const rawHost =
        process.env.POSTHOG_API_HOST?.trim() ||
        process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

    if (!personalApiKey || !projectId || !rawHost) return null;
    return { personalApiKey, projectId, rawHost };
}

function restaurantEventFilter(filter?: ConsumerPostHogFilter): string {
    if (!filter) return "";

    return `
          AND (
                (
                    event = ${hogqlString(CONSUMER_EVENTS.menuViewed)}
                    AND properties.restaurant_slug = ${hogqlString(
                        filter.restaurantSlug
                    )}
                )
                OR (
                    event != ${hogqlString(CONSUMER_EVENTS.menuViewed)}
                    AND properties.restaurant_id = ${hogqlString(
                        filter.restaurantId
                    )}
                )
          )`;
}

export async function loadPostHogConsumerMetrics(
    startAt: number,
    endAt: number,
    filter?: ConsumerPostHogFilter
): Promise<ConsumerPostHogMetrics> {
    const config = getPostHogConfig();
    if (!config) return unavailable();

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();

    const trackedEvents = [
        CONSUMER_EVENTS.menuViewed,
        CONSUMER_EVENTS.itemViewed,
        CONSUMER_EVENTS.itemAddedToCart,
        CONSUMER_EVENTS.informationStarted,
        CONSUMER_EVENTS.addressStarted,
        CONSUMER_EVENTS.paymentStarted,
    ]
        .map(hogqlString)
        .join(", ");

    const restaurantFilter = restaurantEventFilter(filter);

    const pipelineHogql = `
        SELECT
            uniqIf(distinct_id, event = ${hogqlString(CONSUMER_EVENTS.menuViewed)}) AS menu_views,
            uniqIf(distinct_id, event = ${hogqlString(CONSUMER_EVENTS.itemViewed)}) AS item_views,
            uniqIf(distinct_id, event = ${hogqlString(
                CONSUMER_EVENTS.itemAddedToCart
            )}) AS added_to_cart,
            avgIf(
                properties.cart_total_cents,
                event = ${hogqlString(CONSUMER_EVENTS.informationStarted)}
            ) AS average_cart_cents,
            uniqIf(distinct_id, event = ${hogqlString(
                CONSUMER_EVENTS.informationStarted
            )}) AS information_started,
            uniqIf(distinct_id, event = ${hogqlString(
                CONSUMER_EVENTS.addressStarted
            )}) AS address_started,
            uniqIf(distinct_id, event = ${hogqlString(
                CONSUMER_EVENTS.paymentStarted
            )}) AS payment_started
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event IN (${trackedEvents})
          ${restaurantFilter}
    `;

    const sourceRestaurantFilter = filter
        ? `AND properties.restaurant_slug = ${hogqlString(
              filter.restaurantSlug
          )}`
        : "";

    const sourceHogql = `
        SELECT
            multiIf(
                notEmpty(properties.utm_source),
                lower(properties.utm_source),
                notEmpty(properties.$utm_source),
                lower(properties.$utm_source),
                notEmpty(properties.referring_domain),
                lower(properties.referring_domain),
                notEmpty(properties.$referring_domain),
                lower(properties.$referring_domain),
                'Direto / sem UTM'
            ) AS source,
            count() AS clicks,
            uniq(distinct_id) AS unique_consumers
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event = ${hogqlString(CONSUMER_EVENTS.menuViewed)}
          ${sourceRestaurantFilter}
        GROUP BY source
        ORDER BY clicks DESC, source ASC
        LIMIT 20
    `;

    try {
        const pipelineRows = await runHogQL(
            config.rawHost,
            config.projectId,
            config.personalApiKey,
            pipelineHogql
        );
        const row = pipelineRows[0];
        if (!row) throw new Error("PostHog returned no result row.");

        let sources: ConsumerTrafficSource[] = [];

        try {
            const sourceRows = await runHogQL(
                config.rawHost,
                config.projectId,
                config.personalApiKey,
                sourceHogql
            );

            sources = sourceRows
                .map((sourceRow) => ({
                    source: String(sourceRow[0] || "Direto / sem UTM"),
                    clicks: Number(sourceRow[1]) || 0,
                    uniqueConsumers: Number(sourceRow[2]) || 0,
                }))
                .filter((source) => source.clicks > 0);
        } catch (error) {
            console.warn(
                "[CONSUMER_PIPELINE] PostHog source metrics unavailable:",
                error
            );
        }

        return {
            available: true,
            menuViews: Number(row[0]) || 0,
            itemViews: Number(row[1]) || 0,
            addedToCart: Number(row[2]) || 0,
            averageCartCents: Number(row[3]) || 0,
            informationStarted: Number(row[4]) || 0,
            addressStarted: Number(row[5]) || 0,
            paymentStarted: Number(row[6]) || 0,
            sources,
        };
    } catch (error) {
        console.warn("[CONSUMER_PIPELINE] PostHog metrics unavailable:", error);
        return unavailable();
    }
}

export async function loadPostHogConsumerTimeSeries(
    startAt: number,
    endAt: number,
    filter?: ConsumerPostHogFilter
): Promise<ConsumerTimeSeriesMetrics> {
    const config = getPostHogConfig();
    if (!config) return { available: false, points: [] };

    const start = new Date(startAt).toISOString();
    const end = new Date(endAt).toISOString();
    const trackedEvents = [
        CONSUMER_EVENTS.menuViewed,
        CONSUMER_EVENTS.informationStarted,
    ]
        .map(hogqlString)
        .join(", ");

    const hogql = `
        SELECT
            toString(toDate(timestamp, 'America/Sao_Paulo')) AS date,
            uniqIf(distinct_id, event = ${hogqlString(CONSUMER_EVENTS.menuViewed)}) AS menu_views,
            avgIf(
                properties.cart_total_cents,
                event = ${hogqlString(CONSUMER_EVENTS.informationStarted)}
            ) AS average_cart_cents
        FROM events
        WHERE timestamp >= parseDateTimeBestEffort('${start}')
          AND timestamp < parseDateTimeBestEffort('${end}')
          AND event IN (${trackedEvents})
          ${restaurantEventFilter(filter)}
        GROUP BY date
        ORDER BY date ASC
    `;

    try {
        const rows = await runHogQL(
            config.rawHost,
            config.projectId,
            config.personalApiKey,
            hogql
        );

        return {
            available: true,
            points: rows.map((row) => ({
                date: String(row[0] || ""),
                menuViews: Number(row[1]) || 0,
                averageCartCents: Number(row[2]) || 0,
            })),
        };
    } catch (error) {
        console.warn("[ANALYTICS] PostHog time series unavailable:", error);
        return { available: false, points: [] };
    }
}
