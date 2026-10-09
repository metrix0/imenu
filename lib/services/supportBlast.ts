import { randomUUID } from "node:crypto";
import { ABANDONED_BLAST_MESSAGE } from "@/lib/dev/abandonedBlast";
import { query, withTransaction } from "@/lib/database/sql";
import {
    checkWahaPhoneExists,
    isWahaHttpErrorStatus,
    sendWahaText,
} from "@/lib/services/wahaClient";

export type BlastRecipientInput = { phone: string; message: string };

export function normalizeBlastPhone(value: string): string | null {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("0055")) digits = digits.slice(2);
    if (digits.startsWith("055") && digits.length >= 13) digits = digits.slice(1);
    if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
        digits = "55" + digits;
    }
    return /^55\d{10,11}$/.test(digits) ? digits : null;
}

export async function createSupportBlast(input: {
    sender: "blast" | "support";
    message: string;
    dailyLimit: number | null;
    skipRecent: boolean;
    recipients: BlastRecipientInput[];
    campaignId?: string;
}): Promise<string> {
    if (!input.message.trim() || !input.recipients.length || input.recipients.length > 10000) {
        throw new Error("Informe uma mensagem e de 1 a 10.000 destinatários.");
    }
    if (input.dailyLimit !== null &&
        (!Number.isInteger(input.dailyLimit) || input.dailyLimit < 1 || input.dailyLimit > 10000)) {
        throw new Error("A cadência deve ser de 1 a 10.000 mensagens por dia.");
    }

    const seen = new Set<string>();
    const rows = input.recipients.map((recipient) => {
        const normalized = normalizeBlastPhone(recipient.phone);
        const phone = normalized || recipient.phone.trim().replace(/\D/g, "");
        if (!phone || seen.has(phone)) return null;
        seen.add(phone);
        return {
            phone,
            message: String(recipient.message || "").trim(),
            valid: Boolean(normalized && recipient.message?.trim()),
        };
    }).filter((recipient): recipient is NonNullable<typeof recipient> => recipient !== null);

    if (!rows.length) throw new Error("Nenhum destinatário válido no lote.");

    const connection = await query<{ desired_state: string; status: string }>(
        "SELECT desired_state, status FROM support_whatsapp_connection WHERE id = $1 LIMIT 1",
        [input.sender === "support" ? "default" : "blast"]
    );
    if (connection.rows[0]?.desired_state !== "connected" ||
        connection.rows[0]?.status !== "WORKING") {
        throw new Error("O WhatsApp selecionado não está conectado.");
    }

    const id = input.campaignId || randomUUID();
    await withTransaction(async (client) => {
        const inserted = await client.query(
            "INSERT INTO support_blast_campaigns (id, sender, message, daily_limit, skip_recent, total, status) VALUES ($1, $2, $3, $4, $5, $6, 'running') ON CONFLICT (id) DO NOTHING RETURNING id",
            [id, input.sender, input.message.trim(), input.dailyLimit, input.skipRecent, rows.length]
        );
        if (!inserted.rowCount) return; // Cron retry: leave the existing campaign untouched.
        // Assign one slot to every recipient. Cadenced sends are distributed over
        // 08:00-21:00 São Paulo time; the launch day's remaining window is used.
        // Without cadence, preserve roughly 25-second spacing between messages.
        await client.query(
            `
            WITH incoming AS (
                SELECT item.phone, item.message, item.valid, item.ordinality AS ord,
                       (item.ordinality - 1)::bigint AS idx
                FROM ROWS FROM(
                    jsonb_to_recordset($2::jsonb)
                    AS (phone text, message text, valid boolean)
                ) WITH ORDINALITY AS item
            ),
            clock AS (
                SELECT NOW() AT TIME ZONE 'America/Sao_Paulo' AS local_now
            ),
            starts AS (
                SELECT
                    CASE WHEN local_now::time >= TIME '21:00'
                         THEN local_now::date + 1 ELSE local_now::date END AS base_day,
                    CASE WHEN local_now::time >= TIME '21:00'
                         THEN (local_now::date + 1) + TIME '08:00'
                         ELSE GREATEST(local_now, local_now::date + TIME '08:00')
                    END AS first_start
                FROM clock
            ),
            slots AS (
                SELECT incoming.*,
                       CASE WHEN $3::integer IS NULL THEN 0
                            ELSE (idx / $3::integer)::integer END AS day_offset,
                       CASE WHEN $3::integer IS NULL THEN 0
                            ELSE (idx % $3::integer)::integer END AS day_slot
                FROM incoming
            )
            INSERT INTO support_blast_recipients
                (campaign_id, phone, message, scheduled_at, status, error)
            SELECT $1::uuid, s.phone, s.message,
                CASE WHEN $3::integer IS NULL
                     THEN NOW() + s.idx * INTERVAL '25 seconds'
                     ELSE (
                         CASE WHEN s.day_offset = 0 THEN starts.first_start
                              ELSE (starts.base_day + s.day_offset) + TIME '08:00'
                         END
                         +
                         (CASE WHEN s.day_offset = 0
                               THEN (starts.base_day + TIME '21:00') - starts.first_start
                               ELSE INTERVAL '13 hours'
                          END)
                         * (s.day_slot::double precision /
                            GREATEST(1, LEAST($3::integer, $4::integer - s.day_offset * $3::integer)))
                     ) AT TIME ZONE 'America/Sao_Paulo'
                END,
                CASE WHEN s.valid THEN 'pending' ELSE 'failed' END,
                CASE WHEN s.valid THEN NULL ELSE 'Número ou mensagem inválido.' END
            FROM slots s CROSS JOIN starts
            ORDER BY s.ord
            `,
            [id, JSON.stringify(rows), input.dailyLimit, rows.length]
        );
    });
    return id;
}

