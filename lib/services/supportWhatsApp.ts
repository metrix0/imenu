import { query, withAdvisoryLock } from "@/lib/database/sql";
import { generateSupportReply } from "@/lib/services/supportAgent";
import {
    extractWahaPhone,
    getWahaQrCode,
    resolveWahaChatPhone,
    restartWahaSession,
    sendWahaText,
} from "@/lib/services/wahaClient";

export type SupportConnectionRow = {
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

type ConversationRow = {
    id: string;
    chat_id: string;
    phone: string | null;
    customer_name: string | null;
    restaurant_id: string | null;
    mode: "ai" | "human";
};

function normalize(value: unknown): string {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function phoneCandidates(value: string | null): string[] {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return [];

    const values = new Set<string>([digits]);
    if (
        digits.startsWith("55") &&
        (digits.length === 12 || digits.length === 13)
    ) {
        values.add(digits.slice(2));
    } else if (digits.length === 10 || digits.length === 11) {
        values.add("55" + digits);
    }
    return [...values];
}

async function findSingleRestaurantId(
    phone: string | null
): Promise<string | null> {
    const candidates = phoneCandidates(phone);
    if (!candidates.length) return null;

    const result = await query<{ id: string }>(
        "SELECT DISTINCT id FROM restaurants WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ANY($1::text[]) OR regexp_replace(COALESCE(store_whatsapp, ''), '[^0-9]', '', 'g') = ANY($1::text[]) LIMIT 2",
        [candidates]
    );

    return result.rows.length === 1 ? result.rows[0].id : null;
}

export async function getSupportConnectionForSession(
    sessionName: string
): Promise<SupportConnectionRow | null> {
    const result = await query<SupportConnectionRow>(
        "SELECT * FROM support_whatsapp_connection WHERE session_name = $1 LIMIT 1",
        [sessionName]
    );
    return result.rows[0] || null;
}

export async function handleSupportSessionStatus(input: {
    connection: SupportConnectionRow;
    status: string;
    statusData: unknown;
    meId?: unknown;
    pushName?: unknown;
    sourceEventTime?: number | null;
}): Promise<void> {
    const {
        connection,
        status,
        statusData,
        meId,
        pushName,
        sourceEventTime,
    } = input;

    if (sourceEventTime && connection.last_event_at) {
        const lastEventTime = new Date(connection.last_event_at).getTime();
        if (
            Number.isFinite(lastEventTime) &&
            sourceEventTime + 5_000 < lastEventTime
        ) {
            return;
        }
    }

    let qrCode: string | null = null;
    if (status === "SCAN_QR_CODE") {
        qrCode = await getWahaQrCode(connection.session_name);
    }

    await query(
        "UPDATE support_whatsapp_connection SET status = $1, status_data = $2::jsonb, phone = COALESCE($3, phone), push_name = COALESCE($4, push_name), qr_code_data = $5, qr_updated_at = CASE WHEN $5 IS NULL THEN NULL ELSE NOW() END, last_connected_at = CASE WHEN $1 = 'WORKING' THEN NOW() ELSE last_connected_at END, last_disconnected_at = CASE WHEN $1 IN ('FAILED','STOPPED') THEN NOW() ELSE last_disconnected_at END, last_event_at = NOW(), last_error = CASE WHEN $1 = 'FAILED' THEN 'A sessão de suporte não conseguiu se reconectar.' WHEN $1 = 'WORKING' THEN NULL ELSE last_error END, updated_at = NOW() WHERE id = 'default'",
        [
            status,
            JSON.stringify(statusData ?? null),
            meId ? extractWahaPhone(meId) : null,
            typeof pushName === "string" && pushName.trim()
                ? pushName.trim()
                : null,
            qrCode,
        ]
    );

    if (
        (status === "FAILED" || status === "STOPPED") &&
        connection.desired_state === "connected"
    ) {
        const lastRestart = connection.last_restart_at
            ? new Date(connection.last_restart_at).getTime()
            : 0;

        if (Date.now() - lastRestart > 60_000) {
            await query(
                "UPDATE support_whatsapp_connection SET status = 'STARTING', last_restart_at = NOW(), updated_at = NOW() WHERE id = 'default'"
            );

            try {
                await restartWahaSession(connection.session_name);
            } catch (error) {
                console.warn(
                    "[SUPPORT_WHATSAPP] Automatic restart failed:",
                    error
                );
            }
        }
    }
}

async function prepareConversation(input: {
    sessionName: string;
    chatId: string;
    customerName: string | null;
}): Promise<ConversationRow> {
    return withAdvisoryLock("support:" + input.chatId, async () => {
        const resolvedPhone =
            (await resolveWahaChatPhone(input.sessionName, input.chatId)) ||
            String(input.chatId).split("@")[0].replace(/\D/g, "") ||
            null;

        const existing = await query<ConversationRow>(
            "SELECT id, chat_id, phone, customer_name, restaurant_id, mode FROM support_conversations WHERE chat_id = $1 LIMIT 1",
            [input.chatId]
        );

        const current = existing.rows[0] || null;
        const restaurantId =
            current?.restaurant_id ||
            (await findSingleRestaurantId(resolvedPhone));

        if (!current) {
            const inserted = await query<ConversationRow>(
                "INSERT INTO support_conversations (chat_id, phone, customer_name, restaurant_id, mode, last_inbound_at, updated_at) VALUES ($1, $2, $3, $4, 'ai', NOW(), NOW()) RETURNING id, chat_id, phone, customer_name, restaurant_id, mode",
                [
                    input.chatId,
                    resolvedPhone,
                    input.customerName,
                    restaurantId,
                ]
            );
            return inserted.rows[0];
        }

        const updated = await query<ConversationRow>(
            "UPDATE support_conversations SET phone = COALESCE($2, phone), customer_name = COALESCE($3, customer_name), restaurant_id = COALESCE(restaurant_id, $4), last_inbound_at = NOW(), updated_at = NOW() WHERE id = $1 RETURNING id, chat_id, phone, customer_name, restaurant_id, mode",
            [
                current.id,
                resolvedPhone,
                input.customerName,
                restaurantId,
            ]
        );
        return updated.rows[0];
    });
}

function wantsHuman(body: string): boolean {
    const value = normalize(body);
    return [
        "falar com atendente",
        "quero falar com atendente",
        "falar com uma pessoa",
        "quero falar com uma pessoa",
        "atendimento humano",
        "suporte humano",
    ].some((phrase) => value.includes(phrase));
}

async function sendTrackedSupportText(input: {
    conversationId: string;
    sessionName: string;
    chatId: string;
    text: string;
    dedupeKey: string;
    model?: string | null;
    inputTokens?: number | null;
    outputTokens?: number | null;
}): Promise<void> {
    const existing = await query<{
        id: string;
        body: string;
        send_status: string;
    }>(
        "SELECT id, body, send_status FROM support_messages WHERE dedupe_key = $1 LIMIT 1",
        [input.dedupeKey]
    );

    let messageId = existing.rows[0]?.id;
    const body = existing.rows[0]?.body || input.text;

    if (!messageId) {
        const inserted = await query<{ id: string }>(
            "INSERT INTO support_messages (conversation_id, direction, body, dedupe_key, send_status, model, input_tokens, output_tokens) VALUES ($1, 'outbound', $2, $3, 'pending', $4, $5, $6) RETURNING id",
            [
                input.conversationId,
                body,
                input.dedupeKey,
                input.model || null,
                input.inputTokens ?? null,
                input.outputTokens ?? null,
            ]
        );
        messageId = inserted.rows[0].id;
    } else if (existing.rows[0].send_status === "sent") {
        return;
    }

    try {
        await sendWahaText(input.sessionName, input.chatId, body);
        await query(
            "UPDATE support_messages SET send_status = 'sent', error = NULL WHERE id = $1",
            [messageId]
        );
        await query(
            "UPDATE support_conversations SET last_outbound_at = NOW(), updated_at = NOW() WHERE id = $1",
            [input.conversationId]
        );
    } catch (error) {
        await query(
            "UPDATE support_messages SET send_status = 'failed', error = $2 WHERE id = $1",
            [
                messageId,
                error instanceof Error
                    ? error.message.slice(0, 500)
                    : "WAHA send failed",
            ]
        );
        throw error;
    }
}

export async function markSupportHumanTakeover(input: {
    chatId: string;
    body?: string;
}): Promise<void> {
    const result = await query<{ id: string }>(
        "UPDATE support_conversations SET mode = 'human', last_outbound_at = NOW(), updated_at = NOW() WHERE chat_id = $1 RETURNING id",
        [input.chatId]
    );

    const conversationId = result.rows[0]?.id;
    if (conversationId && input.body?.trim()) {
        await query(
            "INSERT INTO support_messages (conversation_id, direction, body, send_status) VALUES ($1, 'outbound', $2, 'sent')",
            [conversationId, input.body.trim()]
        );
    }
}

export async function processSupportIncomingWhatsAppMessage(input: {
    sessionName: string;
    chatId: string;
    body: string;
    hasMedia: boolean;
    messageId: string;
    customerName: string | null;
    botEnabled: boolean;
}): Promise<void> {
    const conversation = await prepareConversation({
        sessionName: input.sessionName,
        chatId: input.chatId,
        customerName: input.customerName,
    });

    await query(
        "INSERT INTO support_messages (conversation_id, direction, body, provider_message_id, send_status) VALUES ($1, 'inbound', $2, $3, 'received') ON CONFLICT (provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING",
        [
            conversation.id,
            input.body.trim() ||
                (input.hasMedia ? "[Mídia enviada]" : "[Mensagem vazia]"),
            input.messageId,
        ]
    );

    if (conversation.mode === "human" || !input.botEnabled) return;

    if (wantsHuman(input.body)) {
        await query(
            "UPDATE support_conversations SET mode = 'human', updated_at = NOW() WHERE id = $1",
            [conversation.id]
        );

        await sendTrackedSupportText({
            conversationId: conversation.id,
            sessionName: input.sessionName,
            chatId: input.chatId,
            text: "Certo. Vou deixar esta conversa para o atendimento humano.",
            dedupeKey: input.messageId + ":handoff",
        });
        return;
    }

    if (input.hasMedia && !input.body.trim()) {
        await sendTrackedSupportText({
            conversationId: conversation.id,
            sessionName: input.sessionName,
            chatId: input.chatId,
            text: "Por enquanto, consigo atender melhor por texto. Me conte em uma mensagem o que aconteceu.",
            dedupeKey: input.messageId + ":media",
        });
        return;
    }

    const replyKey = input.messageId + ":ai";
    const existingReply = await query<{
        body: string;
        send_status: string;
    }>(
        "SELECT body, send_status FROM support_messages WHERE dedupe_key = $1 LIMIT 1",
        [replyKey]
    );

    if (existingReply.rows[0]) {
        await sendTrackedSupportText({
            conversationId: conversation.id,
            sessionName: input.sessionName,
            chatId: input.chatId,
            text: existingReply.rows[0].body,
            dedupeKey: replyKey,
        });
        return;
    }

    try {
        const reply = await generateSupportReply(conversation.id);

        await sendTrackedSupportText({
            conversationId: conversation.id,
            sessionName: input.sessionName,
            chatId: input.chatId,
            text: reply.text,
            dedupeKey: replyKey,
            model: reply.model,
            inputTokens: reply.inputTokens,
            outputTokens: reply.outputTokens,
        });
    } catch (error) {
        console.warn("[SUPPORT_WHATSAPP] AI reply failed:", error);

        await query(
            "UPDATE support_conversations SET mode = 'human', updated_at = NOW() WHERE id = $1",
            [conversation.id]
        );

        await sendTrackedSupportText({
            conversationId: conversation.id,
            sessionName: input.sessionName,
            chatId: input.chatId,
            text: "Tive um problema para responder agora. Vou deixar esta conversa para o atendimento humano.",
            dedupeKey: input.messageId + ":ai-fallback",
        });
    }
}
