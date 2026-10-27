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

const setSubscription = (hasItems: boolean, status?: string, currentPeriodEnd?: string) => {
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("restaurant_addons")) return {
            rows: status ? [{ status, current_period_ends_at: currentPeriodEnd ?? null }] : [],
        };
        if (sql.includes("SELECT EXISTS")) return { rows: [{ present: hasItems }] };
        return { rows: [] };
    });
};

beforeEach(() => {
    jest.resetAllMocks();
    (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
    process.env.OPENAI_API_KEY = "test-only-key";
});

afterEach(() => { delete process.env.OPENAI_API_KEY; });

it("allows the initial free import when there are no products", async () => {
    setSubscription(false);
    expect((await GET(request()).json()).toEqual({ hasItems: false, hasPlus: false, allowed: true }));
});

it("requires Plus for any existing product, even unavailable ones", async () => {
    setSubscription(true);
    const get = await GET(request());
    expect(await get.json()).toEqual({ hasItems: true, hasPlus: false, allowed: false });

    const response = await POST(post());
    expect(response.status).toBe(403);
    expect((await response.json()).requiresPlus).toBe(true);
});

it("honors active Plus subscriptions and an unexpired canceled period", async () => {
    setSubscription(true, "active");
    expect((await GET(request()).json()).allowed).toBe(true);
    setSubscription(true, "canceled", "2999-01-01T00:00:00Z");
    expect((await GET(request()).json()).allowed).toBe(true);
});

it("does not disclose access for another restaurant owner", async () => {
    (requireRestaurantOwner as jest.Mock).mockRejectedValue(
        new RestaurantOwnerAuthError("Acesso negado.", 403)
    );
    expect((await GET(request())).status).toBe(403);
    expect((await POST(post())).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
});
