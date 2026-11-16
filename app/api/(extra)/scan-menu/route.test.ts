import { GET, POST } from "./route";
import { query } from "@/lib/database/sql";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { MenuLinkError, readPublicMenuLink } from "@/lib/menu/readPublicMenuLink";
import { recordGeminiMenuFallback } from "@/lib/dev/health";
import { importMenuPhotos } from "@/lib/menu/importMenuPhotos";

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

jest.mock("@/lib/menu/importMenuPhotos", () => ({ importMenuPhotos: jest.fn() }));
jest.mock("@/lib/database/sql", () => ({ query: jest.fn() }));
jest.mock("@/lib/dev/health", () => ({ recordGeminiMenuFallback: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/lib/auth/restaurantOwner", () => {
    class RestaurantOwnerAuthError extends Error {
        constructor(message: string, public status: number) { super(message); }
    }
    return { requireRestaurantOwner: jest.fn(), RestaurantOwnerAuthError };
});

const restaurantId = "restaurant-1";
const url = `https://example.test/api/scan-menu?restaurantId=${restaurantId}`;
const request = () => new Request(url, { headers: { Authorization: "Bearer test" } });
const submitLink = (menuUrl = "https://example.test/menu") => new Request(url, {
    method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
    body: JSON.stringify({ restaurantId, menuUrl, urls: [] }),
});
const diagnostics = () => (query as jest.Mock).mock.calls.filter(([sql]) => sql.includes("INSERT INTO public.menu_scan_events"));
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

const configuredMenuModel = process.env.OPENAI_MENU_SCAN_MODEL;

beforeEach(() => {
    jest.resetAllMocks();
    (requireRestaurantOwner as jest.Mock).mockResolvedValue({});
    process.env.OPENAI_API_KEY = "test-only-key";
    delete process.env.OPENAI_MENU_SCAN_MODEL;
});

afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.GEMINI_API_KEY;
    if (configuredMenuModel === undefined) delete process.env.OPENAI_MENU_SCAN_MODEL;
    else process.env.OPENAI_MENU_SCAN_MODEL = configuredMenuModel;
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
    (readPublicMenuLink as jest.Mock).mockResolvedValue({ text: "Churros tradicionais: Nutella (Original) R$ 19,00", images: [] });

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
        expect(diagnostics()).toHaveLength(1);
        expect(diagnostics()[0][1].slice(0,7)).toEqual([restaurantId, "link", "success", 0, null, 1, null]);
        expect(diagnostics()[0][1][12]).toEqual({ url: "https://example.test/menu" });
        expect(geminiFetch).toHaveBeenCalledTimes(1);
        expect(mockOpenAiCreate).toHaveBeenCalledTimes(1);
        expect(mockOpenAiCreate).toHaveBeenCalledWith(expect.objectContaining({
            model: "gpt-6-luna",
            reasoning: { effort: "none" },
            text: {
                format: {
                    type: "json_schema",
                    name: "menu_scan",
                    strict: true,
                    schema: expect.objectContaining({
                        required: ["items", "categories"],
                        additionalProperties: false,
                    }),
                },
            },
        }));
        expect(recordGeminiMenuFallback).toHaveBeenCalledWith("Gemini não identificou produtos");
    } finally {
        global.fetch = previousFetch;
    }
});

it("honors the OpenAI model override when Gemini is unavailable", async () => {
    setExistingItems(0);
    process.env.OPENAI_MENU_SCAN_MODEL = "gpt-4.1";
    mockOpenAiCreate.mockResolvedValue({
        output_text: JSON.stringify({
            items: [{ name: "Suco", description: null, price_cents: 900,
                image_path: null, category_name: "Bebidas", is_pizza_flavor: false,
                pizza_sizes: [], pizza_crusts: [] }],
            categories: [{ name: "Bebidas" }],
        }),
    });
    const response = await POST(post());
    expect(response.status).toBe(200);
    expect(recordGeminiMenuFallback).toHaveBeenCalledWith("GEMINI_API_KEY ausente");
    const [request] = mockOpenAiCreate.mock.calls[0];
    expect(request.model).toBe("gpt-4.1");
    expect(request).not.toHaveProperty("reasoning");
    expect(request.text.format.strict).toBe(true);
});

