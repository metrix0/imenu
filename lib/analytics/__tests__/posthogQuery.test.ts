import { getPostHogConfig, postHogApiHost, runPostHogQuery } from "../posthogQuery";

const envKeys = [
    "POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID",
    "POSTHOG_API_HOST", "NEXT_PUBLIC_POSTHOG_HOST",
] as const;
const saved = Object.fromEntries(envKeys.map(k => [k, process.env[k]]));
const oldFetch = globalThis.fetch;
const config = { personalApiKey: "test-token", projectId: "project 1", rawHost: "https://us.i.posthog.com/" };

afterAll(() => {
    globalThis.fetch = oldFetch;
    for (const key of envKeys) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
});

beforeEach(() => { jest.clearAllMocks(); });

it("normalizes PostHog ingest hosts and reads fallback config", () => {
    expect(postHogApiHost(" https://us.i.posthog.com/ ")).toBe("https://us.posthog.com");
    expect(postHogApiHost("https://eu.i.posthog.com///")).toBe("https://eu.posthog.com");
    process.env.POSTHOG_PERSONAL_API_KEY = "token";
    process.env.POSTHOG_PROJECT_ID = "4";
    delete process.env.POSTHOG_API_HOST;
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://eu.i.posthog.com";
    expect(getPostHogConfig()).toEqual({
        personalApiKey: "token", projectId: "4", rawHost: "https://eu.i.posthog.com",
    });
});

it("preserves method, authorization, timeout and HogQL payload", async () => {
    const fetchMock = jest.fn(async () => ({ ok: true, json: async () => ({ results: [[42]] }) }));
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    expect(await runPostHogQuery("SELECT 42", { config })).toEqual([[42]]);
    expect(fetchMock).toHaveBeenCalledWith(
        "https://us.posthog.com/api/projects/project%201/query/",
        expect.objectContaining({
            method: "POST", cache: "no-store",
            headers: { Authorization: "Bearer test-token", "Content-Type": "application/json" },
            body: JSON.stringify({ query: { kind: "HogQLQuery", query: "SELECT 42" } }),
            signal: expect.any(AbortSignal),
        })
    );
});

it("preserves short and detailed API error variants", async () => {
    globalThis.fetch = jest.fn(async () => ({
        ok: false, status: 429, text: async () => "rate limited",
    })) as unknown as typeof fetch;
    await expect(runPostHogQuery("SELECT 1", { config }))
        .rejects.toThrow("PostHog query failed with 429.");
    await expect(runPostHogQuery("SELECT 1", { config, detailedErrors: true }))
        .rejects.toThrow("PostHog query failed with 429: rate limited");
});
