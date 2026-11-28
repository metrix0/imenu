import { query } from "@/lib/database/sql";
import { isProductionAlertRuntime, recordDevAlert } from "@/lib/dev/health";
import { SUPPORT_CONVERSATION_BLACKLISTED_SQL } from "@/lib/services/supportExclusions";

const OVERDUE_WAITS_SQL = `
    WITH pending AS (
        SELECT c.id, r.name,
               CASE WHEN reply.at IS NULL OR reply.at < c.human_started_at THEN
                   COALESCE((
                       SELECT MAX(m.created_at) FROM support_messages m
                       WHERE m.conversation_id = c.id AND m.direction = 'inbound'
                         AND m.created_at > c.handoff_prompted_at AND m.created_at <= c.human_started_at
                   ), c.human_started_at)
               ELSE (
                   SELECT MIN(m.created_at) FROM support_messages m
                   WHERE m.conversation_id = c.id AND m.direction = 'inbound' AND m.created_at > reply.at
               ) END AS waiting_since
        FROM support_conversations c
        JOIN restaurants r ON r.id = c.restaurant_id
        JOIN restaurant_addons a ON a.restaurant_id = r.id AND a.product_key = 'ia_plus'
        CROSS JOIN LATERAL (
            SELECT GREATEST(c.last_human_reply_at, MAX(m.created_at)) AS at
            FROM support_messages m
            WHERE m.conversation_id = c.id AND m.created_at >= c.human_started_at
              AND m.direction = 'outbound' AND m.send_status = 'sent' AND m.model IS NULL
              AND (m.dedupe_key LIKE 'support:human:%' OR m.dedupe_key LIKE 'support:draft:%')
        ) reply
        WHERE c.mode = 'human' AND c.human_started_at IS NOT NULL
          AND NOT ${SUPPORT_CONVERSATION_BLACKLISTED_SQL} AND NOT c.blocked_handoff
          AND (a.status = 'active' OR (a.status IN ('canceled','past_due') AND a.current_period_ends_at > NOW()))
    )
    SELECT p.name, alarm.delivery_key
    FROM pending p
    CROSS JOIN LATERAL (
        SELECT MIN(GREATEST(
            (window_start AT TIME ZONE 'America/Sao_Paulo') - p.waiting_since,
            p.waiting_since - ((window_start + INTERVAL '9 hours') AT TIME ZONE 'America/Sao_Paulo'),
            INTERVAL '0'
        )) AS distance
        FROM generate_series(-3, 3) AS offsets(days)
        CROSS JOIN LATERAL (
            SELECT (p.waiting_since AT TIME ZONE 'America/Sao_Paulo')::date + days + TIME '09:00' AS window_start
        ) hours
        WHERE EXTRACT(ISODOW FROM window_start) BETWEEN 1 AND 5
    ) business
    CROSS JOIN LATERAL (
        SELECT 'support-wait:' || p.id || ':' || EXTRACT(EPOCH FROM p.waiting_since) AS delivery_key
    ) alarm
    WHERE NOW() > p.waiting_since + INTERVAL '8 hours' + business.distance
      AND NOT EXISTS (
          SELECT 1 FROM public.dev_alerts a WHERE a.fingerprint = alarm.delivery_key AND a.phone_notified
      )
`;

export async function checkPlusSupportWaits(): Promise<number> {
    if (!isProductionAlertRuntime()) return 0;

    const { rows } = await query<{ name: string; delivery_key: string }>(OVERDUE_WAITS_SQL);
    const deliveries = await Promise.all(rows.map(wait => recordDevAlert({
        source: "support",
        severity: "critical",
        trigger: "alarm",
        title: "ALARM TRIGGER · iMenu Plus aguardando atendimento humano",
        message: `${wait.name} ultrapassou o prazo de atendimento humano. Abra /dev/support para responder.`,
        operation: "Atendimento humano",
        deliveryKey: wait.delivery_key,
    })));
    if (deliveries.some(delivery => delivery.deliveryError)) {
        throw new Error("Falha ao enviar alarme de atendimento humano.");
    }
    return deliveries.filter(delivery => delivery.phoneNotified).length;
}
