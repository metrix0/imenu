import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import MenuClientPage from "@/app/[slug]/menu-client";
import ItemModal from "@/app/[slug]/ItemModal";
import MenuPage from "@/app/[slug]/page";
import VitrinePage from "@/app/vitrine/[slug]/page";
import { getPublicMenuRestaurant } from "@/app/[slug]/restaurant-data";

let mockAddons: Array<{ product_key: string; status: string; current_period_ends_at: string | null }> = [];
let mockAddonError: Error | null = null;

jest.mock("next/navigation", () => ({ useRouter: () => ({}), usePathname: () => "/vitrine/test", notFound: () => { throw new Error("NOT_FOUND"); } }));
jest.mock("next/image", () => ({ __esModule: true, default: ({ fill, preload, ...props }: any) => <img {...props} /> }));
jest.mock("@/lib/database/supabaseClient", () => ({ supabase: {} }));
jest.mock("@/app/[slug]/restaurant-data", () => ({ getPublicMenuRestaurant: jest.fn() }));
jest.mock("@/components/ui/HybridModal", () => ({ __esModule: true, default: ({ children, open }: any) => <div data-modal-open={String(open)}>{children}</div> }));
jest.mock("@/components/ui/Tooltip", () => ({ __esModule: true, default: ({ children }: any) => <div>{children}</div> }));
jest.mock("@/components/costumer/CartBar", () => ({ __esModule: true, default: () => <div>CART_CONTROL</div> }));
jest.mock("@/app/[slug]/CartModal", () => ({ __esModule: true, default: () => <div>CHECKOUT_CONTROL</div> }));
jest.mock("@/components/costumer/HistoryModal", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/analytics/ConsumerMenuViewTracker", () => ({ __esModule: true, default: () => null }));
jest.mock("@/components/costumer/TrackingScripts", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/[slug]/StartingPriceLabels", () => ({ __esModule: true, default: () => null }));
jest.mock("@/app/[slug]/PickupAvailabilityGuard", () => ({ __esModule: true, default: () => null }));
jest.mock("@/lib/database/supabaseServerClient", () => ({ createSupabaseServerClient: () => ({
    from: (table: string) => {
        const chain: any = { then: (resolve: any) => resolve(table === "restaurant_addons" ? { data: mockAddons, error: mockAddonError } : { data: [] }) };
        for (const method of ["select", "eq", "in", "order", "limit", "maybeSingle", "lte", "or"]) chain[method] = () => chain;
        return chain;
    },
    storage: { from: () => ({ getPublicUrl: () => ({ data: { publicUrl: "/test.png" } }) }) },
}) }));

const restaurant: any = {
    id: "restaurant", name: "Test Restaurant", logo_url: null, banner_url: null,
    rating: null, min_order_cents: 0, availability_json: {}, delivery_fee_json: {},
    latitude: 0, longitude: 0, is_closed: null, allow_future_order_scheduling: true,
};
const item: any = { id: "item", name: "Açaí", description: "Açaí cremoso", price_cents: 1500, is_available: true };
const subcategories: any[] = [{ id: "group", name: "Adicionais", min_select: 1, max_select: 3, subitems: [{ id: "extra", name: "Leite em pó", price_cents: 200 }]}];

function renderMenu(readOnly?: boolean) {
    return renderToStaticMarkup(<MenuClientPage readOnly={readOnly} slug="test" restaurant={restaurant} categories={[]} itemsByCategory={{}} />);
}
function renderItem(readOnly?: boolean) {
    return renderToStaticMarkup(<ItemModal readOnly={readOnly} restaurant={restaurant} item={item} subcategories={subcategories} loading={false} onClose={() => {}} deliveryTax={null} deliveryTime={null} />);
}

beforeEach(() => {
    mockAddons = [];
    mockAddonError = null;
});

test("Vitrine keeps products and complement prices but removes all product ordering controls", () => {
    const html = renderItem(true);
    expect(html).toContain("Açaí cremoso");
    expect(html).toContain("Leite em pó");
    expect(html).toContain("2,00");
    expect(html).not.toContain("Adicionar");
    expect(html).not.toContain("Alguma observação?");
    expect(html).not.toContain("Escolha até");
    expect(html).not.toContain("OBRIGATÓRIO");
    expect(html).not.toContain("textarea");
});

test("normal product ordering is preserved when readOnly is omitted", () => {
    const html = renderItem();
    expect(html).toContain("Adicionar");
    expect(html).toContain("Alguma observação?");
    expect(html).toContain("OBRIGATÓRIO");
});

test("Vitrine hides an existing delivery cart, even when future orders are enabled", () => {
    expect(renderMenu(true)).toContain("Somente visualização");
    expect(renderMenu(true)).not.toContain("CART_CONTROL");
    expect(renderMenu(true)).not.toContain("CHECKOUT_CONTROL");
    expect(renderMenu()).toContain("CART_CONTROL");
});

test("disabled Vitrine returns not found while the delivery menu still renders", async () => {
    (getPublicMenuRestaurant as jest.Mock).mockResolvedValue({ ...restaurant, vitrine_enabled: false });
    const params = Promise.resolve({ slug: "test" });
    await expect(MenuPage({ params, searchParams: Promise.resolve({ origem: "vitrine" }) })).rejects.toThrow("NOT_FOUND");
    await expect(MenuPage({ params, searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
});

test("enabled Vitrine forwards a read-only menu and cannot be changed to Mesa through query params", async () => {
    mockAddons = [{ product_key: "qr_code_mesa", status: "active", current_period_ends_at: null }];
    (getPublicMenuRestaurant as jest.Mock).mockResolvedValue({ ...restaurant, vitrine_enabled: true });
    const forwarded = await VitrinePage({ params: Promise.resolve({ slug: "test" }), searchParams: Promise.resolve({ p: "item", origem: "mesa", c: "COUPON" } as any) });
    expect(await forwarded.props.searchParams).toEqual({ p: "item", origem: "vitrine" });
    const result = await MenuPage(forwarded.props);
    const html = renderToStaticMarkup(result);
    expect(html).toContain("Somente visualização");
    expect(html).not.toContain("CART_CONTROL");
});

test.each(["qr_code_mesa", "ia_plus"])("Vitrine accepts an active %s subscription", async (product_key) => {
    mockAddons = [{ product_key, status: "active", current_period_ends_at: null }];
    (getPublicMenuRestaurant as jest.Mock).mockResolvedValue({ ...restaurant, vitrine_enabled: true });
    await expect(MenuPage({ params: Promise.resolve({ slug: "test" }), searchParams: Promise.resolve({ origem: "vitrine" }) })).resolves.toBeTruthy();
});

test("Vitrine requires subscription access even when enabled; delivery still renders", async () => {
    (getPublicMenuRestaurant as jest.Mock).mockResolvedValue({ ...restaurant, vitrine_enabled: true });
    const params = Promise.resolve({ slug: "test" });
    await expect(MenuPage({ params, searchParams: Promise.resolve({ origem: "vitrine" }) })).rejects.toThrow("NOT_FOUND");
    await expect(MenuPage({ params, searchParams: Promise.resolve({}) })).resolves.toBeTruthy();
});

test("Vitrine preserves access through the paid period and rejects expired access", async () => {
    (getPublicMenuRestaurant as jest.Mock).mockResolvedValue({ ...restaurant, vitrine_enabled: true });
    const props = { params: Promise.resolve({ slug: "test" }), searchParams: Promise.resolve({ origem: "vitrine" }) };
    mockAddons = [{ product_key: "ia_plus", status: "canceled", current_period_ends_at: new Date(Date.now() + 86400000).toISOString() }];
    await expect(MenuPage(props)).resolves.toBeTruthy();
    mockAddons[0].current_period_ends_at = new Date(Date.now() - 86400000).toISOString();
    await expect(MenuPage(props)).rejects.toThrow("NOT_FOUND");
});

test("Vitrine denies access when subscription lookup fails", async () => {
    (getPublicMenuRestaurant as jest.Mock).mockResolvedValue({ ...restaurant, vitrine_enabled: true });
    mockAddons = [{ product_key: "qr_code_mesa", status: "active", current_period_ends_at: null }];
    mockAddonError = new Error("Subscription lookup failed");
    await expect(MenuPage({ params: Promise.resolve({ slug: "test" }), searchParams: Promise.resolve({ origem: "vitrine" }) })).rejects.toThrow("NOT_FOUND");
});
