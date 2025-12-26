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

// POST: Cria ou Atualiza (Upsert) a configuração
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_id, goal_count, reward_description, active } = body;

    if (!restaurant_id) {
      return NextResponse.json({ error: "Restaurant ID required" }, { status: 400 });
    }

    // Upsert (Insert ou Update se já existir para este restaurante)
    const sql = `
      INSERT INTO loyalty_programs (restaurant_id, goal_count, reward_description, active, updated_at)
      VALUES ($1, $2, $3, $4, NOW())
      ON CONFLICT (restaurant_id) 
      DO UPDATE SET
        goal_count = EXCLUDED.goal_count,
        reward_description = EXCLUDED.reward_description,
        active = EXCLUDED.active,
        updated_at = NOW()
      RETURNING *;
    `;

    const result = await query(sql, [
      restaurant_id,
      goal_count || 10, // default
      reward_description || "",
      active ?? false,
    ]);

    return NextResponse.json(result.rows[0], { status: 200 });
  } catch (error) {
    console.error("Error saving loyalty config:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}