export async function listSupportBlasts() {
    return (await query<{
        id: string; sender: string; message: string; daily_limit: number | null;
        status: string; total: number; created_at: string; completed_at: string | null;
        sent: number; failed: number; skipped: number; pending: number;
    }>(
        `
        SELECT c.id, c.sender, c.message, c.daily_limit, c.status, c.total,
               c.created_at, c.completed_at,
               COUNT(r.id) FILTER (WHERE r.status = 'sent')::int AS sent,
               COUNT(r.id) FILTER (WHERE r.status = 'failed')::int AS failed,
               COUNT(r.id) FILTER (WHERE r.status IN ('skipped_recent', 'skipped_reactivated'))::int AS skipped,
               COUNT(r.id) FILTER (WHERE r.status IN ('pending', 'processing'))::int AS pending
        FROM (SELECT * FROM support_blast_campaigns ORDER BY created_at DESC LIMIT 40) c
        LEFT JOIN support_blast_recipients r ON r.campaign_id = c.id
        GROUP BY c.id, c.sender, c.message, c.daily_limit, c.status, c.total,
                 c.created_at, c.completed_at
        ORDER BY c.created_at DESC
        `
    )).rows;
}

export async function getSupportBlastRecipients(id: string) {
    return (await query<{
        id: number; phone: string; status: string; error: string | null;
        scheduled_at: string; sent_at: string | null;
    }>(
        "SELECT id, phone, status, error, scheduled_at, sent_at FROM support_blast_recipients WHERE campaign_id = $1 ORDER BY scheduled_at, id LIMIT 500",
        [id]
    )).rows;
}

export async function setSupportBlastStatus(id: string, action: "pause" | "resume" | "cancel") {
    await withTransaction(async (client) => {
        const next = action === "pause" ? "paused" : action === "resume" ? "running" : "cancelled";
        const allowed = action === "pause" ? ["running"] :
            action === "resume" ? ["paused"] : ["running", "paused"];
        const changed = await client.query(
            "UPDATE support_blast_campaigns SET status = $2 WHERE id = $1 AND status = ANY($3::text[]) RETURNING id",
            [id, next, allowed]
        );
        if (!changed.rowCount) throw new Error("Este envio não permite essa ação.");
        if (action === "cancel") {
            await client.query(
                "UPDATE support_blast_recipients SET status = 'cancelled' WHERE campaign_id = $1 AND status = 'pending'",
                [id]
            );
        }
    });
}

type ClaimedRecipient = {
    id: number;
    campaign_id: string;
    phone: string;
    message: string;
    sender: "support" | "blast";
    skip_recent: boolean;
    campaign_message: string;
};

