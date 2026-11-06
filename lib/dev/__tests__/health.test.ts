import { query } from "@/lib/database/sql";
import { integrationForUrl, installIntegrationObserver, recordDevAlert } from "../health";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn().mockResolvedValue({ rows: [], rowCount: 1 }) }));
const originalFetch = global.fetch;
afterEach(() => { global.fetch = originalFetch; delete (globalThis as typeof globalThis & { __imenuDevObserver?: boolean }).__imenuDevObserver; });

test("provider matching uses exact host boundaries and configured internal WAHA host", () => {
    expect(integrationForUrl("https://api.asaas.com/v3/transfers?secret=abc")).toBe("asaas");
    expect(integrationForUrl("https://asaas.com.evil.example/anything")).toBeNull();
    process.env.WAHA_API_URL = "http://waha:3000";
    expect(integrationForUrl("http://waha:3000/api/sessions")).toBe("waha");
    delete process.env.WAHA_API_URL;
});

test("real HTTP failures record only provider/status, preserving the original response", async () => {
    const response = new Response("private provider response", { status: 503 });
    global.fetch = jest.fn().mockResolvedValue(response);
    installIntegrationObserver();
    expect(await fetch("https://api.tomtom.com/search?key=do-not-store&address=private")).toBe(response);
    expect(query).toHaveBeenLastCalledWith(expect.stringContaining("INSERT INTO public.dev_alerts"), expect.arrayContaining(["tomtom", "HTTP 503"]));
    expect(JSON.stringify((query as jest.Mock).mock.calls)).not.toContain("do-not-store");
    expect(JSON.stringify((query as jest.Mock).mock.calls)).not.toContain("private provider response");
});

test("ordinary validation/not-found responses do not create outage alerts", async () => {
    (query as jest.Mock).mockClear();
    global.fetch = jest.fn().mockResolvedValue(new Response("", { status: 404 })); installIntegrationObserver();
    await fetch("https://api.openai.com/v1/files/missing");
    expect(query).not.toHaveBeenCalled();
});

test("monitoring storage failures never replace the underlying request result", async () => {
    (query as jest.Mock).mockRejectedValueOnce(new Error("database unavailable"));
    await expect(recordDevAlert({ source: "unit-test", title: "Failure", message: "Unavailable" })).resolves.toBeUndefined();
});
