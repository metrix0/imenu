import type { PoolClient } from "pg";
import { MENU_EXAMPLE_IMAGES } from "@/lib/menu/itemImages";

const EXAMPLE_CATEGORY = "Bebidas";

export async function seedEmptyMenuExample(client: Pick<PoolClient, "query">, restaurantId: string): Promise<void> {
    const { rows: [existingItem] } = await client.query(
        "SELECT 1 FROM public.items WHERE restaurant_id = $1 LIMIT 1",
        [restaurantId],
    );
    if (existingItem) return;

    const { rows: [category] } = await client.query<{ id: string }>(
        "SELECT id FROM public.categories WHERE restaurant_id = $1 AND lower(btrim(name)) = lower($2) ORDER BY position, id LIMIT 1",
        [restaurantId, EXAMPLE_CATEGORY],
    );
    let categoryId = category?.id;
    if (!categoryId) {
        const { rows: [created] } = await client.query<{ id: string }>(
            "INSERT INTO public.categories (restaurant_id, name, position) VALUES ($1, $2, (SELECT COALESCE(MAX(position), -1) + 1 FROM public.categories WHERE restaurant_id = $1)) RETURNING id",
            [restaurantId, EXAMPLE_CATEGORY],
        );
        categoryId = created.id;
    }

    await client.query(
        "INSERT INTO public.items (restaurant_id, category_id, name, description, price_cents, image_path, is_available, position) VALUES ($1, $2, $3, $4, $5, $6, TRUE, 0)",
        [restaurantId, categoryId, "Coca-Cola 350 ml", "Coca-Cola Original em lata de 350 ml.", 600, MENU_EXAMPLE_IMAGES.cola],
    );
}
