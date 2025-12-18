// app/api/mestre/mark-payout-paid/route.ts
import { query } from "@/lib/database/sql";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
    // TODO: ADD ADMIN AUTH
    // THIS IS A CRITIC ROUTE AND MUST BE PROTECT

    try {
        const { payoutId } = await request.json();

        if (!payoutId) {
            return NextResponse.json(
                { error: "Payout ID is required" },
                { status: 400 }
            );
        }

        // persistence in DB
        const { rows } = await query(
            `
            UPDATE public.payouts
            SET 
                status = 'paid',
                paid_at = now() -- DEFINE PAYMENT DATE AS NOW
            WHERE 
                id = $1
                AND status = 'pending_payment' -- ONLY ATT WHERE PENDING
            RETURNING id;
        `,
            [payoutId]
        );

        if (rows.length === 0) {
            // If payout doesn't exist or already been paid.
            return NextResponse.json(
                { error: "Payout not found or already processed" },
                { status: 404 }
            );
        }

        return NextResponse.json({ success: true, paid_id: rows[0].payout_id });
    } catch (error) {
        console.error("Error marking payout as paid:", error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}