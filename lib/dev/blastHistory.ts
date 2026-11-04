import { query } from "@/lib/database/sql";
import { DEV_PAGE_SIZE, devPage, paged } from "./pagination";

// Existing campaign and send logs are the source of truth; no additional registry/table.
export const AUTOMATED_BLASTS = [
    { name: "Recuperação de abandonados", route: "/api/cron/abandoned-blast", rule: "Clientes abandonados, um único dia de pedidos ou cadastro concluído sem primeiro pedido. Respeita os bloqueios e intervalos existentes." },
    { name: "Vencimento iMenu Plus", route: "/api/cron/addon-expiry-whatsapp", rule: "Lembretes existentes de vencimento do Plus, por Pix ou cartão." },
    { name: "Problemas com repasse", route: "Fluxo de repasses", rule: "Sem chave PIX ou repasse com falha. No máximo um aviso por restaurante/dia." },
] as const;

const EVENTS = `WITH events AS (
    SELECT 'campaign:'||c.id::text AS group_id,c.created_at,c.message,c.sender,c.status,
        NULL::text AS phone,NULL::text AS error,c.id::text campaign_id
    FROM support_blast_campaigns c
    UNION ALL
    SELECT CASE WHEN o.dedupe_key LIKE 'support:payout:%' THEN 'payout:'||split_part(o.dedupe_key,':',3)
        WHEN o.dedupe_key LIKE 'support:addon-expiry:%' THEN 'expiry:'||split_part(o.dedupe_key,':',4) ELSE 'manual:'||split_part(o.dedupe_key,':',4) END,
        o.created_at,COALESCE(o.context->>'message','Texto não registrado no histórico antigo.'),
        COALESCE(o.context->>'sender',CASE WHEN o.dedupe_key LIKE 'support:bulk:support:%' OR o.dedupe_key LIKE 'support:addon-expiry:%' THEN 'support' ELSE 'blast' END),
        o.status,split_part(o.chat_id,'@',1),o.last_error,NULL
    FROM whatsapp_outbound_messages o
    WHERE (o.dedupe_key LIKE 'support:bulk:%' OR o.dedupe_key LIKE 'support:payout:%' OR o.dedupe_key LIKE 'support:addon-expiry:%')
      AND NOT EXISTS(SELECT 1 FROM support_blast_campaigns c WHERE c.id::text=split_part(o.dedupe_key,':',4))
    UNION ALL
    SELECT 'conversation:'||m.id::text,m.created_at,m.body,'blast',m.send_status,c.phone,m.error,NULL
    FROM support_messages m JOIN support_conversations c ON c.id=m.conversation_id
    WHERE c.chat_id LIKE 'imenu-blast:%' AND m.direction='outbound'
      AND m.dedupe_key IS NULL
      AND NOT EXISTS(SELECT 1 FROM support_blast_recipients r WHERE r.phone=c.phone AND r.message=m.body AND ABS(EXTRACT(EPOCH FROM r.sent_at-m.created_at))<300)
      AND NOT EXISTS(SELECT 1 FROM whatsapp_outbound_messages o WHERE o.context->>'message'=m.body AND (split_part(o.chat_id,'@',1)=c.phone OR o.restaurant_id=c.restaurant_id) AND ABS(EXTRACT(EPOCH FROM o.updated_at-m.created_at))<300)
)`;

export async function getBlastHistory(params: URLSearchParams) {
    const page = devPage(params);
    const id = params.get("group");
    if (id?.startsWith("campaign:")) {
        const campaignId = id.slice(9);
        if (!/^[0-9a-f-]{36}$/i.test(campaignId)) throw new Error("Envio inválido.");
        const [rows, count] = await Promise.all([
            query("SELECT id::text,phone,message,status,error,sent_at,scheduled_at FROM support_blast_recipients WHERE campaign_id=$1 ORDER BY scheduled_at,id LIMIT $2 OFFSET $3", [campaignId, DEV_PAGE_SIZE, page * DEV_PAGE_SIZE]),
            query<{ total: number }>("SELECT COUNT(*)::int total FROM support_blast_recipients WHERE campaign_id=$1", [campaignId]),
        ]);
        return paged(rows.rows, count.rows[0].total, page);
    }
    if (id) {
        const [rows, count] = await Promise.all([
            query(`${EVENTS} SELECT group_id||':'||row_number() OVER()::text AS id,phone,message,status,error,created_at AS sent_at FROM events WHERE group_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3`, [id, DEV_PAGE_SIZE, page * DEV_PAGE_SIZE]),
            query<{ total: number }>(`${EVENTS} SELECT COUNT(*)::int total FROM events WHERE group_id=$1`, [id]),
        ]);
        return paged(rows.rows, count.rows[0].total, page);
    }
    const [rows, count] = await Promise.all([
        query(`${EVENTS} SELECT group_id AS id,MAX(created_at) created_at,MIN(message) message,MIN(sender) sender,
            MAX(campaign_id) campaign_id,COUNT(*)::int total,COUNT(*) FILTER(WHERE status='sent')::int sent,
            COUNT(*) FILTER(WHERE status='failed')::int failed
            FROM events GROUP BY group_id ORDER BY MAX(created_at) DESC,group_id LIMIT $1 OFFSET $2`, [DEV_PAGE_SIZE, page * DEV_PAGE_SIZE]),
        query<{ total: number }>(`${EVENTS} SELECT COUNT(DISTINCT group_id)::int total FROM events`),
    ]);
    const campaignIds = rows.rows.map(row => row.campaign_id).filter(Boolean);
    if (campaignIds.length) {
        const progress = await query(`SELECT c.id::text,c.status,c.total,COUNT(r.id) FILTER(WHERE r.status='sent')::int sent,
            COUNT(r.id) FILTER(WHERE r.status='failed')::int failed FROM support_blast_campaigns c
            LEFT JOIN support_blast_recipients r ON r.campaign_id=c.id WHERE c.id=ANY($1::uuid[]) GROUP BY c.id`, [campaignIds]);
        const byId = new Map(progress.rows.map(row => [row.id,row]));
        for (const row of rows.rows) { const { id: _id, ...counts } = byId.get(row.campaign_id) || {}; Object.assign(row,counts); }
    }
    return { ...paged(rows.rows, count.rows[0].total, page), automations: AUTOMATED_BLASTS };
}
