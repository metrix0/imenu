import { NextResponse } from "next/server";
import { query } from "@/lib/sql";

export async function GET() {
    // Get categories and items ordered
    const { rows: categories } = await query(`
    SELECT c.id, c.name, c.position
    FROM categories c
    JOIN restaurants r ON r.id = c.restaurant_id
    ORDER BY c.position ASC, c.name ASC
  `);

    const { rows: items } = await query(`
    SELECT i.id, i.category_id, i.name, i.description, i.price_cents, i.image_path, i.is_available, i.position
    FROM items i
    ORDER BY i.position ASC, i.name ASC
  `);

    return NextResponse.json({ categories, items });
}
