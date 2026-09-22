import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";
import { releaseExpiredSupportHandoffs } from "@/lib/services/supportWhatsApp";
import {
    ensureWahaSupportSession,
    extractWahaPhone,
    getWahaQrCode,
    getWahaSession,
    logoutWahaSession,
    restartWahaSession,
    sendWahaText,
    SUPPORT_WAHA_SESSION_NAME,
    type WahaSession,
} from "@/lib/services/wahaClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type ConnectionAction =
    | "connect"
    | "reconnect"
    | "refresh_qr"
    | "disconnect";

type SupportConnection = {
    id: string;
    session_name: string;
    desired_state: "connected" | "disconnected";
    status: string;
    status_data: unknown;
    phone: string | null;
    push_name: string | null;
    qr_code_data: string | null;
    qr_updated_at: string | null;
    last_connected_at: string | null;
    last_disconnected_at: string | null;
    last_restart_at: string | null;
    last_event_at: string | null;
    last_error: string | null;
    bot_enabled: boolean;
    updated_at: string;
};

function getBearerToken(request: Request): string | null {
    const authorization = request.headers.get("authorization")?.trim();
    if (!authorization) return null;
    return authorization.match(/^Bearer\s+(.+)$/i)?.[1]?.trim() || null;
}

async function authorizeDevRequest(request: Request): Promise<
    | { ok: true }
    | { ok: false; response: NextResponse }
> {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Não autenticado." },
                { status: 401 }
            ),
        };
    }

    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim();
    const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) {
        throw new Error("Supabase public environment variables are missing.");
    }

    const authClient = createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    const {
        data: { user },
        error,
    } = await authClient.auth.getUser(accessToken);

    if (error || !user) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Sessão inválida ou expirada." },
                { status: 401 }
            ),
        };
    }

    if (user.email?.trim().toLowerCase() !== ALLOWED_DEV_EMAIL) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Acesso negado." },
                { status: 403 }
            ),
        };
    }

    return { ok: true };
}

async function readConnection(): Promise<SupportConnection> {
    const result = await query<SupportConnection>(
        "SELECT * FROM support_whatsapp_connection WHERE id = 'default' LIMIT 1"
    );
    const connection = result.rows[0];
    if (!connection) {
        throw new Error("Support WhatsApp connection row is missing.");
    }
    return connection;
}

async function updateFromWahaSession(
    session: WahaSession
): Promise<SupportConnection> {
    const status = session.status || "STARTING";
    const phone = extractWahaPhone(session.me?.id);
    const qrCode =
        status === "SCAN_QR_CODE"
            ? await getWahaQrCode(SUPPORT_WAHA_SESSION_NAME)
            : null;

    await query(
        "UPDATE support_whatsapp_connection SET desired_state = 'connected', status = $1, status_data = NULL, phone = COALESCE($2, phone), push_name = COALESCE($3, push_name), qr_code_data = $4, qr_updated_at = CASE WHEN $4::text IS NULL THEN NULL ELSE NOW() END, last_connected_at = CASE WHEN $1 = 'WORKING' THEN NOW() ELSE last_connected_at END, last_disconnected_at = CASE WHEN $1 IN ('FAILED','STOPPED') THEN NOW() ELSE last_disconnected_at END, last_event_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = 'default'",
        [
            status,
            phone,
            session.me?.pushName?.trim() || null,
            qrCode,
        ]
    );

    return readConnection();
}

async function getDashboardData() {
    await releaseExpiredSupportHandoffs();

    let connection = await readConnection();

    if (connection.desired_state === "connected") {
        try {
            const session = await getWahaSession(connection.session_name);
            if (session) {
                connection = await updateFromWahaSession(session);
            }
        } catch (error) {
            console.warn(
                "[DEV_SUPPORT] WAHA status check unavailable:",
                error
            );
        }
    }

    const [stats, knowledge, conversations, handedOff] = await Promise.all([
        query<{
            conversations_today: number;
            ai_replies_today: number;
            human_conversations: number;
            knowledge_entries: number;
        }>(
            "SELECT (SELECT COUNT(*)::int FROM support_conversations WHERE created_at >= CURRENT_DATE) AS conversations_today, (SELECT COUNT(*)::int FROM support_messages WHERE direction = 'outbound' AND model IS NOT NULL AND created_at >= CURRENT_DATE) AS ai_replies_today, (SELECT COUNT(*)::int FROM support_conversations WHERE mode = 'human') AS human_conversations, (SELECT COUNT(*)::int FROM support_knowledge WHERE enabled = true) AS knowledge_entries"
        ),
        query<{
            id: string;
            title: string;
            content: string;
            enabled: boolean;
            updated_at: string;
        }>(
            "SELECT id, title, content, enabled, updated_at FROM support_knowledge ORDER BY title ASC"
        ),
        query<{
            id: string;
            phone: string | null;
            customer_name: string | null;
            restaurant_id: string | null;
            restaurant_name: string | null;
            mode: "ai" | "human";
            updated_at: string;
            last_message: string | null;
        }>(
            "SELECT c.id, c.phone, c.customer_name, c.restaurant_id, r.name AS restaurant_name, c.mode, c.updated_at, (SELECT sm.body FROM support_messages sm WHERE sm.conversation_id = c.id ORDER BY sm.created_at DESC LIMIT 1) AS last_message FROM support_conversations c LEFT JOIN restaurants r ON r.id = c.restaurant_id ORDER BY c.updated_at DESC LIMIT 30"
        ),
        query<{
            id: string;
            phone: string | null;
            customer_name: string | null;
            restaurant_id: string | null;
            restaurant_name: string | null;
            mode: "ai" | "human";
            updated_at: string;
            human_started_at: string | null;
            last_human_reply_at: string | null;
            last_message: string | null;
        }>(
            "SELECT c.id, c.phone, c.customer_name, c.restaurant_id, r.name AS restaurant_name, c.mode, c.updated_at, c.human_started_at, c.last_human_reply_at, (SELECT sm.body FROM support_messages sm WHERE sm.conversation_id = c.id ORDER BY sm.created_at DESC LIMIT 1) AS last_message FROM support_conversations c LEFT JOIN restaurants r ON r.id = c.restaurant_id WHERE c.mode = 'human' ORDER BY COALESCE(c.last_human_reply_at, c.human_started_at, c.updated_at) DESC LIMIT 50"
        ),
    ]);

    return {
        connection,
        stats: stats.rows[0],
        knowledge: knowledge.rows,
        conversations: conversations.rows,
        handedOff: handedOff.rows,
    };
}

