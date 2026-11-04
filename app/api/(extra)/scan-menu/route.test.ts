import { GET, POST } from "./route";
import { query } from "@/lib/database/sql";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { readPublicMenuLink } from "@/lib/menu/readPublicMenuLink";

const mockOpenAiCreate = jest.fn();
jest.mock("openai", () => ({
    __esModule: true,
    default: class MockOpenAI {
        responses = { create: (...args: unknown[]) => mockOpenAiCreate(...args) };
    },
}));
jest.mock("@/lib/menu/readPublicMenuLink", () => ({
    readPublicMenuLink: jest.fn(),
    MenuLinkError: class MenuLinkError extends Error {
        constructor(message: string, public status = 422) { super(message); }
    },
}));

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

const setExistingItems = (itemCount: number) => {
    (query as jest.Mock).mockImplementation(async (sql: string) => {
        if (sql.includes("existing_items")) return { rows: [{ present: itemCount >= 2 }] };
        return { rows: [] };
    });
};

beforeEach(() => {
    jest.resetAllMocks();
    (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
    process.env.OPENAI_API_KEY = "test-only-key";
});

afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    jest.restoreAllMocks();
});

it.each([0, 1, 2, 10])("allows free scans with %i existing products", async itemCount => {
    setExistingItems(itemCount);
    expect(await (await GET(request())).json()).toEqual({ hasItems: itemCount >= 2, allowed: true });
    expect((query as jest.Mock).mock.calls.every(([sql]) => !sql.includes("restaurant_addons"))).toBe(true);
});

it("does not send existing-menu context with a single product", async () => {
    setExistingItems(1);
    const response = await POST(new Request(url, {
        method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, urls: [] }),
    }));
    expect(response.status).toBe(400);
    expect((query as jest.Mock).mock.calls.some(([sql]) => sql.includes("SELECT i.name"))).toBe(false);
});

it("includes existing-menu context for free scans with 2 or more products", async () => {
    setExistingItems(2);
    expect(await (await GET(request())).json()).toEqual({ hasItems: true, allowed: true });
    const response = await POST(new Request(url, {
        method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
        body: JSON.stringify({ restaurantId, urls: [] }),
    }));
    expect(response.status).toBe(400);
    expect((query as jest.Mock).mock.calls.some(([sql]) => sql.includes("SELECT i.name"))).toBe(true);
    expect((query as jest.Mock).mock.calls.every(([sql]) => !sql.includes("restaurant_addons"))).toBe(true);
});

it("does not disclose access for another restaurant owner", async () => {
    (requireRestaurantOwner as jest.Mock).mockRejectedValue(
        new RestaurantOwnerAuthError("Acesso negado.", 403)
    );
    expect((await GET(request())).status).toBe(403);
    expect((await POST(post())).status).toBe(403);
    expect(query).not.toHaveBeenCalled();
});

it("retries a hydrated public menu with OpenAI when Gemini returns no products", async () => {
    setExistingItems(0);
    process.env.GEMINI_API_KEY = "test-gemini-key";
    (readPublicMenuLink as jest.Mock).mockResolvedValue(
        "Churros tradicionais: Nutella (Original) R$ 19,00"
    );

    const previousFetch = global.fetch;
    const geminiFetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
            candidates: [{ content: { parts: [{ text: JSON.stringify({ items: [], categories: [] }) }] } }],
        }),
    });
    global.fetch = geminiFetch as unknown as typeof fetch;
    mockOpenAiCreate.mockResolvedValue({
        output_text: JSON.stringify({
            items: [{
                name: "Nutella (Original)", description: null, price_cents: 1900,
                image_path: null, category_name: "Churros tradicionais",
                is_pizza_flavor: false, pizza_sizes: [], pizza_crusts: [],
            }],
            categories: [{ name: "Churros tradicionais" }],
        }),
    });
    try {
        const response = await POST(new Request(url, {
            method: "POST",
            headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId, menuUrl: "https://example.test/menu", urls: [] }),
        }));
        const payload = await response.json();
        expect(response.status).toBe(200);
        expect(payload.items).toHaveLength(1);
        expect(payload.items[0].price_cents).toBe(1900);
        expect(readPublicMenuLink).toHaveBeenCalledTimes(1);
        expect(geminiFetch).toHaveBeenCalledTimes(1);
        expect(mockOpenAiCreate).toHaveBeenCalledTimes(1);
    } finally {
        global.fetch = previousFetch;
    }
});
