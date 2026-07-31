import { query } from "@/lib/database/sql";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
    try {
        const body = await request.json();
        const email = String(body?.email || "").trim().toLowerCase();

        if (!email || !email.includes("@")) {
            return NextResponse.json(
                { error: "E-mail inválido." },
                { status: 400 }
            );
        }

        const { rows } = await query(
            `
            SELECT email_confirmed_at
            FROM auth.users
            WHERE lower(email) = $1
            LIMIT 1
            `,
            [email]
        );

        const user = rows[0];

        return NextResponse.json({
            exists: Boolean(user),
            confirmed: Boolean(user?.email_confirmed_at),
        });
    } catch (error) {
        console.error("[EMAIL_EXISTS]", error);
        return NextResponse.json(
            { error: "Não foi possível verificar o e-mail." },
            { status: 500 }
        );
    }
}
