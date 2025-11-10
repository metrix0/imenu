// app/api/restaurants/[id]/payouts/route.ts
import { query } from "@/lib/sql"; 
import { NextResponse } from "next/server";

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;

    if (!id) {
        return NextResponse.json(
            { error: "Restaurant ID is required" },
            { status: 400 }
        );
    }

    try {
        // Search payouts from an restaurant ordering by newest to older.
        const { rows } = await query(
            `
            SELECT 
                start_date, 
                end_date, 
                amount_cents, 
                status,
                paid_at,
                order_count
            FROM public.payouts
            WHERE restaurant_id = $1
            ORDER BY start_date DESC
        `,
            [id]
        );

        return NextResponse.json(rows);
    } catch (error) {
        console.error("Error fetching payouts:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}