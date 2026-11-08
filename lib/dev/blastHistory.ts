import {buildExpiryMessage} from "@/lib/services/addonExpiryMessage";
import {payoutNotice} from "@/lib/services/payoutNotifications";
import { ABANDONED_BLAST_MESSAGE, PLUS_ABANDONED_BLAST_MESSAGE, SINGLE_ORDER_DAY_RECOVERY_MESSAGE, NO_FIRST_ORDER_RECOVERY_MESSAGE, RECOVERY_DAILY_LIMIT } from "./abandonedBlast";
import { PLUS_FIRST_MONTH_FEEDBACK_MESSAGE, PLUS_FEEDBACK_DAILY_LIMIT } from "./plusFeedbackBlast";
import { DID_NOT_ACTIVATE_BLAST_MESSAGE } from "./didNotActivateBlast";
import { MESSAGE_ROWS_SQL } from "./messageHistory";
import { query } from "@/lib/database/sql";
import { DEV_PAGE_SIZE, devPage, paged } from "./pagination";

// Existing campaign and send logs are the source of truth; no additional registry/table.
export const AUTOMATED_BLASTS = [
    {id:"recovery-plus",name:"Abandonados Plus",sender:"blast",message:PLUS_ABANDONED_BLAST_MESSAGE,criteria:"Plus ativo · pedidos em 2+ dias no último mês · 14 dias sem pedidos · maior GMV primeiro",limit:RECOVERY_DAILY_LIMIT},
    {id:"recovery",name:"Abandonados iMenu",sender:"blast",message:ABANDONED_BLAST_MESSAGE,criteria:"iMenu sem Plus · pedidos em 2+ dias no último mês · 14 dias sem pedidos · maior GMV primeiro",limit:RECOVERY_DAILY_LIMIT},
    {id:"single-order",name:"Um único dia de pedidos",sender:"blast",message:SINGLE_ORDER_DAY_RECOVERY_MESSAGE,criteria:"Cadastro completo · pedidos em apenas 1 dia nos últimos 14 dias",limit:RECOVERY_DAILY_LIMIT},
    {id:"first-order",name:"Não ativados",sender:"blast",message:NO_FIRST_ORDER_RECOVERY_MESSAGE,criteria:"Cadastro completo há 24–48h · ainda sem primeiro pedido",limit:RECOVERY_DAILY_LIMIT},
    {id:"plus-feedback",name:"Feedback · 1º mês Plus",sender:"support",message:PLUS_FIRST_MONTH_FEEDBACK_MESSAGE,criteria:"7 dias antes da 1ª renovação/vencimento · Pix primeiro",limit:PLUS_FEEDBACK_DAILY_LIMIT},
    {id:"expiry",name:"Vencimento iMenu Plus · Pix",sender:"support",message:buildExpiryMessage({pix:["ia_plus"],card:[]}),criteria:"Plus Pix · 1 dia antes do fim do período pago",limit:null},
    {id:"expiry-card",name:"Cancelamento iMenu Plus · Cartão",sender:"support",message:buildExpiryMessage({pix:[],card:["ia_plus"]}),criteria:"Cartão cancelado · 1 dia antes do fim do período pago",limit:null},
    {id:"payout",name:"Problemas com repasse",sender:"blast",message:payoutNotice(false),criteria:"Repasse com falha",limit:null},
    {id:"payout-key",name:"Repasse sem chave PIX",sender:"blast",message:payoutNotice(true),criteria:"Repasse sem chave Pix cadastrada",limit:null},
    {id:"followup",name:"Follow-ups",sender:"support",message:null,criteria:"Suporte aguardando resposta há 1h ou mais",limit:null},
    {id:"congratulations",name:"Boas-vindas iMenu Plus",sender:"support",message:null,criteria:"Compra iMenu Plus confirmada",limit:null},
] as const;
const patterns = [ABANDONED_BLAST_MESSAGE,PLUS_ABANDONED_BLAST_MESSAGE,SINGLE_ORDER_DAY_RECOVERY_MESSAGE,NO_FIRST_ORDER_RECOVERY_MESSAGE,DID_NOT_ACTIVATE_BLAST_MESSAGE].map(message=>"^"+message.replace(/\s+/g," ").trim().split("{{Nome Restaurante}}").map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,"\\$&")).join(".{1,200}")+"$");
const campaignGroup = `CASE WHEN c.message = '${PLUS_FIRST_MONTH_FEEDBACK_MESSAGE.replaceAll("'", "''")}' THEN 'automation:plus-feedback' WHEN regexp_replace(trim(c.message),'\\s+',' ','g') ~ANY($1::text[]) THEN 'automation:recovery' ELSE 'campaign:'||c.id::text END`;


