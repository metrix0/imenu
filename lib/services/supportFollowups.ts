import { query, withAdvisoryLock } from "@/lib/database/sql";
import { generateSupportFollowup } from "@/lib/services/supportAgent";
import { isSupportConversationBlacklisted } from "@/lib/services/supportWhatsApp";
import { sendWahaText, SUPPORT_WAHA_SESSION_NAME } from "@/lib/services/wahaClient";

type EligibleFollowup = {
    id: string;
    chat_id: string;
    followup_anchor_inbound_at: string;
    followup_last_ai_at: string;
};

// The existing support-blast pg_cron runs every 10 minutes.
export async function processSupportFollowups(): Promise<number> {
    const result = await query<EligibleFollowup>(
        `SELECT c.id, c.chat_id, c.followup_anchor_inbound_at, c.followup_last_ai_at
         FROM support_conversations c
         WHERE c.mode = 'ai'
           AND NOT c.blacklisted AND NOT c.blocked_handoff
           AND c.handoff_prompted_at IS NULL
           AND (c.ai_paused_until IS NULL OR c.ai_paused_until <= NOW())
           AND (c.last_human_reply_at IS NULL
                OR c.last_human_reply_at < c.followup_anchor_inbound_at)
           AND c.chat_id NOT LIKE 'imenu-blast:%'
           AND c.followup_state = 'awaiting_customer'
           AND c.followup_attempted_at IS NULL
           AND c.followup_anchor_inbound_at = c.last_inbound_at
           AND c.followup_last_ai_at = c.last_outbound_at
           AND c.followup_last_ai_at <= NOW() - INTERVAL '1 hour'
           AND c.followup_last_ai_at >= NOW() - INTERVAL '4 days'
           AND EXTRACT(ISODOW FROM NOW() AT TIME ZONE 'America/Sao_Paulo') BETWEEN 1 AND 5
           AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::time >= TIME '09:00'
           AND (NOW() AT TIME ZONE 'America/Sao_Paulo')::time < TIME '18:00'
           AND EXISTS (
               SELECT 1 FROM support_whatsapp_connection conn
               WHERE conn.session_name = $1
                 AND conn.desired_state = 'connected'
                 AND conn.status = 'WORKING'
                 AND conn.bot_enabled
           )
         ORDER BY c.followup_last_ai_at, c.id
         LIMIT 1`,
        [SUPPORT_WAHA_SESSION_NAME]
    );
    const candidate = result.rows[0];
    if (!candidate) return 0;
    if (await isSupportConversationBlacklisted(candidate.id)) return 0;

    const text = await generateSupportFollowup(candidate.id);
    if (!text) return 0;

    return withAdvisoryLock("support-reply:" + candidate.chat_id, async () => {
        if (await isSupportConversationBlacklisted(candidate.id)) return 0;
        // Atomic reservation: later inbound, human takeover or concurrent
        // worker invalidates the claim. Never retry ambiguous sends.
        const reserved = await query(
            `UPDATE support_conversations c
             SET followup_attempted_at = NOW()
             WHERE c.id = $1
               AND c.chat_id = $2
               AND c.mode = 'ai'
               AND NOT c.blacklisted AND NOT c.blocked_handoff
               AND c.handoff_prompted_at IS NULL
               AND (c.ai_paused_until IS NULL OR c.ai_paused_until <= NOW())
               AND (c.last_human_reply_at IS NULL
                    OR c.last_human_reply_at < $3::timestamptz)
               AND c.followup_state = 'awaiting_customer'
               AND c.followup_attempted_at IS NULL
               AND c.last_inbound_at = $3::timestamptz
               AND c.followup_anchor_inbound_at = $3::timestamptz
               AND c.last_outbound_at = $4::timestamptz
               AND c.followup_last_ai_at = $4::timestamptz
               AND c.followup_last_ai_at <= NOW() - INTERVAL '1 hour'
               AND EXISTS (
                   SELECT 1 FROM support_whatsapp_connection conn
                   WHERE conn.session_name = $5
                     AND conn.desired_state = 'connected'
                     AND conn.status = 'WORKING'
                     AND conn.bot_enabled
               )
             RETURNING c.id`,
            [candidate.id, candidate.chat_id, candidate.followup_anchor_inbound_at,
             candidate.followup_last_ai_at, SUPPORT_WAHA_SESSION_NAME]
        );
        if (!reserved.rowCount) return 0;

        const dedupeKey = "support:followup:" + candidate.id + ":" +
            new Date(candidate.followup_anchor_inbound_at).getTime();
        const logged = await query<{ id: string }>(
            `INSERT INTO support_messages (conversation_id, direction, body, dedupe_key, send_status)
             VALUES ($1, 'outbound', $2, $3, 'pending')
             ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
             RETURNING id`,
            [candidate.id, text, dedupeKey]
        );
        const messageId = logged.rows[0]?.id;
        if (!messageId) return 0;

        try {
            await sendWahaText(SUPPORT_WAHA_SESSION_NAME, candidate.chat_id, text);
            await query("UPDATE support_messages SET send_status = 'sent', error = NULL WHERE id = $1", [messageId]);
            await query("UPDATE support_conversations SET last_outbound_at = NOW(), updated_at = NOW() WHERE id = $1", [candidate.id]);
            return 1;
        } catch (error) {
            await query(
                "UPDATE support_messages SET send_status = 'failed', error = $2 WHERE id = $1",
                [messageId, error instanceof Error ? error.message.slice(0, 500) : "WAHA send failed"]
            );
            console.warn("[SUPPORT_FOLLOWUP] send_unconfirmed_or_failed:", error);
            return 0;
        }
    });
}
