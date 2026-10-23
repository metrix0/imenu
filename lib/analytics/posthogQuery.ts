/** Common PostHog transport, preserving caller-specific error reporting. */
export type PostHogConfig = {
    personalApiKey: string;
    projectId: string;
    rawHost: string;
};

export function postHogApiHost(value: string): string {
    return value
        .trim()
        .replace(/\/+$/, "")
        .replace("://us.i.posthog.com", "://us.posthog.com")
        .replace("://eu.i.posthog.com", "://eu.posthog.com");
}

export function getPostHogConfig(): PostHogConfig | null {
    const personalApiKey = process.env.POSTHOG_PERSONAL_API_KEY?.trim();
    const projectId = process.env.POSTHOG_PROJECT_ID?.trim();
    const rawHost = process.env.POSTHOG_API_HOST?.trim() ||
        process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim();

    if (!personalApiKey || !projectId || !rawHost) return null;
    return { personalApiKey, projectId, rawHost };
}

export async function runPostHogQuery(
    hogql: string,
    options: { config?: PostHogConfig; detailedErrors?: boolean } = {}
): Promise<unknown[][]> {
    const config = options.config || getPostHogConfig();
    if (!config) throw new Error("PostHog não configurado.");

    const response = await fetch(
        postHogApiHost(config.rawHost) + "/api/projects/" +
            encodeURIComponent(config.projectId) + "/query/",
        {
            method: "POST",
            headers: {
                Authorization: "Bearer " + config.personalApiKey,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ query: { kind: "HogQLQuery", query: hogql } }),
            signal: AbortSignal.timeout(15_000),
            cache: "no-store",
        }
    );

    if (!response.ok) {
        if (options.detailedErrors) {
            const errorBody = (await response.text()).trim();
            const details = errorBody ? ": " + errorBody.slice(0, 800) : "";
            throw new Error("PostHog query failed with " + response.status + details);
        }
        throw new Error("PostHog query failed with " + response.status + ".");
    }

    const payload = (await response.json()) as { results?: unknown[][] };
    return payload.results || [];
}
