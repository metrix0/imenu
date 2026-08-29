"use client";

import { getPosthog } from "@/lib/api/instrumentation-client";
import type { ConsumerEventName } from "@/lib/analytics/consumerEvents";

export function captureConsumerEvent(
    event: ConsumerEventName,
    properties: Record<string, unknown>
): void {
    if (
        typeof window !== "undefined" &&
        window.location.pathname.startsWith("/mesa/")
    ) {
        return;
    }

    void getPosthog()
        .then((posthog) =>
            posthog?.capture(event, {
                ...properties,
                consumer_pathname:
                    typeof window !== "undefined"
                        ? window.location.pathname
                        : null,
            })
        )
        .catch(() => {
            // Analytics must never interrupt the ordering flow.
        });
}
