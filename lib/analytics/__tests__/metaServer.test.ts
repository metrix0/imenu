import { createHash } from "node:crypto";
import { POST } from "@/app/api/meta/route";
import { query } from "@/lib/database/sql";
import { metaCommerceData } from "../metaEvents";
import { metaContext, sendConfirmedMetaPixPurchase } from "../metaServer";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));

const mockedQuery = query as jest.Mock;
const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const checkout = new Request("https://example.com/api/orders", {
    headers: {
        referer: "https://example.com/loja?fbclid=click-id&token=private",
        cookie: "_fbp=fb.1.123.456",
        "x-forwarded-for": "203.0.113.1, 10.0.0.1",
        "user-agent": "test browser",
    },
});
const store = { restaurant_id: "store", meta_pixel_id: "123456", meta_capi_token: "test-token" };
const data = metaCommerceData([{ id: "pizza", quantity: 2 }], 5000, "order-1");
const context = metaContext(checkout, "loja", "store");

beforeEach(() => mockedQuery.mockReset());
afterEach(() => jest.restoreAllMocks());

it("hashes the Brazilian customer fields and keeps browser attribution", () => {
    expect(metaContext(checkout, "loja", "store", {
        name: "João da Silva", phone: "(19) 99999-0000",
        city: "São Paulo", state: "SP", postalCode: "01310-000",
    })).toEqual({
        event_source_url: "https://example.com/loja",
        user_data: {
            country: hash("br"), fn: hash("joão"), ln: hash("silva"),
            ph: hash("5519999990000"), external_id: hash("store:5519999990000"),
            ct: hash("saopaulo"), st: hash("sp"), zp: hash("01310000"),
            fbp: "fb.1.123.456", fbc: expect.stringMatching(/^fb\.1\.\d+\.click-id$/),
            client_ip_address: "203.0.113.1", client_user_agent: "test browser",
        },
    });
});

it("rejects unconfirmed Purchase events sent by the browser", async () => {
    const response = await POST(new Request("https://example.com/api/meta", {
        method: "POST",
        body: JSON.stringify({ slug: "loja", event_name: "Purchase", event_id: "anything" }),
    }));
    expect(response.status).toBe(400);
    expect(mockedQuery).not.toHaveBeenCalled();
});

it("reuses the paid order event ID on retry and deletes context only after delivery", async () => {
    const purchase = { pixel_id: store.meta_pixel_id, event_data: data, browser_context: context };
    mockedQuery.mockResolvedValueOnce({ rows: [purchase] })
        .mockResolvedValueOnce({ rows: [store] })
        .mockResolvedValueOnce({ rows: [purchase] })
        .mockResolvedValueOnce({ rows: [store] })
        .mockResolvedValueOnce({ rows: [] });
    const fetch = jest.spyOn(global, "fetch")
        .mockResolvedValueOnce(Response.json({}, { status: 503 }))
        .mockResolvedValueOnce(Response.json({ events_received: 1 }));

    const paidAt = new Date("2026-11-19T18:00:00.000Z");
    await expect(sendConfirmedMetaPixPurchase("order-1", "store", paidAt)).rejects.toThrow("503");
    expect(mockedQuery).toHaveBeenCalledTimes(2);
    await sendConfirmedMetaPixPurchase("order-1", "store", paidAt);

    for (const [, request] of fetch.mock.calls) {
        expect(JSON.parse(String(request?.body))).toEqual({
            data: [{
                ...context, action_source: "website", event_name: "Purchase",
                event_id: "purchase:order-1", event_time: paidAt.getTime() / 1000, custom_data: data,
            }],
        });
    }
    expect(mockedQuery).toHaveBeenLastCalledWith(expect.stringContaining("DELETE"), ["order-1"]);
});

it("sends payment information only for stores with CAPI configured", async () => {
    mockedQuery.mockResolvedValueOnce({ rows: [{ ...store, meta_capi_token: null }] })
        .mockResolvedValueOnce({ rows: [store] });
    const fetch = jest.spyOn(global, "fetch").mockResolvedValue(Response.json({ events_received: 1 }));
    const request = () => new Request("https://example.com/api/meta", {
        method: "POST",
        headers: checkout.headers,
        body: JSON.stringify({
            slug: "loja", event_name: "AddPaymentInfo", event_id: "pixel-event",
            custom_data: { ...data, order_id: "ignored" }, customer: { phone: "19999990000" },
        }),
    });

    expect(await (await POST(request())).json()).toMatchObject({ skipped: true });
    expect(fetch).not.toHaveBeenCalled();
    expect((await POST(request())).status).toBe(200);
    const [url, options] = fetch.mock.calls[0];
    expect(String(url)).toContain("/v25.0/123456/events");
    const event = JSON.parse(String(options?.body)).data[0];
    expect(event).toMatchObject({
        event_name: "AddPaymentInfo", event_id: "pixel-event",
        user_data: { ph: hash("5519999990000"), country: hash("br") },
    });
    expect(event.custom_data.order_id).toBeUndefined();
});
