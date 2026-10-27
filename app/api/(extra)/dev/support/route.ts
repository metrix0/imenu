import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import sharp from "sharp";
import { authorize } from "@/lib/dev/authorize";

import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { releaseExpiredSupportHandoffs } from "@/lib/services/supportWhatsApp";
import {
    createSupportBlast, listSupportBlasts, getSupportBlastRecipients,
    setSupportBlastStatus, type BlastRecipientInput,
} from "@/lib/services/supportBlast";
import {
    checkWahaPhoneExists,
    ensureWahaBlastSession,
    ensureWahaSupportSession,
    extractWahaPhone,
    getWahaQrCode,
    getWahaSession,
    logoutWahaSession,
    isWahaHttpErrorStatus,
    restartWahaSession,
    sendWahaText,
    type WahaSession,
} from "@/lib/services/wahaClient";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BULK_SEND_RETRY_DELAY_MS = 1_000;

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

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

async function authorizeDevRequest(request: Request): Promise<
    | { ok: true }
    | { ok: false; response: NextResponse }
> {
    const response = await authorize(request);
    return response ? { ok: false, response } : { ok: true };
}

async function readConnection(
    connectionId = "default"
): Promise<SupportConnection> {
    const result = await query<SupportConnection>(
        "SELECT * FROM support_whatsapp_connection WHERE id = $1 LIMIT 1",
        [connectionId]
    );
    const connection = result.rows[0];
    if (!connection) {
        throw new Error("WhatsApp connection row is missing: " + connectionId);
    }
    return connection;
}

async function updateFromWahaSession(
    session: WahaSession,
    connectionId = "default"
): Promise<SupportConnection> {
    const status = session.status || "STARTING";
    const phone = extractWahaPhone(session.me?.id);
    const qrCode =
        status === "SCAN_QR_CODE"
            ? await getWahaQrCode(session.name)
            : null;

    await query(
        "UPDATE support_whatsapp_connection SET desired_state = 'connected', status = $1, status_data = NULL, phone = COALESCE($2, phone), push_name = COALESCE($3, push_name), qr_code_data = $4, qr_updated_at = CASE WHEN $4::text IS NULL THEN NULL ELSE NOW() END, last_connected_at = CASE WHEN $1 = 'WORKING' THEN NOW() ELSE last_connected_at END, last_disconnected_at = CASE WHEN $1 IN ('FAILED','STOPPED') THEN NOW() ELSE last_disconnected_at END, last_event_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $5",
        [
            status,
            phone,
            session.me?.pushName?.trim() || null,
            qrCode,
            connectionId,
        ]
    );

    return readConnection(connectionId);
}

async function refreshConnection(
    connectionId: "default" | "blast"
): Promise<SupportConnection> {
    let connection = await readConnection(connectionId);

    if (connection.desired_state !== "connected") return connection;

    try {
        let session =
            connectionId === "blast"
                ? await ensureWahaBlastSession(connection.session_name)
                : await getWahaSession(connection.session_name);

        if (session?.status === "STARTING" && connectionId === "blast") {
            await sleep(700);
            session =
                (await getWahaSession(connection.session_name)) || session;
        }

        if (session) {
            connection = await updateFromWahaSession(session, connectionId);
        }
    } catch (error) {
        console.warn(
            "[DEV_SUPPORT] WAHA status check unavailable:",
            connection.session_name,
            error
        );
    }

    return connection;
}

