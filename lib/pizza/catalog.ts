import type { PoolClient } from "pg";
import type { PizzaCatalogItem, PizzaSettings } from "@/lib/types/types";

export async function loadPizzaCatalog(client: Pick<PoolClient, "query">, restaurantId: string, settings: PizzaSettings): Promise<PizzaCatalogItem[]> {
    if (!settings.enabled || !settings.category_ids.length) return [];
    const { rows } = await client.query(`
        SELECT i.*, jsonb_build_object('id', c.id, 'name', c.name, 'position', c.position) AS category,
            (SELECT jsonb_build_object('type', p.type, 'value', p.value)
             FROM promotions p WHERE p.item_id = i.id AND p.starts_at <= NOW()
             AND (p.ends_at >= NOW() OR p.ends_at IS NULL) ORDER BY p.starts_at DESC LIMIT 1) AS promotion,
            COALESCE((SELECT jsonb_agg(g ORDER BY g.position, g.id) FROM (
                SELECT sc.*, COALESCE((SELECT jsonb_agg(s ORDER BY s.position, s.id)
                    FROM subitems s WHERE s.item_subcategory_id = sc.id), '[]'::jsonb) AS subitems
                FROM item_subcategories sc WHERE sc.item_id = i.id
            ) g), '[]'::jsonb) AS subcategories
        FROM items i JOIN categories c ON c.id = i.category_id AND c.restaurant_id = i.restaurant_id
        WHERE i.restaurant_id = $1 AND i.category_id = ANY($2::uuid[]) AND i.is_available = true
            AND (i.stock_enabled = false OR i.stock_enabled IS NULL OR i.stock_quantity > 0)
        ORDER BY c.position, i.position, i.id`, [restaurantId, settings.category_ids]);
    return rows;
}
