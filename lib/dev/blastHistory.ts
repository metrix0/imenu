import { ABANDONED_BLAST_MESSAGE,SINGLE_ORDER_DAY_RECOVERY_MESSAGE,NO_FIRST_ORDER_RECOVERY_MESSAGE } from "./abandonedBlast";
import { DID_NOT_ACTIVATE_BLAST_MESSAGE } from "./didNotActivateBlast";
import { MESSAGE_ROWS_SQL } from "./messageHistory";
import { query } from "@/lib/database/sql";
import { DEV_PAGE_SIZE, devPage, paged } from "./pagination";

// Existing campaign and send logs are the source of truth; no additional registry/table.
export const AUTOMATED_BLASTS = [
    { name: "Recuperação de abandonados", route: "/api/cron/abandoned-blast", rule: "Clientes abandonados, um único dia de pedidos ou cadastro concluído sem primeiro pedido. Respeita os bloqueios e intervalos existentes." },
    { name: "Vencimento iMenu Plus", route: "/api/cron/addon-expiry-whatsapp", rule: "Lembretes existentes de vencimento do Plus, por Pix ou cartão." },
    { name: "Problemas com repasse", route: "Fluxo de repasses", rule: "Sem chave PIX ou repasse com falha. No máximo um aviso por restaurante/dia." },
    {name:"Follow-ups",route:"Suporte",rule:"Retomadas automáticas de atendimento."},
    {name:"Boas-vindas iMenu Plus",route:"Pagamento Plus",rule:"Primeiro pagamento confirmado."},
    {name:"Automações de clientes",route:"Marketing",rule:"Carrinho abandonado, reativação e hábito de compra."},
] as const;
const patterns = [ABANDONED_BLAST_MESSAGE,SINGLE_ORDER_DAY_RECOVERY_MESSAGE,NO_FIRST_ORDER_RECOVERY_MESSAGE,DID_NOT_ACTIVATE_BLAST_MESSAGE].map(message=>"^"+message.replace(/\s+/g," ").trim().split("{{Nome Restaurante}}").map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join(".{1,200}")+"$");
const campaignGroup = `CASE WHEN regexp_replace(trim(c.message),'\\s+',' ','g') ~ANY($1::text[]) THEN 'automation:recovery' ELSE 'campaign:'||c.id::text END`;


const EVENTS = `WITH notifications AS (${MESSAGE_ROWS_SQL}),events AS (
    SELECT ${campaignGroup} AS group_id,c.created_at,c.message,c.sender,c.status,
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
    SELECT 'automation:recovery',m.created_at,m.body,'blast',m.send_status,c.phone,m.error,NULL
    FROM support_messages m JOIN support_conversations c ON c.id=m.conversation_id
    WHERE c.chat_id LIKE 'imenu-blast:%' AND m.direction='outbound'
      AND m.dedupe_key IS NULL AND regexp_replace(trim(m.body),'\\s+',' ','g') ~ANY($1::text[])
      AND NOT EXISTS(SELECT 1 FROM support_blast_recipients r WHERE r.phone=c.phone AND r.message=m.body AND ABS(EXTRACT(EPOCH FROM r.sent_at-m.created_at))<300)
      AND NOT EXISTS(SELECT 1 FROM whatsapp_outbound_messages o WHERE o.context->>'message'=m.body AND (split_part(o.chat_id,'@',1)=c.phone OR o.restaurant_id=c.restaurant_id) AND ABS(EXTRACT(EPOCH FROM o.updated_at-m.created_at))<300)
    UNION ALL SELECT CASE WHEN n.category='automation' THEN 'customer:'||n.subtype||':'||(n.created_at AT TIME ZONE 'America/Sao_Paulo')::date::text ELSE n.id END,
    COALESCE(n.sent_at,n.created_at),COALESCE(n.message,'Texto não registrado no histórico antigo.'),CASE WHEN n.category='automation' THEN 'restaurant' ELSE 'support' END,n.status,n.phone,n.error,NULL FROM notifications n
)`;

