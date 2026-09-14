import type { PoolClient } from "pg";
import type { PizzaSelection } from "@/lib/types/types";
import { loadPizzaCatalog } from "./catalog";
import { isPizzaItem, parsePizzaSettings, PizzaPricingError, pricePizza } from "./pricing";

// Rebuild names, options, eligibility and prices from the catalog, not browser prices.
export async function pricePizzaOrderItems(client: Pick<PoolClient, "query">, restaurantId: string, settingsValue: unknown, items: any[]): Promise<any[]> {
    if (!items.some(item => item.pizza != null)) return items;
    const settings = parsePizzaSettings(settingsValue);
    const catalog = await loadPizzaCatalog(client, restaurantId, settings);
    return items.map(item => {
        if (item.pizza == null) return item;
        const selection = item.pizza as PizzaSelection;
        if (!settings.enabled || !Array.isArray(selection.flavors) || selection.flavors.length < 2 || selection.flavors.length > settings.max_flavors || selection.pricing_rule !== settings.pricing_rule || item.is_reward || item.automatic_promotion_id) throw new PizzaPricingError("A configuração da pizza mudou. Monte a pizza novamente.");
        if (!Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99 || !Array.isArray(item.selectedSubitems)) throw new PizzaPricingError("Pizza inválida.");
        const flavors = selection.flavors.map(flavor => {
            const product = catalog.find(p => p.id === flavor?.item_id);
            if (!product || !isPizzaItem(product, settings)) throw new PizzaPricingError("Um sabor não está mais disponível para combinação.");
            return product;
        });
        if (flavors[0].id !== (item.base_item_id || item.item_id)) throw new PizzaPricingError("Primeiro sabor inválido.");
        const priced = pricePizza(flavors, item.selectedSubitems, settings.pricing_rule);
        if (priced.unit_price_cents !== item.unit_price_cents || priced.unit_price_cents * item.qty !== item.total_cents) throw new PizzaPricingError("O preço da pizza mudou. Monte a pizza novamente para conferir o valor atualizado.");
        return { ...item, ...priced, total_cents: priced.unit_price_cents * item.qty, promotion: undefined };
    });
}
