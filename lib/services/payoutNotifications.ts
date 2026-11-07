import { query } from "@/lib/database/sql";
import { recordDevAlert } from "@/lib/dev/health";
import { normalizeBlastPhone } from "@/lib/services/supportBlast";
import { checkWahaPhoneExists, sendWahaText } from "@/lib/services/wahaClient";

export function payoutNotice(missingKey: boolean): string {
    return missingKey
        ? "Seu repasse iMenu está pendente porque sua loja não tem uma chave PIX cadastrada. Cadastre sua chave na aba Loja do painel. Por segurança, somente você deve cadastrar ou alterar esses dados; não envie sua chave pelo suporte."
        : "Não foi possível concluir seu repasse iMenu. Sua chave PIX pode estar cadastrada incorretamente. Confira e, se necessário, corrija seus dados na aba Loja do painel. Por segurança, somente você deve alterar esses dados; não envie sua chave pelo suporte.";
}

// Reuse the existing atomic outbound-message claim: one attempt per restaurant/business day.
export async function notifyPayoutProblem(restaurantId: string, missingKey: boolean): Promise<void> {
    try {
        const result = await query<{ phone: string | null; session_name: string; status: string; desired_state: string; day: string }>(
            `SELECT COALESCE(NULLIF(u.raw_user_meta_data->>'phone',''),NULLIF(r.phone,'')) phone,
                c.session_name,c.status,c.desired_state,to_char(NOW() AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD') day
             FROM restaurants r LEFT JOIN auth.users u ON u.id=r.user_id
             CROSS JOIN support_whatsapp_connection c WHERE r.id=$1 AND c.id='blast'`, [restaurantId]);
        const row = result.rows[0];
        const phone = normalizeBlastPhone(row?.phone || "");
        if (!row || !phone || row.status !== "WORKING" || row.desired_state !== "connected") return;
        const key = `support:payout:${row.day}:${restaurantId}`;
        const message = payoutNotice(missingKey);
        const claim = await query(`INSERT INTO whatsapp_outbound_messages(dedupe_key,restaurant_id,chat_id,message_type,status,context,updated_at)
            VALUES($1,$2,$3,'text','sending',$4::jsonb,NOW()) ON CONFLICT(dedupe_key) DO NOTHING RETURNING dedupe_key`,
            [key, restaurantId, phone + "@c.us", JSON.stringify({ message, sender: "blast", kind: "payout" })]);
        if (!claim.rowCount) return;
        try {
            const contact = await checkWahaPhoneExists(row.session_name, phone);
            if (!contact.numberExists) throw new Error("Número não existe no WhatsApp.");
            const chatId = contact.chatId || phone + "@c.us";
            await sendWahaText(row.session_name, chatId, message);
            await query("UPDATE whatsapp_outbound_messages SET status='sent',sent_at=NOW(),updated_at=NOW(),chat_id=$2 WHERE dedupe_key=$1", [key, chatId]);
            await recordDevAlert({
                source: "payouts", operation: "Aviso via WhatsApp",
                title: missingKey ? "Aviso de chave PIX enviado" : "Aviso de repasse enviado",
                message: "Mensagem de repasse enviada ao restaurante.",
                severity: "info", trigger: "blast",
            });
        } catch (error) {
            await query("UPDATE whatsapp_outbound_messages SET status='failed',last_error=$2,updated_at=NOW() WHERE dedupe_key=$1", [key, error instanceof Error ? error.message.slice(0, 500) : "Falha no envio."]);
        }
    } catch {
        // Sending a reminder must never alter the outcome or retry behavior of a payout.
        console.warn("[PAYOUT_NOTICE] Não foi possível registrar/enviar aviso.");
    }
}
