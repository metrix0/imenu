import type { PoolClient } from "pg";
import { parsePizzaSettings } from "@/lib/pizza/pricing";

type Category = { id: string; name: string };
type MenuItem = { name: string; category_id: string };
type DatabaseClient = Pick<PoolClient, "query">;

const EXAMPLE_CATEGORY = "Pizzas de Exemplo";
const EXAMPLE_ITEM = "Pizza de Exemplo";

const normalized = (value: string | null | undefined) =>
    (value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim().toLowerCase();

const isPizzaCategory = (name: string) => {
    const value = normalized(name);
    return /\bpizz/.test(value) && !/sushi|brownie|acai|tapioca|pastel|pao|mini|congelad/.test(value)
        && value !== normalized(EXAMPLE_CATEGORY);
};

const isPizzaProduct = (name: string) => {
    const value = normalized(name);
    return /^pizzas?\s/.test(value) && !/sushi|brownie|acai|tapioca|pastel|mini|congelad/.test(value)
        && value !== normalized(EXAMPLE_ITEM);
};

// "Calabresa" alone is not evidence: it is common in burgers, pastels and other foods.
export function isLikelyPizzeria(restaurantName: string | null, categories: Category[], items: MenuItem[]): boolean {
    const name = normalized(restaurantName);
    if (/\bpizz/.test(name) && !/sushi pizza|pizza brownie|acai pizza/.test(name)) return true;

    const pizzaCategories = new Set(categories.filter(category => isPizzaCategory(category.name)).map(category => category.id));
    const categoryProducts = items.filter(item => pizzaCategories.has(item.category_id)).length;
    if (categoryProducts >= 3 && categoryProducts / items.length >= 0.1) return true;

    return items.filter(item => isPizzaProduct(item.name)).length >= 3;
}

export async function seedPizzaExample(
    client: DatabaseClient,
    restaurantId: string,
    restaurantName: string | null,
    rawPizzaSettings: unknown,
): Promise<void> {
    const categoryResult = await client.query<Category>(
        "SELECT id, name FROM public.categories WHERE restaurant_id = $1 ORDER BY position, id",
        [restaurantId],
    );
    const itemResult = await client.query<MenuItem>(
        "SELECT name, category_id FROM public.items WHERE restaurant_id = $1",
        [restaurantId],
    );

    if (!isLikelyPizzeria(restaurantName, categoryResult.rows, itemResult.rows)) return;

    const existingCategory = categoryResult.rows.find(category => normalized(category.name) === normalized(EXAMPLE_CATEGORY));
    let categoryId = existingCategory?.id;
    if (!categoryId) {
        const result = await client.query<{ id: string }>(
            "INSERT INTO public.categories (restaurant_id, name, position) VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM public.categories WHERE restaurant_id = $1)) RETURNING id",
            [restaurantId, EXAMPLE_CATEGORY],
        );
        categoryId = result.rows[0].id;
    }

    const existingItem = await client.query<{ id: string }>(
        "SELECT id FROM public.items WHERE restaurant_id = $1 AND category_id = $2 AND lower(name) = lower($3) LIMIT 1",
        [restaurantId, categoryId, EXAMPLE_ITEM],
    );

    if (!existingItem.rows.length) {
        const item = await client.query<{ id: string }>(
            "INSERT INTO public.items (restaurant_id, category_id, name, description, price_cents, is_available, position) VALUES ($1, $2, $3, $4, 3000, FALSE, 0) RETURNING id",
            [restaurantId, categoryId, EXAMPLE_ITEM, "Exemplo desativado: edite os tamanhos, as bordas e os preços antes de disponibilizar esta pizza."],
        );
        const itemId = item.rows[0].id;
        const groups = await client.query<{ id: string; name: string }>(
            "INSERT INTO public.item_subcategories (item_id, name, min_select, max_select, position) VALUES ($1, 'Tamanho', 1, 1, 0), ($1, 'Borda', 1, 1, 1) RETURNING id, name",
            [itemId],
        );
        const size = groups.rows.find(group => group.name === "Tamanho");
        const crust = groups.rows.find(group => group.name === "Borda");
        if (!size || !crust) throw new Error("Falha ao criar complementos da pizza de exemplo.");

        await client.query(
            "INSERT INTO public.subitems (item_subcategory_id, name, price_cents, position) VALUES ($1, 'Broto (4 fatias)', 0, 0), ($1, 'Média (6 fatias)', 1500, 1), ($1, 'Grande (8 fatias)', 2500, 2)",
            [size.id],
        );
        await client.query(
            "INSERT INTO public.subitems (item_subcategory_id, name, price_cents, position) VALUES ($1, 'Sem borda', 0, 0), ($1, 'Catupiry', 800, 1), ($1, 'Cheddar', 800, 2)",
            [crust.id],
        );
    }

    const settings = parsePizzaSettings(rawPizzaSettings);
    await client.query(
        "UPDATE public.restaurants SET pizza_settings = $2::jsonb, updated_at = NOW() WHERE id = $1",
        [restaurantId, JSON.stringify({
            ...settings,
            enabled: true,
            pricing_rule: "highest",
            max_flavors: 2,
            category_ids: [...new Set([...settings.category_ids, categoryId])],
        })],
    );
}
