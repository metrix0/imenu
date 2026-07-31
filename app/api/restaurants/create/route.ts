import { query } from "@/lib/database/sql";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export async function POST(request: Request) {
    try {
        const { userId, phone } = await request.json();
        if (!userId) return NextResponse.json({ error: "User ID is required." }, { status: 400 });
        const existing = await query("SELECT id FROM public.restaurants WHERE user_id = $1 LIMIT 1", [userId]);
        if (existing.rows[0]) return NextResponse.json({ id: existing.rows[0].id });
        const result = await query(`INSERT INTO public.restaurants (user_id, phone, rating, min_order_cents, balance_cents, delivery_fee_json, availability_json, prep_time_min_minutes, prep_time_max_minutes, prep_time_source, created_at, updated_at, first_time, creation_step) VALUES ($1, $2, 5.0, 1500, 0, '[]'::jsonb, '{}'::jsonb, 40, 50, 'manual', NOW(), NOW(), TRUE, 1) RETURNING id`, [userId, phone]);
        const id = result.rows[0]?.id;
        if (!id) throw new Error("Falha ao criar restaurante.");
        await query("INSERT INTO public.menu (restaurant_id, name, is_active, created_at, updated_at) VALUES ($1, 'Cardápio Principal', TRUE, NOW(), NOW())", [id]);
        return NextResponse.json({ id });
    } catch (error) { console.error("[CREATE_RESTAURANT]", error); return NextResponse.json({ error: "Erro interno do servidor" }, { status: 500 }); }
}
