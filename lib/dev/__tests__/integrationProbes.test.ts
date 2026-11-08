import { runIntegrationChecks } from "../integrationProbes";
import { query } from "@/lib/database/sql";
import { recordIntegrationProbe } from "../health";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/analytics/posthogQuery", () => ({
    getPostHogConfig: jest.fn(() => ({
        personalApiKey: "test-personal-token", projectId: "1", rawHost: "https://us.posthog.com",
    })),
    postHogApiHost: jest.fn((host: string) => host),
}));
jest.mock("@/lib/dev/health", () => ({
    recordDevAlert: jest.fn().mockResolvedValue(undefined),
    recordIntegrationProbe: jest.fn(async (result: unknown) => result),
    resolveDevIncident: jest.fn().mockResolvedValue(undefined),
    GEMINI_FALLBACK_INCIDENT: "integration:gemini:menu-fallback",
    GEMINI_FALLBACK_OPERATION: "Importação de cardápio: fallback OpenAI",
    GEMINI_FALLBACK_THRESHOLD: 3,
}));

const mockQuery = query as jest.Mock;
const mockProbe = recordIntegrationProbe as jest.Mock;
const originalFetch = global.fetch;
const keys = ["NEXT_PUBLIC_TOMTOM_API_KEY", "NEXT_PUBLIC_ARCGIS_API_KEY", "NTFY_TOPIC"] as const;
const saved = Object.fromEntries(keys.map(key => [key, process.env[key]]));
let previousCheck: string | null = null;
let lastDeliveryError: string | null = null;
let posthogStatus = 200;

beforeEach(() => {
    jest.clearAllMocks();
    process.env.NEXT_PUBLIC_TOMTOM_API_KEY = "tomtom-key";
    process.env.NEXT_PUBLIC_ARCGIS_API_KEY = "arcgis-key";
    process.env.NTFY_TOPIC = "test-topic";
    previousCheck = null;
    lastDeliveryError = null;
    posthogStatus = 200;

    mockQuery.mockImplementation(async (sql: string, params?: unknown[]) => {
        if (sql.includes("FROM public.dev_integration_status")) return {
            rows: previousCheck ? [{
                checked_at: previousCheck, operation: "Geocodificação autenticada diária",
            }] : [{ checked_at: new Date().toISOString(), operation: "Metadados públicos" }],
        };
        if (sql.includes("FROM public.dev_alerts") && sql.includes("phone_notified")) {
            return { rows: [{ phone_notified: !lastDeliveryError, delivery_error: lastDeliveryError }] };
        }
        if (sql.includes("COUNT(*)::int AS total")) return { rows: [{ total: 0 }] };
        return { rows: [] };
    });

    global.fetch = jest.fn(async (url: string | URL) => {
        const address = String(url);
        if (address.includes("/api/projects/1/query/"))
            return new Response(
                posthogStatus === 200 ? JSON.stringify({ results: [[1]] }) : "Forbidden",
                { status: posthogStatus }
            );
        if (address.includes("ntfy.sh/v1/health"))
            return new Response(JSON.stringify({ healthy: true }), { status: 200 });
        if (address.includes("api.tomtom.com/search/2/geocode/"))
            return new Response(JSON.stringify({ results: [{ position: { lat: -23, lon: -46 } }] }), { status: 200 });
        if (address.includes("geocode-api.arcgis.com") && address.includes("findAddressCandidates"))
            return new Response(JSON.stringify({ candidates: [{ score: 99 }] }), { status: 200 });
        return new Response(JSON.stringify({}), { status: 200 });
    }) as unknown as typeof fetch;
});

afterAll(() => {
    global.fetch = originalFetch;
    for (const key of keys) {
        if (saved[key] === undefined) delete process.env[key];
        else process.env[key] = saved[key];
    }
});

const observed = (source: string): any => mockProbe.mock.calls
    .map(([result]) => result)
    .find((result: any) => result.id === source);

test("checks TomTom and ArcGIS actual geocoding once and validates PostHog queries and ntfy health", async () => {
    await runIntegrationChecks();
    expect(observed("tomtom")).toMatchObject({ state: "connected", status: 200 });
    expect(observed("arcgis")).toMatchObject({ state: "connected", status: 200 });
    expect(observed("posthog")).toMatchObject({ state: "connected", status: 200 });
    expect(observed("ntfy")).toMatchObject({ state: "connected", status: 200 });
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls.filter(([url]) => String(url).includes("api.tomtom.com"))).toHaveLength(1);
    expect(calls.filter(([url]) => String(url).includes("findAddressCandidates"))).toHaveLength(1);
    expect(calls.filter(([url]) => String(url).includes("ntfy.sh"))).toHaveLength(1);
    expect(calls.some(([, init]) => init?.body?.includes("SELECT 1"))).toBe(true);
});

test("skips provider geocoding while the daily verification is fresh", async () => {
    previousCheck = new Date().toISOString();
    await runIntegrationChecks();
    expect(observed("tomtom")).toBeUndefined();
    expect(observed("arcgis")).toBeUndefined();
    const calls = (global.fetch as jest.Mock).mock.calls;
    expect(calls.some(([url]) => /api.tomtom.com|findAddressCandidates/.test(String(url)))).toBe(false);
});

test("rechecks providers when the previous test is older than 24 hours", async () => {
    previousCheck = new Date(Date.now() - 25 * 60 * 60 * 1000).toISOString();
    await runIntegrationChecks();
    expect(observed("tomtom")).toMatchObject({ state: "connected" });
    expect(observed("arcgis")).toMatchObject({ state: "connected" });
});

test("PostHog still exposes an actionable scope error when queries return 403", async () => {
    posthogStatus = 403;
    await runIntegrationChecks();
    expect(observed("posthog")).toMatchObject({ state: "failed", status: 403 });
    expect(observed("posthog").detail).toContain("query:read");
});

test("ntfy shows degraded only for an actual failed send, not untested phone delivery", async () => {
    lastDeliveryError = "ntfy HTTP 429";
    await runIntegrationChecks();
    expect(observed("ntfy")).toMatchObject({ state: "degraded" });
});
