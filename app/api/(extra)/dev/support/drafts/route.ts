import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query, withTransaction } from "@/lib/database/sql";
import { sendTrackedSupportText } from "@/lib/services/supportWhatsApp";
import { devPage, DEV_PAGE_SIZE, paged } from "@/lib/dev/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CONVERSATION_JOIN = `LEFT JOIN support_conversations c ON c.id=d.conversation_id
    OR (d.conversation_id IS NULL AND c.chat_id=CASE WHEN d.session_name='imenu-blast'
    THEN 'imenu-blast:' || d.chat_id ELSE d.chat_id END)`;
const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
const VISIBLE_DRAFT_SQL = [
    "NOT EXISTS (SELECT 1 FROM support_contact_exclusions e WHERE",
    "e.identifier_hash = encode(sha256(convert_to('chat:' || replace(d.chat_id,'imenu-blast:',''), 'UTF8')), 'hex')",
    "OR e.identifier_hash = encode(sha256(convert_to('phone:' ||",
    "regexp_replace(COALESCE(c.phone,''), '[^0-9]', '', 'g'), 'UTF8')), 'hex'))",
].join(" ");

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    const params = new URL(request.url).searchParams;
    const id = params.get("id");
    const conversationId = params.get("conversation_id");
    if (id || conversationId) {
        const contextId = conversationId || id!;
        if (!UUID.test(contextId)) return NextResponse.json({error:"Resposta inválida."},{status:400});
        try {
            const source = conversationId ? "support_messages m" : `support_ai_reply_drafts d ${CONVERSATION_JOIN} JOIN support_messages m ON m.conversation_id=c.id`;
            const condition = conversationId ? "m.conversation_id=$1" : "d.id=$1";
            const messages = await query(`SELECT * FROM (
                SELECT m.id,m.direction,m.body,m.model,m.dedupe_key,m.created_at FROM ${source}
                WHERE ${condition} AND (m.direction='inbound' OR m.send_status='sent')
                ORDER BY m.created_at DESC,m.id DESC LIMIT 40
            ) messages ORDER BY created_at,id`,[contextId]);
            return NextResponse.json({messages:messages.rows},{headers:{"Cache-Control":"no-store"}});
        } catch(error) {
            console.error("[SUPPORT_DRAFTS] context failed:",error);
            return NextResponse.json({error:"Não foi possível carregar a conversa."},{status:500});
        }
    }
    const state = params.get("status") || "pending";
    if (!["pending", "approved", "rejected"].includes(state)) {
        return NextResponse.json({ error: "Filtro inválido." }, { status: 400 });
    }

    const page = devPage(params);
    try {
        const [rows, count, pending] = await Promise.all([
            query(`WITH latest AS (
                SELECT DISTINCT ON (session_name,chat_id) * FROM support_ai_reply_drafts
                ORDER BY session_name,chat_id,created_at DESC,id DESC
            ) SELECT d.id,d.reply_text,d.review_status,d.session_name,d.created_at,c.customer_name,c.phone,
                c.restaurant_id,r.name restaurant_name,EXISTS(SELECT 1 FROM restaurant_addons a WHERE a.restaurant_id=r.id AND a.product_key='ia_plus' AND (a.status='active' OR (a.status IN ('canceled','past_due') AND a.current_period_ends_at>NOW()))) AS plus,m.body inbound_message,
                COALESCE(last_msg.direction='outbound' AND last_msg.model IS NULL
                    AND (last_msg.dedupe_key IS NULL OR last_msg.dedupe_key LIKE 'support:human:%' OR last_msg.dedupe_key LIKE 'support:draft:%')
                    AND last_msg.created_at > d.created_at,false) AS attended
                FROM latest d ${CONVERSATION_JOIN}
                LEFT JOIN restaurants r ON r.id=c.restaurant_id
                LEFT JOIN support_messages m ON m.id=d.trigger_message_id AND m.direction='inbound'
                LEFT JOIN LATERAL (
                    SELECT direction,model,dedupe_key,created_at FROM support_messages sm
                    WHERE sm.conversation_id=c.id AND (sm.direction='inbound' OR sm.send_status='sent')
                    ORDER BY sm.created_at DESC,sm.id DESC LIMIT 1
                ) last_msg ON TRUE
                WHERE d.review_status=$1 AND ${VISIBLE_DRAFT_SQL} ORDER BY plus DESC,attended ASC,d.created_at DESC,d.id DESC LIMIT $2 OFFSET $3`,[state,DEV_PAGE_SIZE,page*DEV_PAGE_SIZE]),
            query<{total:number}>(`SELECT COUNT(*)::int total FROM (SELECT DISTINCT ON(session_name,chat_id) id,conversation_id,session_name,chat_id,review_status FROM support_ai_reply_drafts ORDER BY session_name,chat_id,created_at DESC,id DESC) d ${CONVERSATION_JOIN} WHERE d.review_status=$1 AND ${VISIBLE_DRAFT_SQL}`,[state]),
            query<{total:number}>(`SELECT COUNT(*)::int total FROM (SELECT DISTINCT ON(session_name,chat_id) id,conversation_id,session_name,chat_id,review_status FROM support_ai_reply_drafts ORDER BY session_name,chat_id,created_at DESC,id DESC) d ${CONVERSATION_JOIN} WHERE d.review_status='pending' AND ${VISIBLE_DRAFT_SQL}`),
        ]);
        return NextResponse.json({
            ...paged(rows.rows, count.rows[0]?.total ?? 0, page),
            pending: pending.rows[0]?.total ?? 0,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[SUPPORT_DRAFTS] list failed:", error);
        return NextResponse.json({ error: "Erro ao carregar respostas." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;
    if (!(process.env.IMENU_SUPPORT_PUBLIC_URL?.trim().replace(/\/+$/, "") === "https://www.imenuapp.com.br")) {
        return NextResponse.json({ error: "Revisões de suporte disponíveis apenas na produção." }, { status: 403 });
    }

    let body: { id?: unknown; action?: unknown; text?: unknown; requestId?: unknown };
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
    if (typeof body?.id !== "string" || !UUID.test(body.id)) {
        return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
    }

    try {
        if (body.action === "send_human_message") {
            const text = typeof body.text === "string" ? body.text.trim() : "";
            if (!text || text.length > 8000 || typeof body.requestId !== "string" || !UUID.test(body.requestId)) {
                return NextResponse.json({ error: "Informe uma mensagem válida." }, { status: 400 });
            }
            const result = await query<{ id: string; chat_id: string; mode: string }>(
                "SELECT id,chat_id,mode FROM support_conversations WHERE id=$1 LIMIT 1",
                [body.id]
            );
            const conversation = result.rows[0];
            if (!conversation || conversation.mode !== "human") {
                return NextResponse.json({ error: "Conversa não está em atendimento humano." }, { status: 409 });
            }
            const isBlast = conversation.chat_id.startsWith("imenu-blast:");
            const sessionName = isBlast ? "imenu-blast" : "imenu-support";
            const chatId = isBlast ? conversation.chat_id.slice("imenu-blast:".length) : conversation.chat_id;
            if (!chatId || !/@(?:c\.us|lid)$/.test(chatId)) {
                return NextResponse.json({ error: "Contato WhatsApp inválido." }, { status: 400 });
            }
            const sent = await sendTrackedSupportText({
                conversationId: conversation.id,
                sessionName,
                chatId,
                text,
                dedupeKey: `support:human:${conversation.id}:${body.requestId}`,
            });
            if (!sent) return NextResponse.json({ error: "O contato está bloqueado para envios." }, { status: 409 });
            return NextResponse.json({ ok: true, sent: true });
        }
        let changed;
        if (body.action === "edit") {
            const text = typeof body.text === "string" ? body.text.trim() : "";
            if (!text || text.length > 8000) {
                return NextResponse.json({ error: "Informe uma resposta de até 8.000 caracteres." }, { status: 400 });
            }
            changed = await query(
                "UPDATE support_ai_reply_drafts SET reply_text=$2, updated_at=NOW() " +
                "WHERE id=$1 AND review_status='pending' RETURNING id",
                [body.id, text]
            );
        } else if (body.action === "approve") {
            const sent = await withTransaction(async client => {
                const result = await client.query(`SELECT d.id,d.reply_text,d.review_status,d.session_name,d.chat_id,
                    c.id conversation_id FROM support_ai_reply_drafts d ${CONVERSATION_JOIN}
                    WHERE d.id=$1 FOR UPDATE OF d`,[body.id]);
                const draft = result.rows[0];
                if (!draft || draft.review_status !== "pending") return false;
                if (!draft.conversation_id || !draft.reply_text?.trim()) throw new Error("Conversa ou resposta indisponível.");
                const delivered = await sendTrackedSupportText({
                    conversationId:draft.conversation_id,sessionName:draft.session_name,chatId:draft.chat_id,
                    text:draft.reply_text,dedupeKey:`support:draft:${draft.id}`,replaceUnsentText:true,
                });
                if (!delivered) throw new Error("O contato está bloqueado para envios.");
                await client.query("UPDATE support_ai_reply_drafts SET review_status='approved',updated_at=NOW() WHERE id=$1",[draft.id]);
                return true;
            });
            if (!sent) return NextResponse.json({error:"A resposta não está mais pendente."},{status:409});
            return NextResponse.json({ok:true,sent:true});
        } else if (body.action === "reject") {
            changed = await query(
                "UPDATE support_ai_reply_drafts SET review_status=$2, updated_at=NOW() " +
                "WHERE id=$1 AND review_status='pending' RETURNING id",
                [body.id, "rejected"]
            );
        } else {
            return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
        }

        if (!changed.rowCount) {
            return NextResponse.json({ error: "A resposta não está mais pendente." }, { status: 409 });
        }
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[SUPPORT_DRAFTS] update failed:", error);
        return NextResponse.json({ error: body.action === "approve" ? "Não foi possível enviar pelo WhatsApp. A resposta continua pendente." : body.action === "send_human_message" ? "Não foi possível enviar a mensagem pelo WhatsApp." : "Não foi possível atualizar a resposta." }, { status: 500 });
    }
}
