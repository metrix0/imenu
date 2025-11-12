// app/api/restaurants/create/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {

    try {
        const { rows } = await query(
            `
            INSERT INTO public.restaurants DEFAULT VALUES
            RETURNING id; -- Retorna o ID do novo restaurante criado
            `
        );

        if (rows.length === 0) {
            throw new Error("Falha ao criar o restaurante no banco de dados.");
        }

        const newRestaurantId = rows[0].id;

        return NextResponse.json({ id: newRestaurantId });

    } catch (error) {
        
        console.error("Erro ao criar restaurante (rascunho):", error);
        return NextResponse.json(
            { error: "Erro interno do servidor" },
            { status: 500 }
        );
    }
}