export async function getBlastHistory(params:URLSearchParams) {
 const page=devPage(params), id=params.get("group");
 if(id && params.get("view")==="campaigns") {
  const where = id==="automation:recovery" ? `(${campaignGroup})=$2` : `'campaign:'||c.id::text=$2`;
  const [rows,count]=await Promise.all([
   query(`SELECT 'campaign:'||c.id::text id,c.id::text campaign_id,c.created_at,c.message,c.sender,c.status,c.total,COUNT(r.id) FILTER(WHERE r.status='sent')::int sent,COUNT(r.id) FILTER(WHERE r.status='failed')::int failed FROM support_blast_campaigns c LEFT JOIN support_blast_recipients r ON r.campaign_id=c.id WHERE ${where} GROUP BY c.id ORDER BY c.created_at DESC,c.id LIMIT $3 OFFSET $4`,[patterns,id,DEV_PAGE_SIZE,page*DEV_PAGE_SIZE]),
   query<{total:number}>(`SELECT COUNT(*)::int total FROM support_blast_campaigns c WHERE ${where}`,[patterns,id])]);return paged(rows.rows,count.rows[0].total,page);
 }
 if(id) {
  const recipients=`${EVENTS},recipients AS (SELECT r.id::text,r.phone,r.message,r.status,r.error,r.sent_at,r.scheduled_at,r.created_at FROM support_blast_recipients r JOIN support_blast_campaigns c ON c.id=r.campaign_id WHERE (${campaignGroup})=$2 OR 'campaign:'||c.id::text=$2 UNION ALL SELECT group_id||':'||row_number() OVER()::text,phone,message,status,error,created_at,NULL::timestamptz,created_at FROM events WHERE group_id=$2 AND campaign_id IS NULL)`;
  const [rows,count]=await Promise.all([query(`${recipients} SELECT * FROM recipients ORDER BY created_at DESC,id LIMIT $3 OFFSET $4`,[patterns,id,DEV_PAGE_SIZE,page*DEV_PAGE_SIZE]),query<{total:number}>(`${recipients} SELECT COUNT(*)::int total FROM recipients`,[patterns,id])]);return paged(rows.rows,count.rows[0].total,page);
 }
 const [rows,count]=await Promise.all([query(`${EVENTS} SELECT group_id id,MAX(created_at) created_at,MIN(message) message,MIN(sender) sender,CASE WHEN COUNT(*)=1 THEN MAX(campaign_id) END campaign_id,COUNT(*)::int total,COUNT(*) FILTER(WHERE status='sent')::int sent,COUNT(*) FILTER(WHERE status='failed')::int failed FROM events GROUP BY group_id ORDER BY MAX(created_at) DESC,group_id LIMIT $2 OFFSET $3`,[patterns,DEV_PAGE_SIZE,page*DEV_PAGE_SIZE]),query<{total:number}>(`${EVENTS} SELECT COUNT(DISTINCT group_id)::int total FROM events`,[patterns])]);
 const progress=await query(`SELECT ${campaignGroup} id,COUNT(DISTINCT c.id)::int campaigns,COALESCE(SUM(cnt.total),0)::int total,COALESCE(SUM(cnt.sent),0)::int sent,COALESCE(SUM(cnt.failed),0)::int failed,CASE WHEN BOOL_OR(c.status='running') THEN 'running' WHEN BOOL_OR(c.status='paused') THEN 'paused' ELSE MIN(c.status) END status FROM support_blast_campaigns c CROSS JOIN LATERAL (SELECT c.total total,COUNT(r.id) FILTER(WHERE r.status='sent')::int sent,COUNT(r.id) FILTER(WHERE r.status='failed')::int failed FROM support_blast_recipients r WHERE r.campaign_id=c.id) cnt WHERE (${campaignGroup})=ANY($2::text[]) GROUP BY 1`,[patterns,rows.rows.map(row=>row.id)]);
 const byId=new Map(progress.rows.map(row=>[row.id,row]));for(const row of rows.rows){const p=byId.get(row.id);if(p){row.total+=p.total-p.campaigns;row.sent+=p.sent;row.failed+=p.failed;row.status=p.status;}}
 return {...paged(rows.rows,count.rows[0].total,page),automations:AUTOMATED_BLASTS};
}
