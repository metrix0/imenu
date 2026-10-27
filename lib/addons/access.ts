import type { PoolClient } from "pg";
import { query } from "@/lib/database/sql";
import { hasQrTableAccess } from "@/lib/qr-table/types";

export async function hasIMenuPlusAccess(restaurantId: string, client?: Pick<PoolClient, "query">): Promise<boolean> {
    const sql = "SELECT status,current_period_ends_at FROM public.restaurant_addons WHERE restaurant_id=$1 AND product_key='ia_plus'";
    const result = client ? await client.query(sql, [restaurantId]) : await query(sql, [restaurantId]);
    return hasQrTableAccess(result.rows[0] || null);
}
