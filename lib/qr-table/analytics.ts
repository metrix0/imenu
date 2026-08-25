"use client";

import { getPosthog } from "@/lib/api/instrumentation-client";

export async function captureQrTableEvent(
    event: string,
    properties?: Record<string, unknown>
): Promise<void> {
    const posthog = await getPosthog();
    posthog?.capture(event, properties);
}
