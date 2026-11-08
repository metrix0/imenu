import { query } from "@/lib/database/sql";
import { recordDevAlert } from "@/lib/dev/health";
import { sendNtfyNotification } from "@/lib/services/ntfy";
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

// Alarm only when a payout failed and its failure notice has not been confirmed as sent.
// A stable incident key prevents repeated alarms from the periodic reconciliation job.
export async function alarmUnnotifiedPayoutFailures(): Promise<void> {
    type UnnotifiedFailure = {
        id: string; automation_run_id: string | null; restaurant_name: string;
        amount_cents: number; failure_reason: string | null; notice_status: string | null;
    };
    try {
        const { rows } = await query<UnnotifiedFailure>(`
            SELECT p.id, p.automation_run_id, COALESCE(r.name, 'Restaurante') AS restaurant_name,
                p.amount_cents, p.failure_reason, notice.status AS notice_status
            FROM public.payouts p
            JOIN public.restaurants r ON r.id = p.restaurant_id
            LEFT JOIN public.whatsapp_outbound_messages notice ON notice.dedupe_key =
                'support:payout:'||to_char(p.created_at AT TIME ZONE 'America/Sao_Paulo','YYYY-MM-DD')||':'||p.restaurant_id::text
            WHERE p.status IN ('failed','cancelled')
              AND p.created_at >= NOW() - INTERVAL '3 days'
              AND (notice.status IS DISTINCT FROM 'sent' OR notice.context->>'message' IS DISTINCT FROM $1)
              AND (notice.status IS DISTINCT FROM 'sending' OR notice.updated_at < NOW() - INTERVAL '2 minutes')
            ORDER BY p.created_at DESC
            LIMIT 100
        `, [payoutNotice(false)]);
        const grouped = new Map<string, UnnotifiedFailure[]>();
        for (const row of rows) {
            const key = row.automation_run_id || row.id;
            grouped.set(key, [...(grouped.get(key) || []), row]);
        }
        for (const [key, failures] of grouped) {
            const detail = failures.slice(0, 10).map(row =>
                row.restaurant_name + ': R$ ' + (Number(row.amount_cents) / 100).toFixed(2) +
                ' · aviso ' + (row.notice_status || 'não enviado') +
                (row.failure_reason ? ' · ' + row.failure_reason : '')
            ).join('\n');
            try {
                await sendNtfyNotification({
                    source: 'payouts',
                    operation: 'Aviso de falha no repasse',
                    title: 'ALARM TRIGGER - iMenu repasse sem aviso',
                    trigger: 'alarm',
                    incidentKey: 'payout:unnotified:' + key,
                    message: failures.length + ' repasse(s) com falha sem aviso automático confirmado.\n' +
                        detail + (failures.length > 10 ? '\n+' + (failures.length - 10) + ' outros' : '') +
                        '\nExecução/repasse: ' + key,
                });
            } catch (error) {
                console.error('[PAYOUT_NOTICE] Falha ao enviar alarme de aviso ausente:',
                    error instanceof Error ? error.message : String(error));
            }
        }
    } catch (error) {
        console.error('[PAYOUT_NOTICE] Não foi possível verificar avisos de repasses com falha:',
            error instanceof Error ? error.message : String(error));
    }
}
