import type { CartItem, Item, PizzaCatalogItem, PizzaSelection, PizzaSettings, Subcategory } from "@/lib/types/types";

export const DEFAULT_PIZZA_SETTINGS: PizzaSettings = {
    enabled: false, pricing_rule: "highest", max_flavors: 2, category_ids: [],
};
export const MAX_PIZZA_FLAVORS = 8;
export class PizzaPricingError extends Error {}

export function parsePizzaSettings(value: unknown): PizzaSettings {
    const v = value && typeof value === "object" ? value as Partial<PizzaSettings> : {};
    return {
        enabled: v.enabled === true,
        pricing_rule: v.pricing_rule === "average" ? "average" : "highest",
        max_flavors: Number.isInteger(v.max_flavors) && Number(v.max_flavors) >= 2 && Number(v.max_flavors) <= MAX_PIZZA_FLAVORS ? Number(v.max_flavors) : 2,
        category_ids: Array.isArray(v.category_ids) ? [...new Set(v.category_ids.filter(id => typeof id === "string"))] : [],
    };
}

export function isPizzaItem(item: Item, settings: PizzaSettings): boolean {
    return settings.enabled && settings.category_ids.includes(item.category_id || item.category?.id || "");
}

const normalized = (name: string) => name.trim().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

// IDs belong to individual products. Match unique group/option names, never their
// display positions: changing the order must not turn a large pizza into a small one.
export function matchPizzaComplements(source: CartItem["selectedSubitems"], groups: Subcategory[], firstFlavor = false): CartItem["selectedSubitems"] {
    const seen = new Set<string>();
    const selections = source.map(selected => {
        if (!selected || typeof selected.subcategoryId !== "string" || typeof selected.subitemId !== "string" || typeof selected.subcategoryName !== "string" || typeof selected.subitemName !== "string") throw new PizzaPricingError("Complemento inválido.");
        const matches = groups.filter(g => firstFlavor ? g.id === selected.subcategoryId : normalized(g.name) === normalized(selected.subcategoryName));
        if (matches.length !== 1) throw new PizzaPricingError(`Este sabor não tem o grupo ${selected.subcategoryName} compatível.`);
        const group = matches[0];
        const options = group.subitems.filter(s => (firstFlavor ? s.id === selected.subitemId : normalized(s.name) === normalized(selected.subitemName)) && s.is_available);
        if (options.length !== 1) throw new PizzaPricingError(`Este sabor não tem a opção ${selected.subitemName} disponível.`);
        const option = options[0];
        const quantity = selected.quantity ?? 1;
        if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99 || (!group.allow_multiple_units && quantity !== 1) || seen.has(option.id)) throw new PizzaPricingError("Quantidade de complemento inválida.");
        seen.add(option.id);
        return { subcategoryId: group.id, subcategoryName: group.name, subitemId: option.id, subitemName: option.name, price_cents: Number(option.price_cents), quantity };
    });
    for (const group of groups) {
        const count = selections.filter(s => s.subcategoryId === group.id).reduce((sum, s) => sum + (s.quantity ?? 1), 0);
        if (count < group.min_select || (group.max_select > 0 && count > group.max_select)) throw new PizzaPricingError(`As opções escolhidas não atendem ao grupo ${group.name} deste sabor.`);
    }
    return selections;
}

export function pricePizza(flavors: PizzaCatalogItem[], selected: CartItem["selectedSubitems"], rule: PizzaSettings["pricing_rule"]): { pizza: PizzaSelection; unit_price_cents: number; name: string; selectedSubitems: CartItem["selectedSubitems"] } {
    if (flavors.length < 2 || flavors.length > MAX_PIZZA_FLAVORS) throw new PizzaPricingError("Quantidade de sabores inválida.");
    const canonical = matchPizzaComplements(selected, flavors[0].subcategories, true);
    const snapshots = flavors.map((flavor, index) => {
        if (!flavor.is_available) throw new PizzaPricingError(`${flavor.name} não está disponível.`);
        const complements = index === 0 ? canonical : matchPizzaComplements(canonical, flavor.subcategories);
        let price = Number(flavor.price_cents) + complements.reduce((sum, s) => sum + s.price_cents * (s.quantity ?? 1), 0);
        const promo = flavor.promotion;
        if (promo && promo.value > 0) price = promo.type === "percent" ? Math.round(price * (1 - promo.value / 100)) : price - promo.value;
        price = Math.max(0, price);
        if (!Number.isSafeInteger(price)) throw new PizzaPricingError("Preço do sabor inválido.");
        return { item_id: flavor.id, name: flavor.name, price_cents: price };
    });
    const prices = snapshots.map(s => s.price_cents);
    const unit_price_cents = rule === "average" ? Math.round(prices.reduce((a, b) => a + b, 0) / prices.length) : Math.max(...prices);
    return { pizza: { pricing_rule: rule, flavors: snapshots }, unit_price_cents, name: snapshots.map(s => `1/${snapshots.length} ${s.name}`).join(" + "), selectedSubitems: canonical };
}

export function pizzaStockItemIds(item: { item_id?: string; base_item_id?: string; pizza?: PizzaSelection }): string[] {
    return item.pizza ? [...new Set(item.pizza.flavors.map(f => f.item_id))] : [String(item.item_id || item.base_item_id || "")];
}
