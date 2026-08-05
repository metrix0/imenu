import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";
import type { ConsumerTrackingMetrics } from "@/lib/analytics/consumerPipeline";

export type ConsumerPostHogFilter = {
    restaurantId: string;
    restaurantSlug: string;
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

function unavailable(): ConsumerTrackingMetrics {
    return {
        available: false,
        menuViews: null,
        itemViews: null,
        addedToCart: null,
        averageCartCents: null,
        informationStarted: null,
        addressStarted: null,
        paymentStarted: null,
    };
}

export async function loadPostHogConsumerMetrics(
    startAt: number,
    endAt: number,
    filter?: ConsumerPostHogFilter
): Promise<ConsumerTrackingMetrics> {
    const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
    const rawHost =
        process.env.POSTHOG_API_HOST?.trim() ||
        process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

    if (!personalApiKey || !projectId || !rawHost) return unavailable();

    const start = new Date(startAt)
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "");
    const end = new Date(endAt)
        .toISOString()
        .replace("T", " ")
        .replace(/\.\d{3}Z$/, "");

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

    const restaurantFilter = filter
        ? `
          AND (
                (
                    event = ${hogqlString(CONSUMER_EVENTS.menuViewed)}
                    AND toString(properties.restaurant_slug) = ${hogqlString(
                        filter.restaurantSlug
                    )}
                )
                OR (
                    event != ${hogqlString(CONSUMER_EVENTS.menuViewed)}
                    AND toString(properties.restaurant_id) = ${hogqlString(
                        filter.restaurantId
                    )}
                )
          )`
        : "";

    const hogql = `
        SELECT
            uniqIf(distinct_id, event = ${hogqlString(CONSUMER_EVENTS.menuViewed)}) AS menu_views,
            uniqIf(distinct_id, event = ${hogqlString(CONSUMER_EVENTS.itemViewed)}) AS item_views,
            uniqIf(distinct_id, event = ${hogqlString(
                CONSUMER_EVENTS.itemAddedToCart
            )}) AS added_to_cart,
            avgIf(
                toFloat64OrZero(toString(properties.cart_total_cents)),
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
        WHERE timestamp >= toDateTime('${start}', 'UTC')
          AND timestamp < toDateTime('${end}', 'UTC')
          AND event IN (${trackedEvents})
          ${restaurantFilter}
    `;

    try {
        const response = await fetch(
            `${apiHost(rawHost)}/api/projects/${encodeURIComponent(
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
            menuViews: Number(row[0]) || 0,
            itemViews: Number(row[1]) || 0,
            addedToCart: Number(row[2]) || 0,
            averageCartCents: Number(row[3]) || 0,
            informationStarted: Number(row[4]) || 0,
            addressStarted: Number(row[5]) || 0,
            paymentStarted: Number(row[6]) || 0,
        };
    } catch (error) {
        console.warn("[CONSUMER_PIPELINE] PostHog metrics unavailable:", error);
        return unavailable();
    }
}
