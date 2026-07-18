import { NextResponse } from "next/server";

/**
 * The customer loyalty flow no longer uses WhatsApp OTP.
 * Keep this endpoint disabled so older cached clients cannot trigger messages.
 */
export async function POST() {
    return NextResponse.json(
        {
            error:
                "A autenticação por código do programa de fidelidade foi removida.",
        },
        { status: 410 }
    );
}
