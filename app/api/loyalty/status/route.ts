import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/database/sql";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_id, phone } = body;

    if (!restaurant_id || !phone) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    // 1. Sanitização básica do telefone (remove caracteres não numéricos para busca)
    // Nota: O ideal é garantir que o front já mande limpo ou formatado, 
    // mas aqui garantimos consistência na busca.
    const cleanPhone = phone.replace(/\D/g, "");

    // Buscamos duas coisas em paralelo: O saldo e os últimos pedidos
    
    // Query A: Saldo de Fidelidade
    const balanceQuery = `
        SELECT * FROM loyalty_balances 
        WHERE restaurant_id = $1 AND customer_phone = $2
    `;

    // Query B: Histórico de Pedidos (Últimos 10)
    // Trazemos apenas campos relevantes para exibir no histórico simplificado
    const ordersQuery = `
        SELECT 
            id, 
            display_id, 
            status, 
            total_cents, 
            created_at, 
            loyalty_credited 
        FROM orders 
        WHERE restaurant_id = $1 
          AND customer_phone = $2 
        ORDER BY created_at DESC 
        LIMIT 10
    `;

    const programQuery = `SELECT goal_count, reward_description, active FROM loyalty_programs WHERE restaurant_id = $1`;

    // Executa queries usando o Pool
    const [balanceRes, ordersRes, programRes] = await Promise.all([
        query(balanceQuery, [restaurant_id, cleanPhone]),
        query(ordersQuery, [restaurant_id, cleanPhone]),
        query(programQuery, [restaurant_id])
    ]);

    // Se não tiver programa ativo ou configurado, avisa o front
    const program = programRes.rows[0] || null;

    // Monta a resposta
    return NextResponse.json({
      balance: balanceRes.rows.length > 0 ? balanceRes.rows[0] : null,
      orders: ordersRes.rows,
      program: program // Enviando as regras junto
    }, { status: 200 });

  } catch (error) {
    console.error("Error fetching loyalty status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}