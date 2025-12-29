import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { SignJWT } from "jose";
import { cookies } from "next/headers";

const SECRET = new TextEncoder().encode(process.env.JWT_SECRET || "segredo_super_seguro_troque_isso");

export async function POST(req: Request) {
    try {
        const { phone, code } = await req.json();
        const cleanPhone = phone.replace(/\D/g, "");

        // 1. Busca código válido no banco
        const { rows } = await query(
            `SELECT * FROM verification_codes 
             WHERE phone = $1 AND code = $2 AND expires_at > NOW()`,
            [cleanPhone, code]
        );

        if (rows.length === 0) {
            return NextResponse.json({ error: "Código inválido ou expirado" }, { status: 400 });
        }

        // 2. Código válido! Remove do banco para não usar de novo
        await query(`DELETE FROM verification_codes WHERE phone = $1`, [cleanPhone]);

        // 3. Gera TOKEN JWT
        const token = await new SignJWT({ phone: cleanPhone })
            .setProtectedHeader({ alg: 'HS256' })
            .setIssuedAt()
            .setExpirationTime('30d') // Sessão de 30 dias
            .sign(SECRET);

        // 4. Define Cookie HTTP-Only (O Frontend não consegue mexer, só o navegador envia)
        const cookieStore = await cookies();
        cookieStore.set("loyalty_token", token, {
            httpOnly: true,
            secure: process.env.NODE_ENV === "production",
            maxAge: 60 * 60 * 24 * 30, // 30 dias
            path: "/",
        });

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error("Erro verify-otp:", error);
        return NextResponse.json({ error: "Erro interno" }, { status: 500 });
    }
}