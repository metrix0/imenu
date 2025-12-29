import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { jwtVerify } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "segredo_super_seguro_troque_isso");


export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { restaurant_id } = body;

    // 🔒 1. VERIFICAÇÃO DE SEGURANÇA (COOKIE)
    const cookieStore = await cookies();
    const token = cookieStore.get("loyalty_token")?.value;

    if (!token) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    let verifiedPhone = "";
    try {
        const { payload } = await jwtVerify(token, SECRET);
        verifiedPhone = payload.phone as string;
    } catch (e) {
        return NextResponse.json({ error: "Invalid Token" }, { status: 401 });
    }

    // O telefone agora vem do token, garantido que é o dono
    const cleanPhone = verifiedPhone;



    if (!restaurant_id) return NextResponse.json({ error: "Missing data" }, { status: 400 });



    // 1. Saldo
    const balanceQuery = `SELECT * FROM loyalty_balances WHERE restaurant_id = $1 AND customer_phone = $2`;
    
    // 2. Histórico
    const ordersQuery = `
        SELECT id, display_id, status, total_cents, created_at, loyalty_credited, loyalty_points_used 
        FROM orders 
        WHERE restaurant_id = $1 AND customer_phone = $2 
        ORDER BY created_at DESC LIMIT 10
    `;

    // 3. Regras + DETALHES DO ITEM DE RECOMPENSA
    // ✅ CORREÇÃO: O banco usa 'image_path', não 'image_url'.
    // Trazemos como 'reward_item_image_path' para processar no código abaixo.
    const programQuery = `
        SELECT 
            p.*,
            i.name as reward_item_name,
            i.image_path as reward_item_image_path
        FROM loyalty_programs p
        LEFT JOIN items i ON p.reward_item_id = i.id
        WHERE p.restaurant_id = $1
    `;

    const [balanceRes, ordersRes, programRes] = await Promise.all([
        query(balanceQuery, [restaurant_id, cleanPhone]),
        query(ordersQuery, [restaurant_id, cleanPhone]),
        query(programQuery, [restaurant_id])
    ]);

    const program = programRes.rows[0] || null;

    // ✅ GERA A URL COMPLETA DA IMAGEM
    // Se o banco retornou um caminho (ex: "folder/img.jpg"), criamos a URL completa aqui
    if (program && program.reward_item_image_path) {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        // Cria a propriedade 'reward_item_image' que o Frontend espera
        program.reward_item_image = `${supabaseUrl}/storage/v1/object/public/menu-images/${program.reward_item_image_path}`;
    }

    // 4. Se tiver recompensa configurada, buscar os nomes dos Subitens Inclusos
    let rewardDetails = null;
    if (program && program.reward_subitem_ids && program.reward_subitem_ids.length > 0) {
        const ids = Array.isArray(program.reward_subitem_ids) ? program.reward_subitem_ids : [];
        
        if (ids.length > 0) {
            const subSql = `
                SELECT 
                    s.id as subitem_id, 
                    s.name as subitem_name, 
                    sc.id as subcategory_id, 
                    sc.name as subcategory_name
                FROM subitems s
                JOIN item_subcategories sc ON s.item_subcategory_id = sc.id
                WHERE s.id = ANY($1)
            `;
            const { rows: subs } = await query(subSql, [ids]);
            rewardDetails = subs;
        }
    }

    return NextResponse.json({
      balance: balanceRes.rows.length > 0 ? balanceRes.rows[0] : null,
      orders: ordersRes.rows,
      program: {
          ...program,
          expanded_reward_subitems: rewardDetails
      }
    }, { status: 200 });

  } catch (error) {
    console.error("Error fetching loyalty status:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}