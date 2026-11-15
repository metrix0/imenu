import type { NextFetchEvent } from "next/server";
import { proxy } from "@/proxy";
import { query } from "@/lib/database/sql";
import { captureAffiliateEvent, recordAffiliatePurchase, rememberAffiliateReferral } from "../affiliateAttribution";
import { normalizeAffiliateCode, readAffiliateCookie } from "../affiliateCode";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

const db = jest.mocked(query);
const originalFetch = global.fetch;
const host = process.env.NEXT_PUBLIC_POSTHOG_HOST;
const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
const visitId = "11111111-1111-4111-8111-111111111111";
const purchase = {
    id: "22222222-2222-4222-8222-222222222222",
    user_id: "user",
    affiliate_code: "partner-a",
    visit_id: visitId,
    restaurant_id: "restaurant",
    amount_cents: 4999,
    paid_at: new Date("2026-11-15T15:00:00Z"),
};

beforeEach(() => {
    db.mockReset().mockResolvedValue({ rows: [], rowCount: 0 });
    process.env.NEXT_PUBLIC_POSTHOG_HOST = "https://posthog.example/";
    process.env.NEXT_PUBLIC_POSTHOG_KEY = "fixture";
    global.fetch = jest.fn(async () => new Response(null, { status: 200 }));
});

afterEach(() => {
    global.fetch = originalFetch;
    if (host === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_HOST;
    else process.env.NEXT_PUBLIC_POSTHOG_HOST = host;
    if (key === undefined) delete process.env.NEXT_PUBLIC_POSTHOG_KEY;
    else process.env.NEXT_PUBLIC_POSTHOG_KEY = key;
});

test("validates the link format and stores one referral for an authenticated buyer", async () => {
    expect(normalizeAffiliateCode(" Partner-A ")).toBe("partner-a");
    expect(normalizeAffiliateCode("partner/../b")).toBeNull();
    const request = new Request("https://www.imenuapp.com.br/", {
        headers: { cookie: `other=1; imenu_affiliate=partner-a.${visitId}` },
    });
    expect(readAffiliateCookie(request)).toEqual({ code: "partner-a", visitId });
    await rememberAffiliateReferral(request, "user");
    expect(db).toHaveBeenCalledWith(expect.stringContaining("ON CONFLICT (user_id) DO NOTHING"), ["user", "partner-a", visitId]);
    await rememberAffiliateReferral(new Request("https://www.imenuapp.com.br/"), "user");
    expect(db).toHaveBeenCalledTimes(1);
});

test("captures linked visit and confirmed purchase events", async () => {
    await captureAffiliateEvent("affiliate_link_visited", visitId, visitId, { af: "partner-a" });
    db.mockResolvedValueOnce({ rows: [purchase], rowCount: 1 });
    await recordAffiliatePurchase("addon", "provider-payment");

    const events = (global.fetch as jest.Mock).mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(events[0]).toMatchObject({ event: "affiliate_link_visited", distinct_id: visitId, properties: { af: "partner-a" } });
    expect(events[1]).toMatchObject({
        event: "imenu_plus_affiliate_purchase", distinct_id: "user", uuid: purchase.id,
        timestamp: purchase.paid_at.toISOString(),
        properties: { af: "partner-a", referral_visit_id: visitId, amount_cents: 4999 },
    });
    expect(db).toHaveBeenLastCalledWith(expect.stringContaining("INSERT INTO public.affiliate_purchase_events"), [purchase.id]);
    await recordAffiliatePurchase("addon", "provider-payment");
    expect(global.fetch).toHaveBeenCalledTimes(2);
});

test("keeps attribution available for retry when PostHog is unavailable", async () => {
    (global.fetch as jest.Mock).mockResolvedValue(new Response(null, { status: 503 }));
    db.mockResolvedValueOnce({ rows: [purchase], rowCount: 1 });
    await recordAffiliatePurchase("addon", "provider-payment");
    expect(db).toHaveBeenCalledTimes(1);
});


test("sets a 30-day cookie and captures visits for valid codes only", async () => {
    const waitUntil = jest.fn();
    const event = { waitUntil } as unknown as NextFetchEvent;
    const url = "https://www.imenuapp.com.br/?af=Partner-A";
    const headers = { host: "www.imenuapp.com.br" };
    db.mockResolvedValueOnce({ rows: [{ valid: 1 }], rowCount: 1 });

    const response = await proxy(new Request(url, { headers }), event);
    const cookie = response?.headers.get("set-cookie") || "";
    expect(cookie).toMatch(/^imenu_affiliate=partner-a\.[0-9a-f-]+;/);
    expect(cookie).toContain("Max-Age=2592000");
    expect(cookie).toContain("HttpOnly");
    expect(response?.headers.get("cache-control")).toBe("private, no-store");
    await waitUntil.mock.calls[0][0];

    const next = await proxy(new Request("https://www.imenuapp.com.br/?af=another", {
        headers: { ...headers, cookie: cookie.split(";")[0] },
    }), event);
    expect(next?.headers.get("set-cookie")).toBeFalsy();

    const unknown = await proxy(new Request("https://www.imenuapp.com.br/?af=unknown", { headers }), event);
    expect(unknown?.headers.get("set-cookie")).toBeFalsy();
    expect(waitUntil).toHaveBeenCalledTimes(1);
});


test("captures a later Plus payment for the same affiliate", async () => {
    const renewal = { ...purchase, id: "33333333-3333-4333-8333-333333333333", paid_at: new Date("2026-12-15T15:00:00Z") };
    db.mockResolvedValueOnce({ rows: [purchase], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [], rowCount: 1 })
        .mockResolvedValueOnce({ rows: [renewal], rowCount: 1 });
    await recordAffiliatePurchase("addon", "first-payment");
    await recordAffiliatePurchase("addon", "renewal");
    const events = (global.fetch as jest.Mock).mock.calls.map(([, init]) => JSON.parse(init.body));
    expect(events.map(event => [event.uuid, event.properties.af])).toEqual([
        [purchase.id, "partner-a"],
        [renewal.id, "partner-a"],
    ]);
});
