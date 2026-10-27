export type ScannedPizzaOption = { name: string; price_cents: number | null };

export type ScannedPizzaFields = {
    is_pizza_flavor?: boolean;
    price_cents: number | null;
    pizza_sizes?: ScannedPizzaOption[];
    pizza_crusts?: ScannedPizzaOption[];
};

export type ScannedPizzaComplement = {
    name: "Tamanho" | "Borda";
    min_select: number;
    max_select: number;
    options: Array<{ name: string; price_cents: number }>;
};

const normalize = (value: string) =>
    value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().replace(/\s+/g, " ").toLocaleLowerCase("pt-BR");

function pricedOptions(options?: ScannedPizzaOption[]) {
    const seen = new Set<string>();
    return (Array.isArray(options) ? options : []).filter((option) => {
        if (!option || typeof option.name !== "string" || !option.name.trim()
            || !Number.isSafeInteger(option.price_cents) || Number(option.price_cents) < 0) return false;
        const key = normalize(option.name);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
    }).map(option => ({ name: option.name.trim(), price_cents: Number(option.price_cents) }));
}

export function prepareScannedPizza(item: ScannedPizzaFields): {
    price_cents: number;
    complements: ScannedPizzaComplement[];
} {
    const basePrice = Number.isSafeInteger(item.price_cents) && Number(item.price_cents) >= 0
        ? Number(item.price_cents) : 0;
    if (item.is_pizza_flavor !== true) return { price_cents: basePrice, complements: [] };

    const complements: ScannedPizzaComplement[] = [];
    const sizes = pricedOptions(item.pizza_sizes);
    // A missing price is not a free size. Avoid creating an incomplete selection group.
    const sizesComplete = sizes.length > 1 && sizes.length === item.pizza_sizes?.length;
    const price_cents = sizesComplete ? Math.min(...sizes.map(size => size.price_cents)) : basePrice;
    if (sizesComplete) {
        complements.push({
            name: "Tamanho", min_select: 1, max_select: 1,
            options: sizes.map(size => ({
                name: size.name,
                price_cents: size.price_cents - price_cents,
            })),
        });
    }

    const crusts = pricedOptions(item.pizza_crusts);
    if (crusts.length && crusts.length === item.pizza_crusts?.length) {
        complements.push({
            name: "Borda", min_select: 0, max_select: 1,
            options: crusts,
        });
    }

    return { price_cents, complements };
}

export function arePizzaFlavorsCompatible(items: ScannedPizzaFields[]): boolean {
    if (items.length < 2 || items.some(item => item.is_pizza_flavor !== true)) return false;
    const signature = (item: ScannedPizzaFields) => JSON.stringify(
        prepareScannedPizza(item).complements.map(group => ({
            name: group.name,
            options: group.options.map(option => normalize(option.name)).sort(),
        })).sort((a, b) => a.name.localeCompare(b.name))
    );
    const first = signature(items[0]);
    return items.every(item => signature(item) === first);
}
