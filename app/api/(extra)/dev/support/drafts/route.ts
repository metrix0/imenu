import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { devPage, DEV_PAGE_SIZE, paged } from "@/lib/dev/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    const params = new URL(request.url).searchParams;
    const state = params.get("status") || "pending";
    if (!["pending", "approved", "rejected"].includes(state)) {
        return NextResponse.json({ error: "Filtro inválido." }, { status: 400 });
    }

    const page = devPage(params);
    try {
        const [rows, count, pending] = await Promise.all([
            query<{
                id: string; reply_text: string; review_status: string; session_name: string;
                created_at: string; customer_name: string | null; phone: string | null;
                restaurant_name: string | null; inbound_message: string | null;
            }>(
                "SELECT d.id, d.reply_text, d.review_status, d.session_name, d.created_at, " +
                "c.customer_name, c.phone, r.name AS restaurant_name, m.body AS inbound_message " +
                "FROM support_ai_reply_drafts d " +
                "LEFT JOIN support_conversations c ON c.id=d.conversation_id " +
                "OR (d.conversation_id IS NULL AND c.chat_id=CASE WHEN d.session_name='imenu-blast' " +
                "THEN 'imenu-blast:' || d.chat_id ELSE d.chat_id END) " +
                "LEFT JOIN restaurants r ON r.id=c.restaurant_id " +
                "LEFT JOIN support_messages m ON m.id=d.trigger_message_id AND m.direction='inbound' " +
                "WHERE d.review_status=$1 ORDER BY d.created_at DESC,d.id DESC LIMIT $2 OFFSET $3",
                [state, DEV_PAGE_SIZE, page * DEV_PAGE_SIZE]
            ),
            query<{ total: number }>(
                "SELECT COUNT(*)::int AS total FROM support_ai_reply_drafts WHERE review_status=$1", [state]
            ),
            query<{ total: number }>(
                "SELECT COUNT(*)::int AS total FROM support_ai_reply_drafts WHERE review_status='pending'"
            ),
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

    let body: { id?: unknown; action?: unknown; text?: unknown };
    try { body = await request.json(); }
    catch { return NextResponse.json({ error: "Requisição inválida." }, { status: 400 }); }
    if (typeof body?.id !== "string" || !UUID.test(body.id)) {
        return NextResponse.json({ error: "Resposta inválida." }, { status: 400 });
    }

    try {
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
        } else if (body.action === "approve" || body.action === "reject") {
            changed = await query(
                "UPDATE support_ai_reply_drafts SET review_status=$2, updated_at=NOW() " +
                "WHERE id=$1 AND review_status='pending' RETURNING id",
                [body.id, body.action === "approve" ? "approved" : "rejected"]
            );
        } else {
            return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
        }

        if (!changed.rowCount) {
            return NextResponse.json({ error: "A resposta não está mais pendente." }, { status: 409 });
        }
        // Approval is a review flag only. This route never sends WhatsApp messages.
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error("[SUPPORT_DRAFTS] update failed:", error);
        return NextResponse.json({ error: "Não foi possível atualizar a resposta." }, { status: 500 });
    }
}
