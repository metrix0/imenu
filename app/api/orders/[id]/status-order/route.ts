// app/api/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";

// ================================
// PATCH — Update Order Status ONLY
// ================================
export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { status } = body;

        // Validação simples dos status permitidos
        const validStatuses = [
            "pending_online_payment",
            "pending_physical_payment",
            "preparing",
            "delivering",
            "done",
            "canceled"
        ];

        if (!status || !validStatuses.includes(status)) {
            return NextResponse.json(
                { error: "Invalid status provided" },
                { status: 400 }
            );
        }

        // Executa a query de atualização
        // CORREÇÃO: Adicionado cast explícito para resolver ambiguidade de tipos (ENUM vs TEXT)
        const { rowCount } = await query(
            `
                UPDATE orders
                SET
                    status = $1::public.order_status,
                updated_at = NOW(),
                -- Convertemos $1 para text explicitamente na comparação para evitar erro 42P08
                delivered_at = CASE WHEN $1::text = 'done' THEN NOW() ELSE delivered_at END
            WHERE id = $2
            `,
            [status, id]
        );

        if (rowCount === 0) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        return NextResponse.json({ ok: true, status });

    } catch (err: any) {
        console.error("❌ ERROR /api/orders/[id]/status PATCH:", err);
        return NextResponse.json(
            { error: err.message ?? "Internal error" },
            { status: 500 }
        );
    }
}