async function finishRecipient(id: number, status: string, error: string | null = null) {
    await query(
        "UPDATE support_blast_recipients SET status = $2, error = $3, sent_at = CASE WHEN $2 = 'sent' THEN NOW() ELSE NULL END WHERE id = $1",
        [id, status, error]
    );
}

async function finishCampaigns() {
    await query(
        `UPDATE support_blast_campaigns c
         SET status = 'completed', completed_at = NOW()
         WHERE c.status = 'running'
           AND NOT EXISTS (
               SELECT 1 FROM support_blast_recipients r
               WHERE r.campaign_id = c.id AND r.status IN ('pending','processing')
           )`
    );
}

async function claimNextRecipient(): Promise<ClaimedRecipient | null> {
    const result = await query<ClaimedRecipient>(
        `
        WITH claimed AS (
            SELECT r.id
            FROM support_blast_recipients r
            JOIN support_blast_campaigns c ON c.id = r.campaign_id
            WHERE c.status = 'running'
              AND r.status = 'pending'
              AND r.scheduled_at <= NOW()
              AND (
                c.daily_limit IS NULL
                OR (
                    (NOW() AT TIME ZONE 'America/Sao_Paulo')::time >= TIME '08:00'
                    AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::time < TIME '21:00'
                    AND (
                        SELECT COUNT(*) FROM support_blast_recipients today
                        WHERE today.campaign_id = c.id
                          AND today.attempted_at >= (
                            (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
                            + TIME '00:00'
                          ) AT TIME ZONE 'America/Sao_Paulo'
                    ) < c.daily_limit
                )
              )
            ORDER BY r.scheduled_at, r.id
            LIMIT 1
            FOR UPDATE OF r, c SKIP LOCKED
        )
        UPDATE support_blast_recipients r
        SET status = 'processing', attempted_at = NOW(), attempts = attempts + 1
        FROM claimed, support_blast_campaigns c
        WHERE r.id = claimed.id AND c.id = r.campaign_id
        RETURNING r.id, r.campaign_id, r.phone, r.message, c.sender, c.skip_recent, c.message AS campaign_message
        `
    );
    return result.rows[0] || null;
}

