import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { sendOwnerPush } from "@/lib/push/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type Reminder = {
    restaurant_id: string;
    chat_id: string;
    customer_name: string | null;
};

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    try {
        const due = await query<Reminder>(
            `WITH claimed AS (
                SELECT restaurant_id, chat_id
                FROM whatsapp_conversations
                WHERE handoff_requested_at <= NOW() - INTERVAL '5 minutes'
                  AND handoff_requested_at > NOW() - INTERVAL '30 minutes'
                  AND handoff_reminder_sent_at IS NULL
                  AND (last_owner_message_at IS NULL OR
                       last_owner_message_at < handoff_requested_at)
                ORDER BY handoff_requested_at
                LIMIT 20
                FOR UPDATE SKIP LOCKED
            )
            UPDATE whatsapp_conversations AS conversation
            SET handoff_reminder_sent_at = NOW()
            FROM claimed
            WHERE conversation.restaurant_id = claimed.restaurant_id
              AND conversation.chat_id = claimed.chat_id
            RETURNING conversation.restaurant_id, conversation.chat_id,
                      conversation.customer_name`
        );

        const results = await Promise.allSettled(
            due.rows.map((row) =>
                sendOwnerPush(row.restaurant_id, {
                    title: "Atendimento humano pendente ⏰",
                    body: `${row.customer_name || "Um cliente"} ainda aguarda atendimento no WhatsApp.`,
                    url: "/painel/robo-whatsapp#atendimentos-humanos",
                    tag: `whatsapp-handoff-reminder-${row.restaurant_id}-${row.chat_id}`,
                })
            )
        );
        const failed = results.filter((result) => result.status === "rejected");
        for (const failure of failed) {
            if (failure.status === "rejected") {
                console.error("[WHATSAPP_HANDOFF_REMINDER] Push failed:", failure.reason);
            }
        }
        return NextResponse.json({
            due: due.rows.length,
            processed: results.length - failed.length,
            failed: failed.length,
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[WHATSAPP_HANDOFF_REMINDER] Worker failed:", error);
        return NextResponse.json({ error: "Falha ao enviar lembretes." }, { status: 500 });
    }
}