const EVENTS = `WITH notifications AS (${MESSAGE_ROWS_SQL}),events AS (
    SELECT ${campaignGroup} AS group_id,c.created_at,c.message,c.sender,c.status,
        NULL::text AS phone,NULL::text AS error,c.id::text campaign_id,NULL::uuid restaurant_id
    FROM support_blast_campaigns c
    UNION ALL
    SELECT CASE WHEN o.dedupe_key LIKE 'support:payout:%' THEN 'payout:'||split_part(o.dedupe_key,':',3)
        WHEN o.dedupe_key LIKE 'support:addon-expiry:%' THEN 'expiry:'||split_part(o.dedupe_key,':',4) ELSE 'manual:'||split_part(o.dedupe_key,':',4) END,
        o.created_at,COALESCE(o.context->>'message','Texto não registrado no histórico antigo.'),
        COALESCE(o.context->>'sender',CASE WHEN o.dedupe_key LIKE 'support:bulk:support:%' OR o.dedupe_key LIKE 'support:addon-expiry:%' THEN 'support' ELSE 'blast' END),
        o.status,split_part(o.chat_id,'@',1),o.last_error,NULL,o.restaurant_id
    FROM whatsapp_outbound_messages o
    WHERE (o.dedupe_key LIKE 'support:bulk:%' OR o.dedupe_key LIKE 'support:payout:%' OR o.dedupe_key LIKE 'support:addon-expiry:%')
      AND NOT EXISTS(SELECT 1 FROM support_blast_campaigns c WHERE c.id::text=split_part(o.dedupe_key,':',4))
    UNION ALL
    SELECT 'automation:recovery',m.created_at,m.body,'blast',m.send_status,c.phone,m.error,NULL,c.restaurant_id
    FROM support_messages m JOIN support_conversations c ON c.id=m.conversation_id
    WHERE c.chat_id LIKE 'imenu-blast:%' AND m.direction='outbound'
      AND m.dedupe_key IS NULL AND regexp_replace(trim(m.body),'\\s+',' ','g') ~ANY($1::text[])
      AND NOT EXISTS(SELECT 1 FROM support_blast_recipients r WHERE r.phone=c.phone AND r.message=m.body AND ABS(EXTRACT(EPOCH FROM r.sent_at-m.created_at))<300)
      AND NOT EXISTS(SELECT 1 FROM whatsapp_outbound_messages o WHERE o.context->>'message'=m.body AND (split_part(o.chat_id,'@',1)=c.phone OR o.restaurant_id=c.restaurant_id) AND ABS(EXTRACT(EPOCH FROM o.updated_at-m.created_at))<300)
    UNION ALL SELECT CASE WHEN n.category='automation' THEN 'customer:'||n.subtype||':'||(n.created_at AT TIME ZONE 'America/Sao_Paulo')::date::text ELSE n.id END,
    COALESCE(n.sent_at,n.created_at),COALESCE(n.message,'Texto não registrado no histórico antigo.'),CASE WHEN n.category='automation' THEN 'restaurant' ELSE 'support' END,n.status,n.phone,n.error,NULL,n.restaurant_id FROM notifications n WHERE n.category <> 'automation'
)`;


type ProfileTarget={restaurant_id:string;name:string;kind:string};
async function withDestinations<T extends {id?:string;phone?:string|null;restaurant_id?:string|null}>(rows:T[]) {
 const phones=[...new Set(rows.map(row=>(row.phone||"").replace(/\D/g,"").slice(-11)).filter(p=>p.length>=10))];
 const ids=[...new Set(rows.map(row=>row.restaurant_id).filter(Boolean))];
 if(!phones.length&&!ids.length)return rows.map(row=>({...row,profiles:[] as ProfileTarget[]}));
 const matched=await query<{restaurant_id:string;name:string;owner_phone:string;store_phone:string}>(`WITH contacts AS (
 SELECT r.id restaurant_id,r.name,RIGHT(regexp_replace(COALESCE(NULLIF(TRIM(u.raw_user_meta_data->>'phone'),''),r.phone,''),'[^0-9]','','g'),11) owner_phone,
 RIGHT(regexp_replace(COALESCE(r.store_whatsapp,''),'[^0-9]','','g'),11) store_phone
 FROM restaurants r LEFT JOIN auth.users u ON u.id=r.user_id)
 SELECT * FROM contacts WHERE restaurant_id::text=ANY($2::text[]) OR owner_phone=ANY($1::text[]) OR store_phone=ANY($1::text[]) ORDER BY name,restaurant_id`,[phones,ids]);
 return rows.map(row=>{const phone=(row.phone||"").replace(/\D/g,"").slice(-11);return {...row,profiles:matched.rows.filter(m=>row.restaurant_id?m.restaurant_id===row.restaurant_id:phone&&(m.owner_phone===phone||m.store_phone===phone)).map(m=>({restaurant_id:m.restaurant_id,name:m.name,kind:m.owner_phone===phone&&m.store_phone===phone?'Dono e loja':m.owner_phone===phone?'Dono':m.store_phone===phone?'Loja':row.id?.startsWith('congratulations:')?'Dono':row.id?.startsWith('customer:')?'Cliente':'Contato'}))};});
}
async function automatedMessages(){
 const messages=await query<{kind:string;message:string;sender:string}>(`${EVENTS} SELECT DISTINCT ON(kind) kind,message,sender FROM (SELECT *,CASE WHEN group_id LIKE 'expiry:%' THEN 'expiry' WHEN group_id LIKE 'payout:%' THEN 'payout' WHEN group_id LIKE 'followup:%' THEN 'followup' WHEN group_id LIKE 'congratulations:%' THEN 'congratulations' WHEN group_id LIKE 'customer:%' THEN 'customer' END kind FROM events) e WHERE kind IS NOT NULL ORDER BY kind,created_at DESC`,[patterns]);
 return AUTOMATED_BLASTS.map(row=>{const actual=messages.rows.find(m=>m.kind===row.id);return {...row,message:row.message||actual?.message||null,sender:actual?.sender||row.sender};}).filter(row=>Boolean(row.message));
}

