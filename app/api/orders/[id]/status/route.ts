// app/api/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/sql";

// ================================
// GET — returns order + items + subitems
// ================================
export async function GET(
    _: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        const { rows: [order] } = await query(
            `
            SELECT status
            FROM orders
            WHERE id = $1
            LIMIT 1
            `,
            [id]
        );

        if (!order) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        return NextResponse.json(order);
    } catch (err: any) {
        console.error("❌ FATAL /api/orders/[id] GET:", err);
        return NextResponse.json(
            { error: err.message ?? "Internal error" },
            { status: 500 }
        );
    }
}