it("records a Gemini rate-limit fallback without exposing the response body", async () => {
    setExistingItems(0);
    process.env.GEMINI_API_KEY = "test-gemini-key";
    (readPublicMenuLink as jest.Mock).mockResolvedValue({ text: "Suco R$ 9,00", images: [] });
    const previousFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
        ok: false, status: 429, text: async () => "Too many requests",
    }) as unknown as typeof fetch;
    mockOpenAiCreate.mockResolvedValue({
        output_text: JSON.stringify({
            items: [{ name: "Suco", description: null, price_cents: 900,
                image_path: null, category_name: "Bebidas", is_pizza_flavor: false,
                pizza_sizes: [], pizza_crusts: [] }],
            categories: [{ name: "Bebidas" }],
        }),
    });
    try {
        const response = await POST(new Request(url, {
            method: "POST", headers: { Authorization: "Bearer test", "Content-Type": "application/json" },
            body: JSON.stringify({ restaurantId, menuUrl: "https://example.test/menu", urls: [] }),
        }));
        expect(response.status).toBe(200);
        expect(recordGeminiMenuFallback).toHaveBeenCalledWith("Gemini HTTP 429");
    } finally {
        global.fetch = previousFetch;
    }
});

it("falls back to OpenAI when the Gemini request times out", async () => {
    setExistingItems(0);
    process.env.GEMINI_API_KEY = "test-gemini-key";
    (readPublicMenuLink as jest.Mock).mockResolvedValue({ text: "Suco R$ 9,00", images: [] });
    const geminiFetch = jest.spyOn(globalThis, "fetch").mockRejectedValue(
        new DOMException("The operation was aborted due to timeout", "TimeoutError"),
    );
    mockOpenAiCreate.mockResolvedValue({
        output_text: JSON.stringify({
            items: [{
                name: "Suco", description: null, price_cents: 900, image_path: null,
                category_name: "Bebidas", is_pizza_flavor: false, pizza_sizes: [], pizza_crusts: [],
            }],
            categories: [{ name: "Bebidas" }],
        }),
    });

    try {
        const response = await POST(submitLink());
        expect(response.status).toBe(200);
        expect((await response.json()).items).toEqual([
            expect.objectContaining({ name: "Suco", price_cents: 900 }),
        ]);
        expect(mockOpenAiCreate).toHaveBeenCalledTimes(1);
        expect(recordGeminiMenuFallback).toHaveBeenCalledWith("Tempo limite do Gemini excedido");
        expect(diagnostics()[0][1].slice(2, 6)).toEqual([
            "success", null, "Tempo limite do Gemini excedido", 1,
        ]);
    } finally {
        geminiFetch.mockRestore();
    }
});

it("records short extracted text on link failure and redacts contact and URL details", async () => {
    setExistingItems(0);
    (readPublicMenuLink as jest.Mock).mockImplementation(async (_url, onExtracted) => {
        onExtracted("Carregando cardápio. contato@example.com\nhttps://example.test/m?secret=abc\nDados estruturados:\nhidden text");
        throw new MenuLinkError("Não encontramos conteúdo suficiente nesse link.");
    });
    const response = await POST(submitLink("https://example.test/menu?secret=abc"));
    expect(response.status).toBe(422);
    expect(diagnostics()).toHaveLength(1);
    expect(diagnostics()[0][1].slice(2,11)).toEqual([
        "failed", null, null, null, null, "link_http_422", "example.test",
        expect.any(Number), "Carregando cardápio. [email] [url]",
    ]);
    expect(mockOpenAiCreate).not.toHaveBeenCalled();
});

it("records both zero outcomes when neither provider recovers a link", async () => {
    setExistingItems(0);
    process.env.GEMINI_API_KEY = "test-gemini-key";
    (readPublicMenuLink as jest.Mock).mockImplementation(async (_url, onExtracted) => {
        onExtracted("Carregando cardápio.");
        return { text: "Carregando cardápio.", images: [] };
    });
    const previousFetch = global.fetch;
    const empty = JSON.stringify({ items: [], categories: [] });
    global.fetch = jest.fn().mockResolvedValue({
        ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: empty }] } }] }),
    }) as unknown as typeof fetch;
    mockOpenAiCreate.mockResolvedValue({ output_text: empty });
    try {
        expect((await POST(submitLink())).status).toBe(422);
        expect(diagnostics()).toHaveLength(1);
        expect(diagnostics()[0][1].slice(2,11)).toEqual([
            "empty", 0, null, 0, null, "no_products", "example.test", 20, "Carregando cardápio.",
        ]);
    } finally {
        global.fetch = previousFetch;
    }
});

