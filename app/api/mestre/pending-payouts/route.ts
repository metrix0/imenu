// app/api/mestre/pending-payouts/route.ts
import { query } from "@/lib/database/sql";
import { NextResponse } from "next/server";

export async function GET(request: Request) {
    
    //TODO: THIS ROUTE IS UNSAFE. ANYONE CAN CALL THIS API E SEE
    // EVERYONE DATA. NEED ADMIN AUTH.

    try {
        const { rows } = await query(
            `
            SELECT 
                p.id AS payout_id, 
                p.start_date, 
                p.end_date, 
                p.amount_cents, 
                p.order_count,
                r.name AS restaurant_name -- brings restaurant's name
            FROM 
                public.payouts p
            JOIN 
                public.restaurants r ON p.restaurant_id = r.id
            WHERE 
                p.status = 'pending_payment' -- only pending
            ORDER BY 
                p.start_date ASC -- oldest first
        `
        );

        return NextResponse.json(rows);
    } catch (error) {
        console.error("Error fetching pending payouts:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}