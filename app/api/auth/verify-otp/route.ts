import { cookies } from "next/headers";
import { NextResponse } from "next/server";

/**
 * The customer loyalty flow now identifies the balance directly by phone.
 * This endpoint only clears legacy loyalty cookies and remains disabled.
 */
export async function POST() {
    const cookieStore = await cookies();
    cookieStore.delete("loyalty_token");

    return NextResponse.json(
        {
            error:
                "A autenticação por código do programa de fidelidade foi removida.",
        },
        { status: 410 }
    );
}
