import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { sendWhatsAppMessage } from "@/lib/services/whatsappNotification"; 

export async function POST(req: Request) {
    try {
        const { phone } = await req.json();
        const cleanPhone = phone.replace(/\D/g, "");

        if (cleanPhone.length < 10) {
            return NextResponse.json({ error: "Número inválido" }, { status: 400 });
        }

        // 1. Gera código de 6 dígitos
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // 2. Define expiração (5 minutos)
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

        // 3. Salva no banco (Deleta anteriores do mesmo numero para limpar)
        await query(`DELETE FROM verification_codes WHERE phone = $1`, [cleanPhone]);
        await query(
            `INSERT INTO verification_codes (phone, code, expires_at) VALUES ($1, $2, $3)`,
            [cleanPhone, code, expiresAt]
        );

        // 4. Envia WhatsApp
        await sendWhatsAppMessage(cleanPhone, `Seu código de fidelidade é: *${code}*. Válido por 5 minutos.`);

        return NextResponse.json({ ok: true });

    } catch (error) {
        console.error("Erro send-otp:", error);
        return NextResponse.json({ error: "Erro ao enviar código" }, { status: 500 });
    }
}