import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/database/sql";

// GET: Busca a configuração atual do programa de fidelidade
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const restaurant_id = searchParams.get("restaurant_id");

  if (!restaurant_id) {
    return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 });
  }

  try {
    const result = await query(
      "SELECT * FROM loyalty_programs WHERE restaurant_id = $1",
      [restaurant_id]
    );

    if (result.rows.length === 0) {
      // Retorna 404 ou null para o front tratar como "não configurado"
      return NextResponse.json(null, { status: 200 }); 
    }

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error fetching loyalty config:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { 
        restaurant_id, 
        goal_count, 
        reward_description, 
        active, 
        min_order_value_cents,
        reward_item_id,      
        reward_subitem_ids    // <--- NOVO
    } = body;

    if (!restaurant_id) return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 });

    // Garante que é um array para o JSONB
    const safeSubitems = Array.isArray(reward_subitem_ids) ? JSON.stringify(reward_subitem_ids) : '[]';

    const sql = `
      INSERT INTO loyalty_programs (
          restaurant_id, goal_count, reward_description, active, min_order_value_cents, 
          reward_item_id, reward_subitem_ids, updated_at
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, NOW())
      ON CONFLICT (restaurant_id) 
      DO UPDATE SET
        goal_count = EXCLUDED.goal_count,
        reward_description = EXCLUDED.reward_description,
        active = EXCLUDED.active,
        min_order_value_cents = EXCLUDED.min_order_value_cents,
        reward_item_id = EXCLUDED.reward_item_id,
        reward_subitem_ids = EXCLUDED.reward_subitem_ids,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await query(sql, [
      restaurant_id,
      goal_count || 10,
      reward_description || "",
      active ?? false,
      min_order_value_cents || 0,
      reward_item_id || null, 
      safeSubitems // <--- Salva o array de IDs
    ]);

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error saving loyalty config:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}