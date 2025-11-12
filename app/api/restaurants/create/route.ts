// app/api/restaurants/create/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic"; // Route will not be cached

export async function POST(request: Request) {
    let body;
    try {
        body = await request.json();
    } catch (e) {
        return NextResponse.json({ error: "Corpo JSON inválido" }, { status: 400 });
    }

    const { email } = body;

    if (!email) {
        return NextResponse.json({ error: "E-mail é obrigatório" }, { status: 400 });
    }

    try {
        const { rows } = await query(
            `
            INSERT INTO public.restaurants (email)
            VALUES ($1)
            RETURNING id; -- Retorna o ID do novo restaurante criado
            `,
            [email]
        );

        if (rows.length === 0) {
            throw new Error("Falha ao criar o restaurante no banco de dados.");
        }

        const newRestaurantId = rows[0].id;

        // Returns ID to frontend
        return NextResponse.json({ id: newRestaurantId });

    } catch (error) {
        // Deal with duplicates
        if (error instanceof Error && error.message.includes('duplicate key')) {
            return NextResponse.json(
                { error: "Este e-mail já está em uso." },
                { status: 409 } // 409 Conflict
            );
        }
        
        console.error("Erro ao criar restaurante (lead):", error);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}