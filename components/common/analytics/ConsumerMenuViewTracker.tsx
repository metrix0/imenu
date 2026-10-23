"use client";

import { useEffect } from "react";

import { captureConsumerEvent } from "@/lib/analytics/captureConsumerEvent";
import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";

function getReferringDomain(): string | null {
    if (!document.referrer) return null;

    try {
        return new URL(document.referrer).hostname.replace(/^www\./, "");
    } catch {
        return null;
    }
}

export default function ConsumerMenuViewTracker({
    restaurantSlug,
}: {
    restaurantSlug: string;
}) {
    useEffect(() => {
        const timer = window.setTimeout(() => {
            const search = new URLSearchParams(window.location.search);

            captureConsumerEvent(CONSUMER_EVENTS.menuViewed, {
                restaurant_slug: restaurantSlug,
                utm_source: search.get("utm_source"),
                utm_medium: search.get("utm_medium"),
                utm_campaign: search.get("utm_campaign"),
                referring_domain: getReferringDomain(),
            });
        }, 0);

        return () => window.clearTimeout(timer);
    }, [restaurantSlug]);

    return null;
}
