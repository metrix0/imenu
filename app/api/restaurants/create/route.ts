import { query } from "@/lib/sql";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const { userId, phone, email } = body;

        // Validação simples
        if (!userId) {
            return NextResponse.json(
                { error: "User ID is required to create a restaurant." },
                { status: 400 }
            );
        }

        // 1. Inserir Restaurante com dados default
        const insertRestaurantText = `
            INSERT INTO public.restaurants (
                user_id, 
                phone, 
                rating, 
                min_order_cents, 
                balance_cents, 
                delivery_fee_json, 
                availability_json,
                prep_time_min_minutes,
                prep_time_max_minutes,
                created_at, 
                updated_at,
                first_time
            )
            VALUES ($1, $2, 5.0, 1500, 0, '[]'::jsonb, '{}'::jsonb, 40, 50, NOW(), NOW(), TRUE) 
            RETURNING id;
        `;

        const { rows: restaurantRows } = await query(insertRestaurantText, [userId, phone]);

        if (!restaurantRows || restaurantRows.length === 0) {
            throw new Error("Falha ao criar o restaurante no banco de dados.");
        }

        const newRestaurantId = restaurantRows[0].id;

        // 2. Inserir Menu Default (Necessário para o painel não abrir vazio)
        const insertMenuText = `
            INSERT INTO public.menu (
                restaurant_id, 
                name, 
                is_active, 
                created_at, 
                updated_at
            )
            VALUES ($1, 'Cardápio Principal', true, NOW(), NOW());
        `;

        await query(insertMenuText, [newRestaurantId]);

        // Retorna o ID para o frontend salvar no Zustand (Store RestaurantId)
        return NextResponse.json({ id: newRestaurantId });

    } catch (error) {
        console.error("Erro ao criar restaurante:", error);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}