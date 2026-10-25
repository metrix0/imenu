import { AsyncLocalStorage } from "node:async_hooks";

import { POST as createItem } from "@/app/api/items/create/route";
import { POST as createCategory } from "@/app/api/categories/create/route";
import { GET as getPayouts } from "@/app/api/mestre/payouts/route";
import { createSupabaseServerClient } from "../supabaseServerClient";

const requestContext = new AsyncLocalStorage<{ requestId: string }>();
const originalEnv = { ...process.env };
let intervals: jest.SpyInstance;
let fetchMock: jest.SpiedFunction<typeof fetch>;

beforeEach(() => {
    process.env.SUPABASE_URL = "https://server.example.invalid";
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://public.example.invalid";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
    intervals = jest.spyOn(globalThis, "setInterval");
    fetchMock = jest.spyOn(globalThis, "fetch");
});

afterEach(() => {
    // A regression must fail without leaving its real auth intervals running.
    for (const result of intervals.mock.results) {
        if (result.type === "return") clearInterval(result.value);
    }
    jest.restoreAllMocks();
    process.env = { ...originalEnv };
});

afterAll(() => requestContext.disable());

it("validates an explicit user token without retaining a request on an auth interval", async () => {
    fetchMock.mockResolvedValue(Response.json({ id: "owner-1" }));

    await requestContext.run({ requestId: "printer-request" }, async () => {
        const client = createSupabaseServerClient();
        const { data, error } = await client.auth.getUser("owner-token");
        expect(error).toBeNull();
        expect(data.user?.id).toBe("owner-1");
        const [url, options] = fetchMock.mock.calls[0];
        expect(String(url)).toBe("https://server.example.invalid/auth/v1/user");
        expect(new Headers(options?.headers).get("authorization")).toBe("Bearer owner-token");
    });

    expect(intervals).not.toHaveBeenCalled();
});

it("still rejects an invalid user token", async () => {
    fetchMock.mockResolvedValue(Response.json({ msg: "Invalid JWT" }, { status: 401 }));
    const { data, error } = await createSupabaseServerClient().auth.getUser("invalid-token");
    expect(data.user).toBeNull();
    expect(error?.status).toBe(401);
    expect(intervals).not.toHaveBeenCalled();
});

it.each([
    ["items", createItem, { restaurant_id: "r1", category_id: "c1", name: "Item", price_cents: 100 }, "item"],
    ["categories", createCategory, { restaurant_id: "r1", name: "Category" }, "category"],
] as const)("creates %s without starting an auth interval", async (table, handler, body, resultKey) => {
    fetchMock.mockResolvedValue(Response.json({ id: "created-1", ...body }));
    const response = await requestContext.run({ requestId: table }, () => handler(new Request(
        "https://app.example.invalid/api/create",
        { method: "POST", body: JSON.stringify(body) }
    )));

    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ [resultKey]: { id: "created-1", ...body } });
    const [url, options] = fetchMock.mock.calls[0];
    expect(String(url)).toContain(`https://public.example.invalid/rest/v1/${table}?`);
    expect(new Headers(options?.headers).get("authorization")).toBe("Bearer test-service-key");
    expect(JSON.parse(String(options?.body))).toMatchObject(body);
    expect(intervals).not.toHaveBeenCalled();
});

it("preserves payout filtering and deduplication without starting an auth interval", async () => {
    const restaurant = { id: "r1", name: "Restaurant" };
    fetchMock.mockResolvedValue(Response.json([
        { restaurant_id: "r1", restaurants: restaurant },
        { restaurant_id: "r1", restaurants: restaurant },
    ]));
    const response = await requestContext.run({ requestId: "payouts" }, getPayouts);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual([restaurant]);
    const [url, options] = fetchMock.mock.calls[0];
    const parsed = new URL(String(url));
    expect(parsed.origin + parsed.pathname).toBe("https://public.example.invalid/rest/v1/orders");
    expect(parsed.searchParams.get("payment_method")).toBe("in.(pix,cartao)");
    expect(parsed.searchParams.getAll("status")).toEqual(["neq.pending_online_payment", "neq.canceled"]);
    expect(new Headers(options?.headers).get("authorization")).toBe("Bearer test-service-key");
    expect(intervals).not.toHaveBeenCalled();
});