async function sendRecipient(item: ClaimedRecipient): Promise<"sent" | "skipped" | "failed" | "disconnected"> {
    const conn = await query<{ session_name: string; status: string; desired_state: string }>(
        "SELECT session_name, status, desired_state FROM support_whatsapp_connection WHERE id = $1",
        [item.sender === "blast" ? "blast" : "default"]
    );
    const session = conn.rows[0];
    if (!session || session.desired_state !== "connected" || session.status !== "WORKING") {
        await query(
            "UPDATE support_blast_recipients SET status = 'pending', attempted_at = NULL, attempts = GREATEST(0, attempts - 1) WHERE id = $1",
            [item.id]
        );
        return "disconnected";
    }
    const running = await query(
        "SELECT 1 FROM support_blast_campaigns WHERE id = $1 AND status = 'running'",
        [item.campaign_id]
    );
    if (!running.rowCount) {
        await query(
            "UPDATE support_blast_recipients SET status = 'pending', attempted_at = NULL WHERE id = $1 AND status = 'processing'",
            [item.id]
        );
        return "skipped";
    }

    const phone = item.phone;
    const chatId = phone + "@c.us";
    const localPhone = phone.slice(2);
    const matched = await query<{ restaurant_id: string }>(
        `
        SELECT DISTINCT r.id AS restaurant_id
        FROM restaurants r LEFT JOIN auth.users u ON u.id = r.user_id
        WHERE regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g') = ANY($1::text[])
           OR regexp_replace(COALESCE(r.phone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
           OR regexp_replace(COALESCE(r.store_whatsapp, ''), '[^0-9]', '', 'g') = ANY($1::text[])
        ORDER BY r.id
        `,
        [[phone, localPhone]]
    );
    const restaurantIds = matched.rows.map((row) => row.restaurant_id);
    const restaurantId = restaurantIds[0] || null;

    // A restaurant that resumed ordering after scheduling must not be contacted.
    if (item.campaign_message === ABANDONED_BLAST_MESSAGE) {
        const reactivated = await query(
            `SELECT 1 FROM orders WHERE restaurant_id = ANY($1::uuid[])
              AND table_id IS NULL AND status = 'done'
              AND created_at >= NOW() - INTERVAL '14 days' LIMIT 1`,
            [restaurantIds]
        );
        if (reactivated.rowCount) {
            await finishRecipient(item.id, "skipped_reactivated");
            return "skipped";
        }
    }

    if (item.skip_recent) {
        const recent = await query(
            `
            SELECT 1 FROM whatsapp_outbound_messages
            WHERE dedupe_key LIKE 'support:bulk:%' AND status = 'sent'
              AND updated_at >= NOW() - INTERVAL '7 days'
              AND (
                chat_id = $2
                OR (cardinality($1::uuid[]) > 0 AND restaurant_id = ANY($1::uuid[]))
              )
            UNION ALL
            SELECT 1 FROM support_blast_recipients
            WHERE phone = $3 AND status = 'sent'
              AND sent_at >= NOW() - INTERVAL '7 days'
            LIMIT 1
            `,
            [restaurantIds, chatId, phone]
        );
        if (recent.rowCount) {
            await finishRecipient(item.id, "skipped_recent");
            return "skipped";
        }
    }

    const dedupeKey = "support:bulk:" + item.sender + ":" + item.campaign_id +
        ":" + (restaurantId || "phone:" + phone);
    const outbound = await query(
        "INSERT INTO whatsapp_outbound_messages (dedupe_key, restaurant_id, chat_id, message_type, status, updated_at) VALUES ($1,$2,$3,'text','sending',NOW()) ON CONFLICT (dedupe_key) DO NOTHING RETURNING dedupe_key",
        [dedupeKey, restaurantId, chatId]
    );
    if (!outbound.rowCount) {
        await finishRecipient(item.id, "skipped_recent");
        return "skipped";
    }

    try {
        const contact = await checkWahaPhoneExists(session.session_name, phone);
        if (!contact.numberExists) {
            throw new Error("Número não existe no WhatsApp.");
        }
        const resolvedChatId = contact.chatId || chatId;
        try {
            await sendWahaText(session.session_name, resolvedChatId, item.message);
        } catch (firstError) {
            if (!isWahaHttpErrorStatus(firstError, 500)) throw firstError;
            await new Promise((resolve) => setTimeout(resolve, 1000));
            await sendWahaText(session.session_name, resolvedChatId, item.message);
        }
        await query(
            "UPDATE whatsapp_outbound_messages SET chat_id=$2, status='sent', last_error=NULL, updated_at=NOW() WHERE dedupe_key=$1",
            [dedupeKey, resolvedChatId]
        );
        await finishRecipient(item.id, "sent");
        return "sent";
    } catch (error) {
        const message = error instanceof Error ? error.message.slice(0, 500) : "WAHA send failed";
        await query(
            "UPDATE whatsapp_outbound_messages SET status='failed', last_error=$2, updated_at=NOW() WHERE dedupe_key=$1",
            [dedupeKey, message]
        );
        await finishRecipient(item.id, "failed", message);
        return "failed";
    }
}

export async function processSupportBlastQueue(): Promise<{
    sent: number; failed: number; skipped: number; disconnected: boolean;
}> {
    // Do not automatically retry ambiguous interrupted sends: WAHA might have
    // delivered the message before a serverless timeout.
    await query(
        `UPDATE support_blast_recipients SET status='failed',
           error='Envio interrompido; verifique o WhatsApp antes de reenviar.'
         WHERE status='processing' AND attempted_at < NOW() - INTERVAL '20 minutes'`
    );
    const result = { sent: 0, failed: 0, skipped: 0, disconnected: false };
    for (let i = 0; i < 3; i++) {
        const item = await claimNextRecipient();
        if (!item) break;
        try {
            const status = await sendRecipient(item);
            if (status === "sent") result.sent += 1;
            if (status === "failed") result.failed += 1;
            if (status === "skipped") result.skipped += 1;
            if (status === "disconnected") {
                result.disconnected = true;
                break;
            }
        } catch (error) {
            await finishRecipient(item.id, "failed",
                error instanceof Error ? error.message.slice(0, 500) : "Falha de envio.");
            result.failed += 1;
        }
    }
    await finishCampaigns();
    return result;
}
