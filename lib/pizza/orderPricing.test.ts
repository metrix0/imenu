import { pricePizzaOrderItems } from "./orderPricing";
import { loadPizzaCatalog } from "./catalog";
jest.mock("./catalog", () => ({ loadPizzaCatalog: jest.fn() }));
const settings = { enabled: true, pricing_rule: "average", max_flavors: 3, category_ids: ["pizza", "sweet"] };
const catalog = [
    { id: "a", name: "Portuguesa", price_cents: 5000, category_id: "pizza", subcategories: [], is_available: true },
    { id: "b", name: "Chocolate", price_cents: 6000, category_id: "sweet", subcategories: [], is_available: true },
];
const item = { base_item_id: "a", qty: 2, unit_price_cents: 5500, total_cents: 11000, selectedSubitems: [], name: "forged", pizza: { pricing_rule: "average", flavors: [{ item_id: "a", price_cents: 1 }, { item_id: "b", price_cents: 1 }] } };
const client = { query: jest.fn() } as any;
beforeEach(() => { (loadPizzaCatalog as jest.Mock).mockResolvedValue(catalog); });
it("rebuilds flavor prices and names from catalog before checkout", async () => {
    const [priced] = await pricePizzaOrderItems(client, "restaurant", settings, [{ ...item, promotion: { type: "percent", value: 100 } }]);
    expect(priced.name).toBe("1/2 Portuguesa + 1/2 Chocolate");
    expect(priced.total_cents).toBe(11000);
    expect(priced.promotion).toBeUndefined();
    expect(priced.pizza.flavors.map((f: any) => f.price_cents)).toEqual([5000, 6000]);
});
it.each([
    { ...item, unit_price_cents: 1, total_cents: 2 },
    { ...item, base_item_id: "b" },
    { ...item, qty: 1.5 },
    { ...item, is_reward: true },
    { ...item, pizza: { ...item.pizza, flavors: [{ item_id: "a" }, { item_id: "another-restaurant" }] } },
    { ...item, pizza: { ...item.pizza, flavors: [{ item_id: "a" }] } },
    { ...item, pizza: { ...item.pizza, flavors: Array(4).fill({ item_id: "a" }) } },
])("rejects altered prices, identity, quantity, rewards or eligibility", async invalid => {
    await expect(pricePizzaOrderItems(client, "restaurant", settings, [invalid])).rejects.toThrow();
});
it("rejects changed rules or disabled mode", async () => {
    await expect(pricePizzaOrderItems(client, "restaurant", { ...settings, enabled: false }, [item])).rejects.toThrow();
    await expect(pricePizzaOrderItems(client, "restaurant", { ...settings, pricing_rule: "highest" }, [item])).rejects.toThrow();
});
it("preserves ordinary products without querying the catalog", async () => {
    jest.clearAllMocks();
    const ordinary = [{ base_item_id: "a", qty: 1 }];
    expect(await pricePizzaOrderItems(client, "restaurant", null, ordinary)).toBe(ordinary);
    expect(loadPizzaCatalog).not.toHaveBeenCalled();
});
