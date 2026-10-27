import { GET, POST } from "./route";
import { query } from "@/lib/database/sql";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";

jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/auth/restaurantOwner", () => {
    class RestaurantOwnerAuthError extends Error {
        constructor(message: string, public status: number) { super(message); }
    }
    return { requireRestaurantOwner: jest.fn(), RestaurantOwnerAuthError };
});

const restaurantId = "restaurant-1";
const url = `https://example.test/api/scan-menu?restaurantId=${restaurantId}`;
const request = () => new Request(url, { headers: { Authorization: "Bearer test" } });
const post = () => new Request(url, {
    method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, urls: ["https://example.test/menu.png"] }),
});

const setSubscription = (itemCount: number, status?: string, currentPeriodEnd?: string) => {
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("restaurant_addons")) return {
            rows: status ? [{ status, current_period_ends_at: currentPeriodEnd ?? null }] : [],
        };
        if (sql.includes("existing_items")) return { rows: [{ present: itemCount >= 2 }] };
        return { rows: [] };
    });
};

beforeEach(() => {
    jest.resetAllMocks();
    (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
    process.env.OPENAI_API_KEY = "test-only-key";
});

afterEach(() => { delete process.env.OPENAI_API_KEY; });

it.each([0, 1])("allows free scans with %i existing products", async itemCount => {
    setSubscription(itemCount);
    expect(await (await GET(request())).json()).toEqual({ hasItems: false, hasPlus: false, allowed: true });
});

it("does not send existing-menu context with a single product", async () => {
    setSubscription(1);
    const response = await POST(new Request(url, {
        method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, urls: [] }),
    }));
    expect(response.status).toBe(400);
    expect((query as jest.Mock).mock.calls.some(([sql]) => sql.includes("SELECT i.name"))).toBe(false);
});

it("requires Plus with at least 2 products, including unavailable ones", async () => {
    setSubscription(2);
    const get = await GET(request());
    expect(await get.json()).toEqual({ hasItems: true, hasPlus: false, allowed: false });

    const response = await POST(post());
    expect(response.status).toBe(403);
    expect((await response.json()).requiresPlus).toBe(true);
});

it("honors active Plus subscriptions and an unexpired canceled period", async () => {
    setSubscription(2, "active");
    expect((await (await GET(request())).json()).allowed).toBe(true);
    setSubscription(2, "canceled", "2999-01-01T00:00:00Z");
    expect((await (await GET(request())).json()).allowed).toBe(true);
});

it("does not disclose access for another restaurant owner", async () => {
    (requireRestaurantOwner as jest.Mock).mockRejectedValue(
        new RestaurantOwnerAuthError("Acesso negado.", 403)
    );
    expect((await GET(request())).status).toBe(403);
    expect((await POST(post())).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
});
