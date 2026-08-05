"use client";

import posthog from "@/lib/api/instrumentation-client";
import type { ConsumerEventName } from "@/lib/analytics/consumerEvents";

export function captureConsumerEvent(
    event: ConsumerEventName,
    properties: Record<string, unknown>
): void {
    try {
        posthog.capture(event, properties);
    } catch {
        // Analytics must never interrupt the ordering flow.
    }
}
