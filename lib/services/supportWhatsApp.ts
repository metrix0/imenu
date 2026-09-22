import { query, withAdvisoryLock } from "@/lib/database/sql";
import {
    analyzeSupportImage,
    generateSupportReply,
    transcribeSupportAudio,
} from "@/lib/services/supportAgent";
import {
    extractWahaPhone,
    getWahaMessageMedia,
    getWahaQrCode,
    resolveWahaChatPhone,
    restartWahaSession,
    sendWahaText,
    startWahaTyping,
    stopWahaTyping,
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

const BLOCKED_HANDOFF_PHONE = "5511913519119";

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
        "UPDATE support_whatsapp_connection SET status = $1, status_data = $2::jsonb, phone = COALESCE($3, phone), push_name = COALESCE($4, push_name), qr_code_data = $5, qr_updated_at = CASE WHEN $5::text IS NULL THEN NULL ELSE NOW() END, last_connected_at = CASE WHEN $1 = 'WORKING' THEN NOW() ELSE last_connected_at END, last_disconnected_at = CASE WHEN $1 IN ('FAILED','STOPPED') THEN NOW() ELSE last_disconnected_at END, last_event_at = NOW(), last_error = CASE WHEN $1 = 'FAILED' THEN 'A sessão de suporte não conseguiu se reconectar.' WHEN $1 = 'WORKING' THEN NULL ELSE last_error END, updated_at = NOW() WHERE id = 'default'",
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
    if (
        value.includes("nao quero atendente") ||
        value.includes("nao quero humano")
    ) {
        return false;
    }

    return [
        "falar com atendente",
        "quero falar com atendente",
        "falar com uma pessoa",
        "quero falar com uma pessoa",
        "atendimento humano",
        "suporte humano",
        "falar com humano",
        "quero um atendente",
    ].some((phrase) => value.includes(phrase));
}

function isInitialHelpGreeting(body: string): boolean {
    return normalize(body) === "ola preciso de ajuda com o imenu";
}

