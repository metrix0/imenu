// app/api/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/sql";

// (Função GET - Corrigida para buscar os dados que a página .../info precisa)
export async function GET(_: Request, context: { params: Promise<{ id: string }> }) {
    const { id } = await context.params;

    const { rows: [order] } = await query(
        // Adiciona subtotal_cents e restaurant_id
        `SELECT id, status, subtotal_cents, restaurant_id 
         FROM orders WHERE id = $1`,
        [id]
    );

    if (!order) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json(order);
}

// --- FUNÇÃO PATCH ATUALIZADA ---
export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const body = await req.json();

    // Lógica de atualização dinâmica
    const allowedFields: { [key: string]: string } = {
        status: "status",
        customer_name: "customer_name",
        customer_phone: "customer_phone",
        customer_address: "customer_address",
        delivery_cents: "delivery_cents",
        total_cents: "total_cents",
        is_delivery: "is_delivery",
        user_id: "user_id" // (Importante para o fluxo de OTP)
    };

    const fieldsToUpdate: string[] = [];
    const values: any[] = [id]; // $1 é o 'id'
    let i = 2;

    for (const key in body) {
        if (allowedFields[key]) {
            let value = body[key];
            // Converte JSON (se houver)
            if (key.includes("_json")) {
                value = JSON.stringify(value);
            }
            fieldsToUpdate.push(`${allowedFields[key]} = $${i++}`);
            values.push(value);
        }
    }

    if (fieldsToUpdate.length === 0) {
        return NextResponse.json({ error: "Nenhum campo válido fornecido" }, { status: 400 });
    }

    try {
        // Atualiza o pedido
        await query(
            `UPDATE orders SET ${fieldsToUpdate.join(", ")} WHERE id = $1`,
            values
        );
        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error(`Erro ao atualizar pedido ${id}:`, error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}