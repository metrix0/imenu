import { loadPostHogMetrics } from "../dashboardPosthog";

const oldFetch = globalThis.fetch;
const envKeys = ["POSTHOG_PERSONAL_API_KEY", "POSTHOG_PROJECT_ID", "POSTHOG_API_HOST"] as const;
const oldEnv = Object.fromEntries(envKeys.map(key => [key, process.env[key]]));

beforeEach(() => {
    process.env.POSTHOG_PERSONAL_API_KEY = "test-key";
    process.env.POSTHOG_PROJECT_ID = "test-project";
    process.env.POSTHOG_API_HOST = "https://us.i.posthog.com";
});

afterAll(() => {
    globalThis.fetch = oldFetch;
    for (const key of envKeys) {
        if (oldEnv[key] === undefined) delete process.env[key];
        else process.env[key] = oldEnv[key];
    }
});

test.each([true, false])("Plus includes historical pageviews only before the cutover (rolling=%s)", async rolling => {
    const request = jest.fn(async (_url: string, _options: RequestInit) => ({
        ok: true,
        json: async () => ({ results: [[0, 0, 0, 0, 0, 0, 42, 0, 0]] }),
    }));
    globalThis.fetch = request as unknown as typeof fetch;

    const result = await loadPostHogMetrics(
        Date.parse("2026-11-03T00:00:00.000Z"),
        Date.parse("2026-11-11T00:00:00.000Z"),
        rolling,
    );
    expect(result.productPageViews.ia_plus).toBe(42);

    const options = request.mock.calls[0][1];
    const hogql = (JSON.parse(String(options.body)) as { query: { query: string } }).query.query;
    expect(hogql).toContain("timestamp < toDateTime('2026-11-10 12:50:49', 'UTC')");
    expect(hogql).toContain("timestamp >= toDateTime('2026-11-10 12:50:49', 'UTC')");
    expect(hogql).toContain("event = '$pageview'");
    for (const path of ["/painel/assistente-ia", "/painel/vendas-ia", "/painel/marketing"]) {
        expect(hogql).toContain(path);
    }
    for (const surface of ["sales_modal", "plus_page", "assistant_limit", "sales_section", "marketing_page"]) {
        expect(hogql).toContain(surface);
    }
    if (rolling) {
        expect(hogql).toContain("ifNull(any(rv.qr_views), 0) AS qr_pageviews");
    } else {
        expect(hogql).toContain("uniqIf(distinct_id, event = '$pageview' AND properties.$pathname IN ('/painel/mesas', '/painel/mesas/')) AS qr_pageviews");
    }
    expect(hogql).not.toContain("event = 'panel_tab_opened'");
    if (rolling) {
        expect(hogql).toContain("GROUP BY distinct_id, product");
        expect(hogql).toContain("604800");
    } else {
        expect(hogql).toContain("uniqIf(distinct_id, (");
    }
});

test.each([
    ["one day", "2026-11-10T00:00:00.000Z", "2026-11-11T00:00:00.000Z", false],
    ["seven days", "2026-11-04T00:00:00.000Z", "2026-11-11T00:00:00.000Z", false],
    ["over seven days", "2026-11-03T00:00:00.000Z", "2026-11-11T00:00:00.000Z", true],
])("uses the lightweight equivalent distinct query for %s (rolling CTE=%s)",
    async (_label, start, end, shouldRoll) => {
        const request = jest.fn(async (_url: string, _options: RequestInit) => ({
            ok: true,
            json: async () => ({ results: [[0, 0, 0, 0, 0, 546, 197, 0, 0]] }),
        }));
        globalThis.fetch = request as unknown as typeof fetch;

        const result = await loadPostHogMetrics(Date.parse(start), Date.parse(end), true);
        expect(result.productPageViews.imenu).toBe(546);
        expect(result.productPageViews.ia_plus).toBe(197);
        const options = request.mock.calls[0][1];
        const query = (JSON.parse(String(options.body)) as { query: { query: string } }).query.query;
        if (shouldRoll) {
            expect(query).toContain("arrayFold(");
            expect(query).toContain("CROSS JOIN rolling_visitors AS rv");
        } else {
            expect(query).toContain("uniqIf(distinct_id, (");
            expect(query).not.toContain("arrayFold(");
            expect(query).not.toContain("CROSS JOIN rolling_visitors AS rv");
        }
    }
);