function getPersonName(value: string | null): string | null {
    const raw = String(value || "").trim();
    if (!raw || raw.length > 60 || /\d/.test(raw)) return null;
    if (/[^\p{L}\s'-]/u.test(raw)) return null;

    const normalized = normalize(raw);
    const businessTerms = [
        "restaurante",
        "pizzaria",
        "hamburgueria",
        "lanchonete",
        "delivery",
        "loja",
        "bar",
        "acai",
        "sushi",
        "burger",
        "cafe",
        "padaria",
        "doceria",
        "confeitaria",
        "marmitaria",
    ];
    if (businessTerms.some((term) => normalized.includes(term))) return null;

    const words = raw.split(/\s+/).filter(Boolean);
    if (words.length < 1 || words.length > 4) return null;

    return words
        .map(
            (word) =>
                word.charAt(0).toLocaleUpperCase("pt-BR") +
                word.slice(1).toLocaleLowerCase("pt-BR")
        )
        .join(" ");
}

function isBlockedHandoffPhone(phone: string | null): boolean {
    return phoneCandidates(phone).includes(BLOCKED_HANDOFF_PHONE);
}

async function previousOutboundMentionedHandoffDelay(
    conversationId: string
): Promise<boolean> {
    const result = await query<{ body: string }>(
        "SELECT body FROM support_messages WHERE conversation_id = $1 AND direction = 'outbound' ORDER BY created_at DESC LIMIT 1",
        [conversationId]
    );

    return normalize(result.rows[0]?.body || "").includes("1 dia util");
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
    const originalBody = input.body.trim();
    let messageBody =
        originalBody ||
        (input.hasMedia ? "[Mídia enviada]" : "[Mensagem vazia]");
    let intentBody = originalBody;
    let mediaProcessingFailed = false;
    let unsupportedMedia = false;

    if (
        input.hasMedia &&
        conversation.mode === "ai" &&
        input.botEnabled
    ) {
        try {
            const media = await getWahaMessageMedia(
                input.sessionName,
                input.chatId,
                input.messageId
            );
            if (!media) {
                throw new Error("WAHA returned no downloadable media");
            }

            if (media.mimetype.startsWith("image/")) {
                const analysis = await analyzeSupportImage(
                    media.data,
                    media.mimetype,
                    originalBody
                );
                messageBody = originalBody
                    ? "[Imagem]\nLegenda: " +
                      originalBody +
                      "\nAnálise: " +
                      analysis
                    : "[Imagem]\n" + analysis;
            } else if (media.mimetype.startsWith("audio/")) {
                const transcription = await transcribeSupportAudio(
                    media.data,
                    media.mimetype,
                    media.filename
                );
                intentBody = transcription;
                messageBody = originalBody
                    ? "[Áudio transcrito]\n" +
                      transcription +
                      "\nLegenda: " +
                      originalBody
                    : "[Áudio transcrito]\n" + transcription;
            } else {
                unsupportedMedia = true;
                messageBody = originalBody
                    ? originalBody +
                      "\n[Mídia não suportada: " +
                      media.mimetype +
                      "]"
                    : "[Mídia não suportada: " + media.mimetype + "]";
            }
        } catch (error) {
            mediaProcessingFailed = true;
            console.warn(
                "[SUPPORT_WHATSAPP] media_processing_failed:",
                error
            );
            messageBody = originalBody
                ? originalBody + "\n[Mídia não pôde ser analisada]"
                : "[Mídia não pôde ser analisada]";
        }
    }

    await query(
        "INSERT INTO support_messages (conversation_id, direction, body, provider_message_id, send_status) VALUES ($1, 'inbound', $2, $3, 'received') ON CONFLICT (provider_message_id) WHERE provider_message_id IS NOT NULL DO NOTHING",
        [conversation.id, messageBody, input.messageId]
    );

    if (conversation.mode === "human" || !input.botEnabled) return;

    const typingPromise = startWahaTyping(input.sessionName, input.chatId).catch(
        (error) => {
            console.warn("[SUPPORT_WHATSAPP] start_typing_failed:", error);
        }
    );

    try {
        if (isInitialHelpGreeting(intentBody)) {
            const personName = getPersonName(
                input.customerName || conversation.customer_name
            );
            const greeting = personName
                ? "Olá, " +
                  personName +
                  "! Sou o assistente virtual do iMenu. Como posso ajudar você hoje?"
                : "Olá! Sou o assistente virtual do iMenu. Como posso ajudar você hoje?";

            await sendTrackedSupportText({
                conversationId: conversation.id,
                sessionName: input.sessionName,
                chatId: input.chatId,
                text: greeting,
                dedupeKey: input.messageId + ":greeting",
            });
            return;
        }

        if (wantsHuman(intentBody)) {
            const alreadyExplained =
                await previousOutboundMentionedHandoffDelay(conversation.id);

            if (isBlockedHandoffPhone(conversation.phone) || !alreadyExplained) {
                await sendTrackedSupportText({
                    conversationId: conversation.id,
                    sessionName: input.sessionName,
                    chatId: input.chatId,
                    text: isBlockedHandoffPhone(conversation.phone)
                        ? "O suporte técnico especial pode levar até 1 dia útil. Neste contato, o encaminhamento não é feito. Qual é sua dúvida?"
                        : "O suporte técnico especial pode levar até 1 dia útil. Qual é sua dúvida? Vou tentar ajudar ou agilizar o suporte.",
                    dedupeKey: input.messageId + ":human-request",
                });
                return;
            }
        }

        if (
            input.hasMedia &&
            !originalBody &&
            (mediaProcessingFailed || unsupportedMedia)
        ) {
            await sendTrackedSupportText({
                conversationId: conversation.id,
                sessionName: input.sessionName,
                chatId: input.chatId,
                text: unsupportedMedia
                    ? "Consigo analisar imagens e áudios, mas ainda não esse tipo de arquivo. Pode explicar por texto?"
                    : "Não consegui analisar essa mídia agora. Pode reenviar ou explicar por texto?",
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

            await sendTrackedSupportText({
                conversationId: conversation.id,
                sessionName: input.sessionName,
                chatId: input.chatId,
                text: "Tive um problema para responder agora. Tente novamente em instantes.",
                dedupeKey: input.messageId + ":ai-fallback",
            });
        }
    } finally {
        await typingPromise;
        try {
            await stopWahaTyping(input.sessionName, input.chatId);
        } catch (error) {
            console.warn("[SUPPORT_WHATSAPP] stop_typing_failed:", error);
        }
    }
}