it("preserves the import response when writing diagnostics fails", async () => {
    setExistingItems(0);
    const baselineQuery = (query as jest.Mock).getMockImplementation()!;
    (query as jest.Mock).mockImplementation(async (sql, params) => {
        if (sql.includes("INSERT INTO public.menu_scan_events")) throw new Error("DB unavailable");
        return baselineQuery(sql, params);
    });
    (readPublicMenuLink as jest.Mock).mockRejectedValue(new MenuLinkError("Link inacessível."));
    expect((await POST(submitLink())).status).toBe(422);
    expect(diagnostics()).toHaveLength(1);
});

it("keeps only references to files in the menu upload bucket", async () => {
    const { menuScanFilePaths } = await import("@/lib/menu/scanDiagnostics");
    const previous = process.env.NEXT_PUBLIC_SUPABASE_URL;
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://storage.example.test";
    const path = "00000000-0000-4000-8000-000000000001-cardapio.pdf";
    const base = "https://storage.example.test/storage/v1/object/public/full-menu-images-ai/";
    try {
        expect(menuScanFilePaths([
            base + path,
            base + "%2F" + path,
            "https://other.example.test/storage/v1/object/public/full-menu-images-ai/" + path,
        ])).toEqual([path]);
    } finally {
        if (previous === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        else process.env.NEXT_PUBLIC_SUPABASE_URL = previous;
    }
});

it.each([
    ["https://example.test/menu?restaurant=7", { url: "https://example.test/menu?restaurant=7" }],
    ["example.test/menu", { url: "https://example.test/menu" }],
    ["https://example.test/menu?access_token=private", null],
    ["javascript:alert(1)", null],
])("records a safe submitted source even if link reading fails (%s)", async (input, expectedSource) => {
    setExistingItems(0);
    (readPublicMenuLink as jest.Mock).mockRejectedValue(new MenuLinkError("Link inacessível.", 400));

    expect((await POST(submitLink(input))).status).toBe(400);
    expect(diagnostics()).toHaveLength(1);
    expect(diagnostics()[0][1][12]).toEqual(expectedSource);
});

it("returns only photos matched to source product images for link scans", async () => {
    setExistingItems(0);
    const images = [{ url: "https://images.example.test/suco.png", names: ["Suco"], area: 6400 }];
    (readPublicMenuLink as jest.Mock).mockResolvedValue({ text: "Suco R$ 9,00", images });
    mockOpenAiCreate.mockResolvedValue({
        output_text: JSON.stringify({
            items: [
                { name: "Suco", price_cents: 900, category_name: "Bebidas" },
                { name: "Café", price_cents: 500, category_name: "Bebidas", image_path: "untrusted/model-path" },
            ],
            categories: [{ name: "Bebidas" }],
        }),
    });
    (importMenuPhotos as jest.Mock).mockImplementation(async (_restaurant, items) => {
        expect(items[1].image_path).toBeNull();
        items[0].image_path = "menu-images/restaurant-1/suco.webp";
    });

    const response = await POST(submitLink());
    expect(response.status).toBe(200);
    expect((await response.json()).items).toEqual([
        expect.objectContaining({ name: "Suco", image_path: "menu-images/restaurant-1/suco.webp" }),
        expect.objectContaining({ name: "Café", image_path: null }),
    ]);
    expect(importMenuPhotos).toHaveBeenCalledWith(restaurantId, expect.any(Array), images);
});

it("preserves products when preparing source photos fails", async () => {
    setExistingItems(0);
    const images = [{ url: "https://images.example.test/suco.png", names: ["Suco"], area: 6400 }];
    (readPublicMenuLink as jest.Mock).mockResolvedValue({ text: "Suco R$ 9,00", images });
    mockOpenAiCreate.mockResolvedValue({
        output_text: JSON.stringify({
            items: [{ name: "Suco", price_cents: 900 }],
            categories: [],
        }),
    });
    (importMenuPhotos as jest.Mock).mockRejectedValue(new Error("Storage unavailable"));

    const response = await POST(submitLink());
    expect(response.status).toBe(200);
    expect((await response.json()).items).toEqual([
        expect.objectContaining({ name: "Suco", price_cents: 900, image_path: null }),
    ]);
});
