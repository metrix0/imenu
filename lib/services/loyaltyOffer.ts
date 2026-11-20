import { query } from "@/lib/database/sql";
import { isMenuExampleImage } from "@/lib/menu/itemImages";
import type { LoyaltyOffer, LoyaltyRewardSelection } from "@/lib/types/types";

export async function loadLoyaltyOffer(restaurantId: string): Promise<LoyaltyOffer | null> {
    const { rows } = await query(
        `SELECT active, goal_count, min_order_value_cents, reward_item_id, reward_subitem_ids,
                to_jsonb(program)->'additional_rewards' AS additional_rewards
         FROM loyalty_programs program WHERE restaurant_id = $1 LIMIT 1`,
        [restaurantId]
    );
    const program = rows[0];
    if (!program?.active || program.goal_count <= 0) return null;

    const selections: LoyaltyRewardSelection[] = [
        ...(program.reward_item_id ? [{ item_id: program.reward_item_id, subitem_ids: program.reward_subitem_ids ?? [] }] : []),
        ...(program.additional_rewards ?? []),
    ];
    if (!selections.length) return null;

    const [items, subitems] = await Promise.all([
        query(`SELECT id, name, image_path, is_available FROM items
               WHERE restaurant_id = $1 AND id::text = ANY($2::text[])`,
        [restaurantId, selections.map(item => item.item_id)]),
        query(`SELECT s.id, s.name, g.id AS group_id, g.name AS group_name, g.item_id
               FROM subitems s JOIN item_subcategories g ON s.item_subcategory_id = g.id
               WHERE s.id::text = ANY($1::text[]) ORDER BY g.position, s.position`,
        [selections.flatMap(item => item.subitem_ids)]),
    ]);
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const rewards = selections.flatMap(selection => {
        const item = items.rows.find(row => row.id === selection.item_id);
        if (!item) return [];
        const path = item.image_path;
        const image = path && isMenuExampleImage(path) ? path
            : path && supabaseUrl ? `${supabaseUrl}/storage/v1/object/public/menu-images/${path}` : null;
        const complements = subitems.rows.filter(row => row.item_id === item.id && selection.subitem_ids.includes(row.id))
            .map(row => ({ subcategoryId: row.group_id, subcategoryName: row.group_name,
                subitemId: row.id, subitemName: row.name, price_cents: 0 }));
        return [{ id: item.id, name: item.name, image, complements }];
    });
    return {
        active: true,
        goal_count: program.goal_count,
        min_order_value_cents: Number(program.min_order_value_cents) || 0,
        rewards,
        reward_unavailable: rewards.length !== selections.length ||
            items.rows.some(item => item.is_available === false),
    };
}
