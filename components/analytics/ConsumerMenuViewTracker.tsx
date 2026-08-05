"use client";

import { useEffect } from "react";

import { captureConsumerEvent } from "@/lib/analytics/captureConsumerEvent";
import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";

export default function ConsumerMenuViewTracker({
    restaurantSlug,
}: {
    restaurantSlug: string;
}) {
    useEffect(() => {
        const timer = window.setTimeout(() => {
            captureConsumerEvent(CONSUMER_EVENTS.menuViewed, {
                restaurant_slug: restaurantSlug,
            });
        }, 0);

        return () => window.clearTimeout(timer);
    }, [restaurantSlug]);

    return null;
}