export async function getBlastHistory(params:URLSearchParams) {
 const page=devPage(params), id=params.get("group");
 if(id && params.get("view")==="campaigns") {
  const where = id.startsWith("automation:") ? `(${campaignGroup})=$2` : `'campaign:'||c.id::text=$2`;
  const [rows,count]=await Promise.all([
   query(`SELECT 'campaign:'||c.id::text id,c.id::text campaign_id,c.created_at,c.message,c.sender,c.status,c.total,COUNT(r.id) FILTER(WHERE r.status='sent')::int sent,COUNT(r.id) FILTER(WHERE r.status='failed')::int failed FROM support_blast_campaigns c LEFT JOIN support_blast_recipients r ON r.campaign_id=c.id WHERE ${where} GROUP BY c.id ORDER BY c.created_at DESC,c.id LIMIT $3 OFFSET $4`,[patterns,id,DEV_PAGE_SIZE,page*DEV_PAGE_SIZE]),
   query<{total:number}>(`SELECT COUNT(*)::int total FROM support_blast_campaigns c WHERE ${where}`,[patterns,id])]);return paged(rows.rows,count.rows[0].total,page);
 }
 if(id) {
  const recipients=`${EVENTS},recipients AS (SELECT r.id::text,r.phone,r.message,r.status,r.error,r.sent_at,r.scheduled_at,r.created_at,NULL::uuid restaurant_id FROM support_blast_recipients r JOIN support_blast_campaigns c ON c.id=r.campaign_id WHERE (${campaignGroup})=$2 OR 'campaign:'||c.id::text=$2 UNION ALL SELECT group_id||':'||row_number() OVER()::text,phone,message,status,error,created_at,NULL::timestamptz,created_at,restaurant_id FROM events WHERE group_id=$2 AND campaign_id IS NULL)`;
  const [rows,count]=await Promise.all([query(`${recipients} SELECT * FROM recipients ORDER BY created_at DESC,id LIMIT $3 OFFSET $4`,[patterns,id,DEV_PAGE_SIZE,page*DEV_PAGE_SIZE]),query<{total:number}>(`${recipients} SELECT COUNT(*)::int total FROM recipients`,[patterns,id])]);return paged(await withDestinations(rows.rows),count.rows[0].total,page);
 }
 const [rows,count]=await Promise.all([query(`${EVENTS} SELECT group_id id,MAX(created_at) created_at,MIN(message) message,MIN(sender) sender,CASE WHEN COUNT(DISTINCT restaurant_id)=1 THEN MIN(restaurant_id::text) END restaurant_id,CASE WHEN COUNT(DISTINCT phone)=1 THEN MIN(phone) END phone,CASE WHEN COUNT(*)=1 THEN MAX(campaign_id) END campaign_id,COUNT(*)::int total,COUNT(*) FILTER(WHERE status='sent')::int sent,COUNT(*) FILTER(WHERE status='failed')::int failed FROM events GROUP BY group_id ORDER BY MAX(created_at) DESC,group_id LIMIT $2 OFFSET $3`,[patterns,DEV_PAGE_SIZE,page*DEV_PAGE_SIZE]),query<{total:number}>(`${EVENTS} SELECT COUNT(DISTINCT group_id)::int total FROM events`,[patterns])]);
 const progress=await query(`SELECT ${campaignGroup} id,COUNT(DISTINCT c.id)::int campaigns,COALESCE(SUM(cnt.total),0)::int total,COALESCE(SUM(cnt.sent),0)::int sent,COALESCE(SUM(cnt.failed),0)::int failed,CASE WHEN BOOL_OR(c.status='running') THEN 'running' WHEN BOOL_OR(c.status='paused') THEN 'paused' ELSE MIN(c.status) END status FROM support_blast_campaigns c CROSS JOIN LATERAL (SELECT c.total total,COUNT(r.id) FILTER(WHERE r.status='sent')::int sent,COUNT(r.id) FILTER(WHERE r.status='failed')::int failed FROM support_blast_recipients r WHERE r.campaign_id=c.id) cnt WHERE (${campaignGroup})=ANY($2::text[]) GROUP BY 1`,[patterns,rows.rows.map(row=>row.id)]);
 const byId=new Map(progress.rows.map(row=>[row.id,row]));for(const row of rows.rows){const p=byId.get(row.id);if(p){row.total+=p.total-p.campaigns;row.sent+=p.sent;row.failed+=p.failed;row.status=p.status;}}
 return {...paged(await withDestinations(rows.rows),count.rows[0].total,page),automations:await automatedMessages()};
}
