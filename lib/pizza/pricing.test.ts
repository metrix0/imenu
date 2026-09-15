import type { CartItem, PizzaCatalogItem, Subcategory } from "@/lib/types/types";
import { isPizzaItem, matchPizzaComplements, parsePizzaSettings, pizzaStockItemIds, pricePizza } from "./pricing";
import { evaluateAutomaticPromotions } from "@/lib/promotions/automatic";

const group = (item: string, large: number): Subcategory => ({
    id: `${item}-size`, item_id: item, name: "Tamanho", description: null, min_select: 1, max_select: 1, allow_multiple_units: false, position: 0,
    subitems: [
        { id: `${item}-small`, item_subcategory_id: `${item}-size`, name: "Broto", description: null, is_available: true, position: 1, price_cents: 500 },
        { id: `${item}-large`, item_subcategory_id: `${item}-size`, name: "Grande", description: null, is_available: true, position: 0, price_cents: large },
    ],
});
const flavor = (id: string, base: number, large: number): PizzaCatalogItem => ({
    id, name: id, price_cents: base, description: null, image_path: null, is_available: true, position: 0, category_id: id === "Doce" ? "sweet" : "pizza", subcategories: [group(id, large)],
});
const first = flavor("Portuguesa", 3000, 2000);
const second = flavor("Calabresa", 3500, 3000);
const choice: CartItem["selectedSubitems"] = [{ subcategoryId: "Portuguesa-size", subcategoryName: "Tamanho", subitemId: "Portuguesa-large", subitemName: "Grande", price_cents: 2000 }];

it("uses each flavor's LARGE price, not its cheapest size, for both rules", () => {
    expect(pricePizza([first, second], choice, "average").unit_price_cents).toBe(5750);
    expect(pricePizza([first, second], choice, "highest").unit_price_cents).toBe(6500);
});
it("preserves one complement selection and labels every equal portion", () => {
    const quote = pricePizza([first, second], choice, "highest");
    expect(quote.name).toBe("1/2 Portuguesa + 1/2 Calabresa");
    expect(quote.selectedSubitems).toHaveLength(1);
    expect(quote.pizza.flavors.map(f => f.price_cents)).toEqual([5000, 6500]);
});
it("supports cross-category flavors, three/four parts and final cent rounding", () => {
    const sweet = flavor("Doce", 4001, 1000);
    expect(pricePizza([first, second, sweet], choice, "average").unit_price_cents).toBe(5500);
    expect(pricePizza([first, second, sweet, sweet], choice, "average").unit_price_cents).toBe(5376);
    const settings = parsePizzaSettings({ enabled: true, max_flavors: 4, category_ids: ["pizza", "sweet"] });
    expect(isPizzaItem(sweet, settings)).toBe(true);
    expect(isPizzaItem({ ...sweet, category_id: "drinks" }, settings)).toBe(false);
});
it("blocks cross-category flavors when same-category mode is enabled", () => {
    const sweet = { ...flavor("Doce", 4001, 1000), pizza_same_category_only: true };
    expect(() => pricePizza([first, sweet], choice, "average")).toThrow("mesma categoria");
    expect(pricePizza([first, { ...second, pizza_same_category_only: true }], choice, "average").unit_price_cents).toBe(5750);
});
it("matches names rather than display order; rejects missing, ambiguous or unavailable sizes", () => {
    const target = structuredClone(second);
    target.subcategories[0].subitems.reverse();
    expect(pricePizza([first, target], choice, "average").unit_price_cents).toBe(5750);
    target.subcategories[0].subitems.find(s => s.name === "Grande")!.is_available = false;
    expect(() => pricePizza([first, target], choice, "average")).toThrow("Grande");
    target.subcategories[0].subitems = [second.subcategories[0].subitems[0]];
    expect(() => pricePizza([first, target], choice, "average")).toThrow("Grande");
    target.subcategories = [group("one", 2000), group("two", 4000)];
    expect(() => pricePizza([first, target], choice, "average")).toThrow("Tamanho");
});
it("keeps quantities across multiple groups and enforces target limits", () => {
    const base = structuredClone(first); const target = structuredClone(second);
    for (const item of [base, target]) item.subcategories.push({ ...group(`${item.id}-extra`, item.id === first.id ? 100 : 200), name: "Extras", min_select: 0, max_select: 3, allow_multiple_units: true });
    const extras = { subcategoryId: "Portuguesa-extra-size", subcategoryName: "Extras", subitemId: "Portuguesa-extra-large", subitemName: "Grande", price_cents: 100, quantity: 2 };
    expect(pricePizza([base, target], [...choice, extras], "average").unit_price_cents).toBe(6050);
    target.subcategories[1].max_select = 1;
    expect(() => pricePizza([base, target], [...choice, extras], "average")).toThrow("Extras");
});
it("validates mandatory groups, duplicate selections and unavailable flavors", () => {
    expect(() => pricePizza([first, second], [], "average")).toThrow("Tamanho");
    expect(() => pricePizza([first, second], [...choice, ...choice], "average")).toThrow("Quantidade");
    expect(() => pricePizza([first, { ...second, is_available: false }], choice, "average")).toThrow("disponível");
    expect(() => matchPizzaComplements([{ ...choice[0], quantity: 0 }], first.subcategories, true)).toThrow();
});
it("applies each flavor's own promotion once, including free prices", () => {
    const promotional = { ...second, promotion: { type: "percent", value: 20 } as PizzaCatalogItem["promotion"] };
    expect(pricePizza([first, promotional], choice, "average").unit_price_cents).toBe(5100);
    const free = { ...second, promotion: { type: "fixed", value: 10000 } as PizzaCatalogItem["promotion"] };
    expect(pricePizza([first, free], choice, "average").unit_price_cents).toBe(2500);
});
it("reserves each distinct flavor once even when repeated in two portions", () => {
    const quote = pricePizza([first, second, second], choice, "average");
    expect(pizzaStockItemIds({ base_item_id: first.id, pizza: quote.pizza })).toEqual([first.id, second.id]);
});
it("defaults to disabled, two flavors, highest price and cross-category combinations", () => {
    expect(parsePizzaSettings(undefined)).toEqual({ enabled: false, pricing_rule: "highest", max_flavors: 2, category_ids: [], same_category_only: false });
});
it("does not qualify half a flavor as a whole product for automatic offers", () => {
    const a = "10000000-0000-4000-8000-000000000001", b = "10000000-0000-4000-8000-000000000002";
    const offer = { id: "20000000-0000-4000-8000-000000000001", name: "Oferta", active: true, show_on_menu: true, delivery: true, mesa: true, allow_coupon: false, rules: [{ type: "product" as const, item_id: a, quantity: 1 }], benefits: [{ type: "fixed" as const, cents: 500 }] };
    const line = { base_item_id: a, qty: 1, unit_price_cents: 5750, total_cents: 5750, pizza: { pricing_rule: "average" as const, flavors: [{ item_id: a, name: "A", price_cents: 5000 }, { item_id: b, name: "B", price_cents: 6500 }] } };
    const input = { items: [line], products: [{ id: a, name: "A", price_cents: 5000, is_available: true }], subtotal_cents: 5750, delivery_cents: 0, coupon_discount_cents: 0, channel: "delivery" as const, at: new Date() };
    expect(evaluateAutomaticPromotions([offer], input).promotion).toBeNull();
    expect(evaluateAutomaticPromotions([offer], { ...input, items: [{ ...line, qty: 2, total_cents: 11500 }], subtotal_cents: 11500 }).promotion?.id).toBe(offer.id);
});