async function getDashboardData() {
    await releaseExpiredSupportHandoffs();

    const [connection, blastConnection] = await Promise.all([
        refreshConnection("default"),
        refreshConnection("blast"),
    ]);

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
        blastConnection,
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

        const searchParams = new URL(request.url).searchParams;
        if (searchParams.get("blast_history") === "1") {
            return NextResponse.json({ campaigns: await listSupportBlasts() });
        }
        const blastId = searchParams.get("blast_id");
        if (blastId && /^[0-9a-f-]{36}$/i.test(blastId)) {
            return NextResponse.json({ recipients: await getSupportBlastRecipients(blastId) });
        }

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
    let connectionId: "default" | "blast" = "default";

    try {
        const authorization = await authorizeDevRequest(request);
        if (!authorization.ok) return authorization.response;

        const form = request.headers.get("content-type")?.startsWith("multipart/form-data")
            ? await request.formData() : null;
        const imagePart = form?.get("image");
        const imageFile = imagePart instanceof File ? imagePart : null;
        const body = form ? {
            action: form.get("action"),
            connection: form.get("connection"),
            message: form.get("message"),
            dailyLimit: form.get("dailyLimit") === "null" ? null : Number(form.get("dailyLimit")),
            skipRecent: form.get("skipRecent") !== "false",
            recipients: JSON.parse(String(form.get("recipients") || "[]")),
        } as Record<string, unknown> : (await request.json()) as Record<string, unknown>;
        action = String(body.action || "");
        const connectionTarget =
            body.connection === "blast" ? "blast" : "support";
        connectionId =
            connectionTarget === "blast" ? "blast" : "default";

        if (action === "create_blast") {
            if (body.dailyLimit === null && !imageFile) {
                return NextResponse.json(
                    { error: "Envios sem cadência devem ser feitos com a aba aberta." },
                    { status: 400 }
                );
            }
            const recipients = Array.isArray(body.recipients)
                ? body.recipients as BlastRecipientInput[] : [];
            const cadence = body.dailyLimit === null ? null : Number(body.dailyLimit);
            const campaignId = randomUUID();
            let imagePath: string | null = null;
            const storage = imageFile ? createSupabaseServerClient().storage.from("support-blast-media") : null;
            try {
                if (imageFile) {
                    if (imageFile.size > 8 * 1024 * 1024 ||
                        !["image/jpeg", "image/png", "image/webp"].includes(imageFile.type)) {
                        throw new Error("Envie uma imagem JPG, PNG ou WebP de até 8 MB.");
                    }
                    const image = await sharp(Buffer.from(await imageFile.arrayBuffer()), {
                        limitInputPixels: 40_000_000,
                    }).rotate().resize(1200, 1200, {
                        fit: "inside", withoutEnlargement: true,
                    }).flatten({ background: "#ffffff" }).jpeg({ quality: 82 }).toBuffer();
                    if (image.length > 2 * 1024 * 1024) {
                        throw new Error("Imagem muito grande após otimização.");
                    }
                    imagePath = `campaigns/${campaignId}.jpg`;
                    const { error: uploadError } = await storage!.upload(imagePath, image, {
                        contentType: "image/jpeg", upsert: false,
                    });
                    if (uploadError) throw uploadError;
                }
                const id = await createSupportBlast({
                    sender: connectionTarget === "blast" ? "blast" : "support",
                    message: String(body.message || ""),
                    dailyLimit: cadence,
                    skipRecent: body.skipRecent !== false,
                    recipients,
                    campaignId,
                    imagePath,
                });
                return NextResponse.json({ ok: true, id });
            } catch (error) {
                if (imagePath && storage) {
                    try {
                        await storage.remove([imagePath]);
                    } catch (cleanupError) {
                        console.warn("[SUPPORT_BLAST] image_cleanup_failed:", cleanupError);
                    }
                }
                return NextResponse.json(
                    { error: error instanceof Error ? error.message : "Falha ao criar envio." },
                    { status: 400 }
                );
            }
        }

        if (action === "set_blast_status") {
            const id = String(body.id || "");
            const nextStatus = String(body.nextStatus || "");
            if (!/^[0-9a-f-]{36}$/i.test(id) ||
                !["pause", "resume", "cancel"].includes(nextStatus)) {
                return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
            }
            try {
                await setSupportBlastStatus(id, nextStatus as "pause" | "resume" | "cancel");
                return NextResponse.json({ ok: true });
            } catch (error) {
                return NextResponse.json(
                    { error: error instanceof Error ? error.message : "Ação indisponível." },
                    { status: 400 }
                );
            }
        }

        if (
            ["connect", "reconnect", "refresh_qr", "disconnect"].includes(
                action
            )
        ) {
            const connectionAction = action as ConnectionAction;
            const current = await readConnection(connectionId);

            if (connectionAction === "disconnect") {
                await query(
                    "UPDATE support_whatsapp_connection SET desired_state = 'disconnected', status = 'STOPPED', qr_code_data = NULL, qr_updated_at = NULL, last_disconnected_at = NOW(), last_error = NULL, updated_at = NOW() WHERE id = $1",
                    [connectionId]
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
                "UPDATE support_whatsapp_connection SET desired_state = 'connected', status = 'STARTING', qr_code_data = NULL, qr_updated_at = NULL, last_restart_at = CASE WHEN $1 IN ('reconnect','refresh_qr') THEN NOW() ELSE last_restart_at END, last_error = NULL, updated_at = NOW() WHERE id = $2",
                [connectionAction, connectionId]
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

            const ensureSession =
                connectionTarget === "blast"
                    ? ensureWahaBlastSession
                    : ensureWahaSupportSession;

            let session: WahaSession;
            if (connectionAction === "reconnect") {
                const existing = await getWahaSession(current.session_name);
                session = existing
                    ? await restartWahaSession(current.session_name)
                    : await ensureSession(current.session_name);
            } else {
                session = await ensureSession(current.session_name);
            }

            if (session.status === "STARTING") {
                await new Promise((resolve) => setTimeout(resolve, 700));
                session =
                    (await getWahaSession(current.session_name)) || session;
            }

            await updateFromWahaSession(session, connectionId);
            return NextResponse.json(await getDashboardData());
        }

        if (action === "send_bulk_message") {
            const batchId = String(body.batchId || "").trim();
            const rawPhone = String(body.phone || "").trim();
            const message = String(body.message || "").trim();
            const skipRecent = body.skipRecent !== false;
            const sender = body.sender === "support" ? "support" : "blast";
            const senderConnectionId =
                sender === "support" ? "default" : "blast";
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
                    ORDER BY r.id
                `,
                [[phone, localPhone]]
            );

            const connection = await refreshConnection(senderConnectionId);
            if (
                connection.desired_state !== "connected" ||
                connection.status !== "WORKING"
            ) {
                return NextResponse.json(
                    {
                        error:
                            sender === "support"
                                ? "WhatsApp de suporte não está conectado."
                                : "WhatsApp Blast não está conectado.",
                    },
                    { status: 503 }
                );
            }

            const restaurantIds = recipients.rows.map(
                (recipient) => recipient.restaurant_id
            );
            const restaurantId = restaurantIds[0] || null;
            const chatId = phone + "@c.us";

            if (skipRecent) {
                const recentlySent = await query(
                    `
                        SELECT 1
                        FROM whatsapp_outbound_messages
                        WHERE dedupe_key LIKE 'support:bulk:%'
                          AND status = 'sent'
                          AND updated_at >= NOW() - INTERVAL '7 days'
                          AND (
                                chat_id = $2
                                OR (
                                    cardinality($1::uuid[]) > 0
                                    AND restaurant_id = ANY($1::uuid[])
                                )
                              )
                        LIMIT 1
                    `,
                    [restaurantIds, chatId]
                );

                if (recentlySent.rowCount > 0) {
                    return NextResponse.json({
                        ok: true,
                        skippedRecent: true,
                    });
                }
            }

            const dedupeKey =
                "support:bulk:" +
                sender +
                ":" +
                batchId +
                ":" +
                (restaurantId || "phone:" + phone);

            const claim = await query(
                "INSERT INTO whatsapp_outbound_messages (dedupe_key, restaurant_id, chat_id, message_type, status, updated_at) VALUES ($1, $2, $3, 'text', 'sending', NOW()) ON CONFLICT (dedupe_key) DO NOTHING RETURNING dedupe_key",
                [dedupeKey, restaurantId, chatId]
            );

            if (claim.rowCount === 0) {
                return NextResponse.json({ ok: true, duplicate: true });
            }

            try {
                const contact = await checkWahaPhoneExists(
                    connection.session_name,
                    phone
                );

                if (!contact.numberExists) {
                    await query(
                        "UPDATE whatsapp_outbound_messages SET status = 'failed', last_error = 'Número não existe no WhatsApp.', updated_at = NOW() WHERE dedupe_key = $1",
                        [dedupeKey]
                    );
                    return NextResponse.json(
                        { error: "Número não existe no WhatsApp." },
                        { status: 404 }
                    );
                }

                const resolvedChatId = contact.chatId || chatId;

                try {
                    await sendWahaText(
                        connection.session_name,
                        resolvedChatId,
                        message
                    );
                } catch (firstSendError) {
                    if (!isWahaHttpErrorStatus(firstSendError, 500)) {
                        throw firstSendError;
                    }

                    await sleep(BULK_SEND_RETRY_DELAY_MS);
                    await sendWahaText(
                        connection.session_name,
                        resolvedChatId,
                        message
                    );
                }

                await query(
                    "UPDATE whatsapp_outbound_messages SET chat_id = $2, status = 'sent', last_error = NULL, updated_at = NOW() WHERE dedupe_key = $1",
                    [dedupeKey, resolvedChatId]
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
                "UPDATE support_whatsapp_connection SET bot_enabled = $1, updated_at = NOW() WHERE id = $2",
                [body.enabled === true, connectionId]
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
                    ? "UPDATE support_conversations SET mode = 'human', followup_state = NULL, human_started_at = NOW(), last_human_reply_at = NULL, updated_at = NOW() WHERE id = $1"
                    : "UPDATE support_conversations SET mode = 'ai', followup_state = NULL, human_started_at = NULL, last_human_reply_at = NULL, updated_at = NOW() WHERE id = $1",
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
                    "UPDATE support_whatsapp_connection SET status = 'FAILED', last_error = $1, updated_at = NOW() WHERE id = $2",
                    [
                        error instanceof Error
                            ? error.message.slice(0, 500)
                            : "Falha ao conectar o WhatsApp.",
                        connectionId,
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