export async function GET(request: Request) {
    try {
        const authorization = await authorizeDevRequest(request);
        if (!authorization.ok) return authorization.response;

        return NextResponse.json(await getDashboardData(), {
            headers: { "Cache-Control": "no-store" },
        });
    } catch (error) {
        console.error("[DEV_SUPPORT] GET failed:", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível carregar o suporte.",
            },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    let action = "";

    try {
        const authorization = await authorizeDevRequest(request);
        if (!authorization.ok) return authorization.response;

        const body = (await request.json()) as Record<string, unknown>;
        action = String(body.action || "");

        if (
            ["connect", "reconnect", "refresh_qr", "disconnect"].includes(
                action
            )
        ) {
            const connectionAction = action as ConnectionAction;
            const current = await readConnection();

            if (connectionAction === "disconnect") {
                await query(
                    "UPDATE support_whatsapp_connection SET desired_state = 'disconnected', status = 'STOPPED', qr_code_data = NULL, qr_updated_at = NULL, last_disconnected_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = 'default'"
                );

                try {
                    await logoutWahaSession(current.session_name);
                } catch (error) {
                    console.warn(
                        "[DEV_SUPPORT] WAHA logout returned an error:",
                        error
                    );
                }

                return NextResponse.json(await getDashboardData());
            }

            await query(
                "UPDATE support_whatsapp_connection SET desired_state = 'connected', status = 'STARTING', qr_code_data = NULL, qr_updated_at = NULL, last_restart_at = CASE WHEN $1 IN ('reconnect','refresh_qr') THEN NOW() ELSE last_restart_at END, last_error = NULL, updated_at = NOW() WHERE id = 'default'",
                [connectionAction]
            );

            if (connectionAction === "refresh_qr") {
                try {
                    await logoutWahaSession(current.session_name);
                } catch (error) {
                    console.warn(
                        "[DEV_SUPPORT] Old support session was already absent:",
                        error
                    );
                }
            }

            let session: WahaSession;
            if (connectionAction === "reconnect") {
                const existing = await getWahaSession(current.session_name);
                session = existing
                    ? await restartWahaSession(current.session_name)
                    : await ensureWahaSupportSession(current.session_name);
            } else {
                session = await ensureWahaSupportSession(
                    current.session_name
                );
            }

            if (session.status === "STARTING") {
                await new Promise((resolve) => setTimeout(resolve, 700));
                session =
                    (await getWahaSession(current.session_name)) || session;
            }

            await updateFromWahaSession(session);
            return NextResponse.json(await getDashboardData());
        }

        if (action === "send_bulk_message") {
            const batchId = String(body.batchId || "").trim();
            const rawPhone = String(body.phone || "").trim();
            const message = String(body.message || "").trim();
            let phone = rawPhone.replace(/\D/g, "");

            if (phone.startsWith("0055")) phone = phone.slice(2);
            if (phone.startsWith("055") && phone.length >= 13) {
                phone = phone.slice(1);
            }
            if (!phone.startsWith("55") && (phone.length === 10 || phone.length === 11)) {
                phone = "55" + phone;
            }

            if (!batchId || !message || !/^55\d{10,11}$/.test(phone)) {
                return NextResponse.json(
                    { error: "Número, mensagem ou lote inválido." },
                    { status: 400 }
                );
            }

            const localPhone = phone.slice(2);
            const recipients = await query<{
                restaurant_id: string;
            }>(
                `
                    SELECT DISTINCT r.id AS restaurant_id
                    FROM restaurants r
                    LEFT JOIN auth.users u ON u.id = r.user_id
                    WHERE regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g') = ANY($1::text[])
                       OR regexp_replace(COALESCE(r.phone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
                       OR regexp_replace(COALESCE(r.store_whatsapp, ''), '[^0-9]', '', 'g') = ANY($1::text[])
                    LIMIT 2
                `,
                [[phone, localPhone]]
            );

            if (recipients.rows.length === 0) {
                return NextResponse.json(
                    { error: "Número não encontrado em nenhum restaurante." },
                    { status: 404 }
                );
            }

            if (recipients.rows.length > 1) {
                return NextResponse.json(
                    { error: "Número vinculado a mais de um restaurante." },
                    { status: 409 }
                );
            }

            const connection = await readConnection();
            if (
                connection.desired_state !== "connected" ||
                connection.status !== "WORKING"
            ) {
                return NextResponse.json(
                    { error: "WhatsApp de suporte não está conectado." },
                    { status: 503 }
                );
            }

            const restaurantId = recipients.rows[0].restaurant_id;
            const chatId = phone + "@c.us";
            const dedupeKey =
                "support:bulk:" + batchId + ":" + restaurantId;

            const claim = await query(
                "INSERT INTO whatsapp_outbound_messages (dedupe_key, restaurant_id, chat_id, message_type, status, updated_at) VALUES ($1, $2, $3, 'text', 'sending', NOW()) ON CONFLICT (dedupe_key) DO NOTHING RETURNING dedupe_key",
                [dedupeKey, restaurantId, chatId]
            );

            if (claim.rowCount === 0) {
                return NextResponse.json({ ok: true, duplicate: true });
            }

            try {
                await sendWahaText(connection.session_name, chatId, message);
                await query(
                    "UPDATE whatsapp_outbound_messages SET status = 'sent', last_error = NULL, updated_at = NOW() WHERE dedupe_key = $1",
                    [dedupeKey]
                );
                return NextResponse.json({ ok: true });
            } catch (sendError) {
                await query(
                    "UPDATE whatsapp_outbound_messages SET status = 'failed', last_error = $2, updated_at = NOW() WHERE dedupe_key = $1",
                    [
                        dedupeKey,
                        sendError instanceof Error
                            ? sendError.message.slice(0, 500)
                            : "WAHA send failed",
                    ]
                );
                throw sendError;
            }
        }

        if (action === "set_bot_enabled") {
            await query(
                "UPDATE support_whatsapp_connection SET bot_enabled = $1, updated_at = NOW() WHERE id = 'default'",
                [body.enabled === true]
            );
            return NextResponse.json(await getDashboardData());
        }

        if (action === "save_knowledge") {
            const id = String(body.id || "").trim();
            const title = String(body.title || "").trim();
            const content = String(body.content || "").trim();

            if (!title || !content) {
                return NextResponse.json(
                    { error: "Título e conteúdo são obrigatórios." },
                    { status: 400 }
                );
            }

            if (id) {
                await query(
                    "UPDATE support_knowledge SET title = $2, content = $3, enabled = true, updated_at = NOW() WHERE id = $1",
                    [id, title, content]
                );
            } else {
                await query(
                    "INSERT INTO support_knowledge (title, content, enabled) VALUES ($1, $2, true) ON CONFLICT (title) DO UPDATE SET content = EXCLUDED.content, enabled = true, updated_at = NOW()",
                    [title, content]
                );
            }

            return NextResponse.json(await getDashboardData());
        }

        if (action === "delete_knowledge") {
            await query(
                "DELETE FROM support_knowledge WHERE id = $1",
                [String(body.id || "")]
            );
            return NextResponse.json(await getDashboardData());
        }

        if (action === "set_conversation_mode") {
            const mode = String(body.mode || "");
            if (!["ai", "human"].includes(mode)) {
                return NextResponse.json(
                    { error: "Modo inválido." },
                    { status: 400 }
                );
            }

            await query(
                mode === "human"
                    ? "UPDATE support_conversations SET mode = 'human', human_started_at = NOW(), last_human_reply_at = NULL, updated_at = NOW() WHERE id = $1"
                    : "UPDATE support_conversations SET mode = 'ai', human_started_at = NULL, last_human_reply_at = NULL, updated_at = NOW() WHERE id = $1",
                [String(body.id || "")]
            );
            return NextResponse.json(await getDashboardData());
        }

        return NextResponse.json(
            { error: "Ação inválida." },
            { status: 400 }
        );
    } catch (error) {
        console.error("[DEV_SUPPORT] POST failed:", error);

        if (
            ["connect", "reconnect", "refresh_qr"].includes(action)
        ) {
            try {
                await query(
                    "UPDATE support_whatsapp_connection SET status = 'FAILED', last_error = $1, updated_at = NOW() WHERE id = 'default'",
                    [
                        error instanceof Error
                            ? error.message.slice(0, 500)
                            : "Falha ao conectar o WhatsApp.",
                    ]
                );
            } catch {
                // Keep the original error.
            }
        }

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível atualizar o suporte.",
            },
            { status: 500 }
        );
    }
}
