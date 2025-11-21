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

        // Inserimos o restaurante já com o user_id, phone e a data de criação
        // O 'email' não existe na tabela restaurants segundo seu schema, mas o 'phone' sim.
        const { rows } = await query(
            `
            INSERT INTO public.restaurants (user_id, phone, created_at, updated_at)
            VALUES ($1, $2, NOW(), NOW())
            RETURNING id;
            `,
            [userId, phone]
        );

        if (!rows || rows.length === 0) {
            throw new Error("Falha ao criar o restaurante no banco de dados.");
        }

        return NextResponse.json({ id: rows[0].id });

    } catch (error) {
        console.error("Erro ao criar restaurante:", error);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}