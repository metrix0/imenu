import { handleOrderNotificationReply } from "@/lib/services/whatsappNotification";
import { getCrmReply } from "@/lib/services/crmAutomations";
import { query, withAdvisoryLock, withTransaction } from "@/lib/database/sql";
import { sendOwnerPush } from "@/lib/push/server";
import {
    buildRestaurantTemplateVariables,
    getRestaurantTemplateData,
    getWhatsAppTemplates,
    renderWhatsAppTemplate,
    type WhatsAppMessageTemplates,
    type WhatsAppTemplateVariables,
} from "@/lib/services/whatsappMessageTemplates";
import {
    sendWahaList,
    sendWahaText,
    findWahaSentTextSince,
    resolveWahaChatPhone,
    startWahaTyping,
    stopWahaTyping,
    type WahaListRow,
} from "@/lib/services/wahaClient";

type ConversationRow = {
    mode: "bot" | "human" | "storm";
    human_until: string | null;
    last_inbound_at: string | null;
    customer_name: string | null;
};

type OrderStatusRow = {
    id: string;
    display_id: number | null;
    status: string;
    is_delivery: boolean | string | null;
    customer_name: string | null;
    created_at: string;
    delivery_eta: string | Date | null;
};

type BotFlow =
    | "menu_link"
    | "order_status"
    | "delivery"
    | "payment"
    | "handoff";

type ConversationState = "human" | "storm" | "welcome" | "continue";

type PreparedConversation = {
    state: ConversationState;
    customerName: string | null;
};

const HUMAN_HANDOFF_MINUTES = 30;
const BOT_SESSION_MINUTES = 30;
const CHAT_SEND_LIMIT_PER_MINUTE = 10;
const RESTAURANT_SEND_LIMIT_PER_5_MINUTES = 100;
const FALLBACK_COOLDOWN_SECONDS = 30;
const FALLBACK_SUSPEND_COUNT_5_MINUTES = 3;
const LIST_FAILURE_LIMIT_5_MINUTES = 3;
const STORM_QUIET_SECONDS = 60;
const ORDER_NOT_FOUND_TEXT = "Não encontrei um pedido recente vinculado a este WhatsApp. Para consultar pedidos de outro número, escolha *Falar com atendente*.";
// WAHA can accept a send after our HTTP request times out. Check its history
// a bounded number of times instead of retrying or claiming delivery failed.
const OUTBOUND_CONFIRMATION_DELAYS_MS = [0, 1_500, 2_500, 3_500, 4_500];

const MENU_ROWS: WahaListRow[] = [
    { title: "Ver o cardápio", rowId: "menu_link" },
    { title: "Meu pedido está chegando?", rowId: "order_status" },
    { title: "Entrega e retirada", rowId: "delivery" },
    { title: "Formas de pagamento", rowId: "payment" },
    { title: "Falar com atendente", rowId: "handoff" },
];

const MENU_TEXT = [
    "Escolha uma opção:",
    "",
    ...MENU_ROWS.map((row, index) => `${index + 1}. ${row.title}`),
].join("\n");

const FLOW_BY_TEXT = new Map<string, BotFlow>([
    ["1", "menu_link"],
    ["menu_link", "menu_link"],
    ["ver o cardapio", "menu_link"],
    ["cardapio", "menu_link"],
    ["fazer pedido", "menu_link"],
    ["quero pedir", "menu_link"],
    ["2", "order_status"],
    ["order status", "order_status"],
    ["order_status", "order_status"],
    ["meu pedido esta chegando", "order_status"],
    ["onde esta meu pedido", "order_status"],
    ["onde esta o meu pedido", "order_status"],
    ["meu pedido", "order_status"],
    ["status do pedido", "order_status"],
    ["acompanhar pedido", "order_status"],
    ["3", "delivery"],
    ["delivery", "delivery"],
    ["entrega e retirada", "delivery"],
    ["entrega", "delivery"],
    ["retirada", "delivery"],
    ["4", "payment"],
    ["payment", "payment"],
    ["formas de pagamento", "payment"],
    ["forma de pagamento", "payment"],
    ["pagamento", "payment"],
    ["pagamentos", "payment"],
    ["5", "handoff"],
    ["handoff", "handoff"],
    ["falar com atendente", "handoff"],
    ["atendente", "handoff"],
    ["falar com uma pessoa", "handoff"],
]);

function normalize(value: unknown): string {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9_\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function isExplicitMainMenuRequest(value: unknown): boolean {
    return ["menu", "opcoes", "opcao", "ajuda", "inicio"].includes(
        normalize(value)
    );
}

function isComandaMessage(value: unknown): boolean {
    return normalize(value).includes("comanda imenu");
}

function getComandaOrderId(value: unknown): string | null {
    const match = String(value ?? "").match(
        /c[oó]digo\s+imenu:\s*([0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i
    );
    return match?.[1] || null;
}

function getConversationTimestamp(value: string | null | undefined): number | null {
    if (!value) return null;
    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

function isConversationWithOwner(conversation: ConversationRow | null): boolean {
    if (!conversation || conversation.mode !== "human") return false;
    if (!conversation.human_until) return true;
    const humanUntil = new Date(conversation.human_until).getTime();
    return Number.isFinite(humanUntil) && humanUntil > Date.now();
}

function hasSessionExpired(conversation: ConversationRow | null): boolean {
    const lastInbound = getConversationTimestamp(conversation?.last_inbound_at);
    return (
        lastInbound === null ||
        Date.now() - lastInbound >= BOT_SESSION_MINUTES * 60_000
    );
}

async function getConversation(
    restaurantId: string,
    chatId: string
): Promise<ConversationRow | null> {
    const result = await query<ConversationRow>(
        `
            SELECT mode, human_until, last_inbound_at, customer_name
            FROM whatsapp_conversations
            WHERE restaurant_id = $1 AND chat_id = $2
            LIMIT 1
        `,
        [restaurantId, chatId]
    );
    return result.rows[0] || null;
}

async function canBotRespond(restaurantId: string, chatId: string): Promise<boolean> {
    const conversation = await getConversation(restaurantId, chatId);
    return (
        conversation?.mode !== "storm" &&
        !isConversationWithOwner(conversation)
    );
}

async function prepareConversation(
    restaurantId: string,
    chatId: string,
    customerName: string | null
): Promise<PreparedConversation> {
    return withTransaction(async (client) => {
        const previousResult = await client.query<ConversationRow>(
            `
                SELECT mode, human_until, last_inbound_at, customer_name
                FROM whatsapp_conversations
                WHERE restaurant_id = $1 AND chat_id = $2
                LIMIT 1
            `,
            [restaurantId, chatId]
        );
        const previous = previousResult.rows[0] || null;
        const humanActive = isConversationWithOwner(previous);
        const shouldWelcome = !previous || (!humanActive && hasSessionExpired(previous));

        const touched = await client.query<ConversationRow>(
            `
                INSERT INTO whatsapp_conversations (
                    restaurant_id,
                    chat_id,
                    mode,
                    customer_name,
                    last_inbound_at,
                    updated_at
                )
                VALUES ($1, $2, 'bot', NULLIF($3, ''), NOW(), NOW())
                ON CONFLICT (restaurant_id, chat_id)
                DO UPDATE SET
                    last_inbound_at = NOW(),
                    customer_name = COALESCE(
                        NULLIF(EXCLUDED.customer_name, ''),
                        whatsapp_conversations.customer_name
                    ),
                    mode = CASE
                        WHEN whatsapp_conversations.mode = 'human'
                         AND (
                            whatsapp_conversations.human_until IS NULL
                            OR whatsapp_conversations.human_until > NOW()
                         ) THEN 'human'
                        WHEN whatsapp_conversations.mode = 'storm'
                         AND whatsapp_conversations.last_inbound_at IS NOT NULL
                         AND whatsapp_conversations.last_inbound_at >
                             NOW() - ($4 * INTERVAL '1 second')
                        THEN 'storm'
                        ELSE 'bot'
                    END,
                    human_until = CASE
                        WHEN whatsapp_conversations.mode = 'human'
                         AND (
                            whatsapp_conversations.human_until IS NULL
                            OR whatsapp_conversations.human_until > NOW()
                         ) THEN whatsapp_conversations.human_until
                        ELSE NULL
                    END,
                    updated_at = NOW()
                RETURNING mode, human_until, last_inbound_at, customer_name
            `,
            [restaurantId, chatId, customerName, STORM_QUIET_SECONDS]
        );

        const mode = touched.rows[0]?.mode;
        return {
            state:
                mode === "human"
                    ? "human"
                    : mode === "storm"
                      ? "storm"
                      : shouldWelcome
                        ? "welcome"
                        : "continue",
            customerName: touched.rows[0]?.customer_name || previous?.customer_name || null,
        };
    });
}

async function handoffConversation(
    restaurantId: string,
    chatId: string,
    ownerMessage: boolean,
    phone: string | null = null
): Promise<boolean> {
    const result = await query(
        `
            INSERT INTO whatsapp_conversations (
                restaurant_id,
                chat_id,
                mode,
                human_until,
                last_owner_message_at,
                handoff_requested_at,
                handoff_reminder_sent_at,
                handoff_phone,
                updated_at
            )
            VALUES (
                $1, $2, 'human',
                NOW() + ($3 * INTERVAL '1 minute'),
                CASE WHEN $4 THEN NOW() ELSE NULL END,
                CASE WHEN $4 THEN NULL ELSE NOW() END,
                NULL, $5, NOW()
            )
            ON CONFLICT (restaurant_id, chat_id)
            DO UPDATE SET
                mode = 'human',
                human_until = NOW() + ($3 * INTERVAL '1 minute'),
                last_owner_message_at = CASE
                    WHEN $4 THEN NOW()
                    ELSE whatsapp_conversations.last_owner_message_at
                END,
                handoff_requested_at = CASE
                    WHEN $4 THEN whatsapp_conversations.handoff_requested_at
                    ELSE NOW()
                END,
                handoff_reminder_sent_at = CASE
                    WHEN $4 THEN whatsapp_conversations.handoff_reminder_sent_at
                    ELSE NULL
                END,
                handoff_phone = CASE
                    WHEN $4 THEN whatsapp_conversations.handoff_phone
                    ELSE $5
                END,
                updated_at = NOW()
            WHERE $4 OR whatsapp_conversations.mode <> 'human'
              OR (
                  whatsapp_conversations.human_until IS NOT NULL
                  AND whatsapp_conversations.human_until <= NOW()
              )
        `,
        [restaurantId, chatId, HUMAN_HANDOFF_MINUTES, ownerMessage, phone]
    );
    return !ownerMessage && result.rowCount > 0;
}

function providerMessageId(value: unknown): string | null {
    if (!value || typeof value !== "object") return null;
    const data = value as Record<string, any>;
    const candidate = data.id || data.key?.id || data._data?.key?.id;
    return typeof candidate === "string" && candidate.trim()
        ? candidate.trim()
        : null;
}

async function claimOutboundMessage({
    dedupeKey,
    restaurantId,
    chatId,
    messageType,
    allowHuman = false,
}: {
    dedupeKey: string;
    restaurantId: string;
    chatId: string;
    messageType: "text" | "list";
    allowHuman?: boolean;
}): Promise<boolean> {
    const result = await query(
        `
            WITH recent AS (
                SELECT
                    COUNT(*) FILTER (
                        WHERE chat_id = $3
                          AND created_at >= NOW() - INTERVAL '60 seconds'
                    )::int AS chat_count,
                    COUNT(*) FILTER (
                        WHERE created_at >= NOW() - INTERVAL '5 minutes'
                    )::int AS restaurant_count,
                    COUNT(*) FILTER (
                        WHERE chat_id = $3
                          AND created_at >= NOW() - INTERVAL '${FALLBACK_COOLDOWN_SECONDS} seconds'
                          AND RIGHT(dedupe_key, 9) = ':fallback'
                    )::int AS recent_fallback_count,
                    COUNT(*) FILTER (
                        WHERE chat_id = $3
                          AND created_at >= NOW() - INTERVAL '5 minutes'
                          AND RIGHT(dedupe_key, 9) = ':fallback'
                    )::int AS fallback_count,
                    COUNT(*) FILTER (
                        WHERE chat_id = $3
                          AND created_at >= NOW() - INTERVAL '5 minutes'
                          AND message_type = 'list'
                          AND status = 'failed'
                    )::int AS failed_list_count
                FROM whatsapp_outbound_messages
                WHERE restaurant_id = $2
                  AND created_at >= NOW() - INTERVAL '5 minutes'
            ),
            suspend_chat AS (
                UPDATE whatsapp_conversations
                SET mode = 'storm',
                    human_until = NULL,
                    updated_at = NOW()
                WHERE restaurant_id = $2
                  AND chat_id = $3
                  AND mode <> 'human'
                  AND (
                      (SELECT chat_count FROM recent) >= ${CHAT_SEND_LIMIT_PER_MINUTE}
                      OR (
                          RIGHT($1, 9) = ':fallback'
                          AND (SELECT fallback_count FROM recent) >= ${FALLBACK_SUSPEND_COUNT_5_MINUTES}
                      )
                  )
                RETURNING 1
            )
            INSERT INTO whatsapp_outbound_messages (
                dedupe_key,
                restaurant_id,
                chat_id,
                message_type,
                status,
                updated_at
            )
            SELECT $1, $2, $3, $4, 'sending', NOW()
            FROM recent
            WHERE chat_count < ${CHAT_SEND_LIMIT_PER_MINUTE}
              AND restaurant_count < ${RESTAURANT_SEND_LIMIT_PER_5_MINUTES}
              AND (
                  RIGHT($1, 9) <> ':fallback'
                  OR recent_fallback_count = 0
              )
              AND (
                  $4::text <> 'list'
                  OR failed_list_count < ${LIST_FAILURE_LIMIT_5_MINUTES}
              )
              AND NOT EXISTS (SELECT 1 FROM suspend_chat)
              AND NOT EXISTS (
                  SELECT 1
                  FROM whatsapp_conversations
                  WHERE restaurant_id = $2
                    AND chat_id = $3
                    AND (
                        mode = 'storm'
                        OR (
                            NOT $5::boolean
                            AND mode = 'human'
                            AND (human_until IS NULL OR human_until > NOW())
                        )
                    )
              )
            ON CONFLICT (dedupe_key) DO NOTHING
            RETURNING dedupe_key
        `,
        [dedupeKey, restaurantId, chatId, messageType, allowHuman]
    );

    if (Math.random() < 0.02) {
        void query(
            `DELETE FROM whatsapp_outbound_messages
             WHERE dedupe_key NOT LIKE 'order:%' AND created_at < NOW() - INTERVAL '48 hours' AND (automation_type IS NULL OR automation_type NOT IN ('cart','habit','reactivation'))`
        ).catch((error) =>
            console.warn("[WHATSAPP_AUTOMATION] Outbound cleanup failed:", error)
        );
    }

    return result.rowCount > 0;
}

async function finishOutboundMessage(
    dedupeKey: string,
    status: "sent" | "failed" | "unconfirmed",
    resultOrError: unknown
): Promise<void> {
    const messageId = status === "sent" ? providerMessageId(resultOrError) : null;
    const errorMessage =
        status !== "sent"
            ? resultOrError instanceof Error
                ? resultOrError.message.slice(0, 500)
                : "Falha desconhecida"
            : null;

    await query(
        `
            UPDATE whatsapp_outbound_messages
            SET status = $2,
                provider_message_id = $3,
                last_error = $4,
                updated_at = NOW()
            WHERE dedupe_key = $1
        `,
        [dedupeKey, status, messageId, errorMessage]
    );
}

async function finishOutboundSafely(
    dedupeKey: string,
    status: "sent" | "failed" | "unconfirmed",
    resultOrError: unknown
): Promise<void> {
    try {
        await finishOutboundMessage(dedupeKey, status, resultOrError);
    } catch (error) {
        console.error("[WHATSAPP_AUTOMATION] outbound_tracking_failed", {
            dedupeKey,
            status,
            error,
        });
    }
}

async function sendTrackedText({
    dedupeKey,
    restaurantId,
    sessionName,
    chatId,
    text,
    allowHuman = false,
}: {
    dedupeKey: string;
    restaurantId: string;
    sessionName: string;
    chatId: string;
    text: string;
    allowHuman?: boolean;
}): Promise<boolean> {
    const claimed = await claimOutboundMessage({
        dedupeKey,
        restaurantId,
        chatId,
        messageType: "text",
        allowHuman,
    });
    if (!claimed) return false;

    const startedAt = Date.now();
    try {
        const response = await sendWahaText(sessionName, chatId, text);
        await finishOutboundSafely(dedupeKey, "sent", response);
        console.info("[WHATSAPP_AUTOMATION] outbound_sent", {
            restaurantId,
            messageType: "text",
        });
        return true;
    } catch (error) {
        const timeout = error instanceof Error &&
            (error.name === "TimeoutError" ||
                error.message === "The operation was aborted due to timeout");
        if (timeout) {
            for (const delayMs of OUTBOUND_CONFIRMATION_DELAYS_MS) {
                if (delayMs) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
                try {
                    const confirmation = await findWahaSentTextSince(
                        sessionName, chatId, text, startedAt
                    );
                    if (confirmation) {
                        await finishOutboundSafely(dedupeKey, "sent", confirmation);
                        console.info("[WHATSAPP_AUTOMATION] outbound_confirmed_after_timeout", {
                            restaurantId,
                            messageType: "text",
                        });
                        return true;
                    }
                } catch (lookupError) {
                    console.warn("[WHATSAPP_AUTOMATION] outbound_confirmation_lookup_failed", {
                        restaurantId,
                        error: lookupError,
                    });
                }
            }
            // Unknown delivery is not a failed delivery. Never auto-retry:
            // the original WAHA request may still complete after this point.
            await finishOutboundSafely(dedupeKey, "unconfirmed", error);
            console.warn("[WHATSAPP_AUTOMATION] outbound_delivery_unconfirmed", {
                restaurantId,
                messageType: "text",
            });
            return false;
        }

        await finishOutboundSafely(dedupeKey, "failed", error);
        console.warn("[WHATSAPP_AUTOMATION] outbound_send_failed", {
            restaurantId,
            messageType: "text",
            error,
        });
        return false;
    }
}

async function sendTrackedMenu({
    dedupeKey,
    restaurantId,
    sessionName,
    chatId,
    rows = MENU_ROWS,
}: {
    dedupeKey: string;
    restaurantId: string;
    sessionName: string;
    chatId: string;
    rows?: WahaListRow[];
}): Promise<boolean> {
    const claimed = await claimOutboundMessage({
        dedupeKey,
        restaurantId,
        chatId,
        messageType: "list",
    });
    if (!claimed) return false;

    try {
        const response = await sendWahaList(sessionName, chatId, rows, rows.length === 1 ? {button:rows[0].title} : undefined);
        await finishOutboundSafely(dedupeKey, "sent", response);
        console.info("[WHATSAPP_AUTOMATION] outbound_sent", {
            restaurantId,
            messageType: "list",
        });
        return true;
    } catch (error) {
        if (chatId.endsWith("@lid")) {
            try {
                const response = await sendWahaText(
                    sessionName,
                    chatId,
                    rows.map((row, index) => `${index + 1}. ${row.title}`).join("\n")
                );
                await finishOutboundSafely(dedupeKey, "sent", response);
                console.warn("[WHATSAPP_AUTOMATION] outbound_list_fallback_text", {
                    restaurantId,
                    error,
                });
                return true;
            } catch (fallbackError) {
                await finishOutboundSafely(dedupeKey, "failed", fallbackError);
                console.warn("[WHATSAPP_AUTOMATION] outbound_send_failed", {
                    restaurantId,
                    messageType: "list",
                    error,
                    fallbackError,
                });
                return false;
            }
        }

        await finishOutboundSafely(dedupeKey, "failed", error);
        console.warn("[WHATSAPP_AUTOMATION] outbound_send_failed", {
            restaurantId,
            messageType: "list",
            error,
        });
        return false;
    }
}

function getPhoneCandidates(phone: string | null): string[] {
    const digits = String(phone ?? "").replace(/\D/g, "");
    const local = digits.startsWith("55") && (digits.length === 12 || digits.length === 13)
        ? digits.slice(2)
        : digits;
    if (!/^\d{10,11}$/.test(local)) return [];
    return [local, `55${local}`];
}

async function getLatestOrder(
    restaurantId: string,
    phone: string | null
): Promise<OrderStatusRow | null> {
    const phoneCandidates = getPhoneCandidates(phone);
    if (!phoneCandidates.length) return null;

    const result = await query<OrderStatusRow>(
        `
            SELECT id, display_id, status, is_delivery, customer_name, created_at, delivery_eta
            FROM orders
            WHERE restaurant_id = $1
              AND regexp_replace(COALESCE(customer_phone, ''), '[^0-9]', '', 'g')
                  = ANY($2::text[])
              AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY
                CASE WHEN status IN (
                    'pending_online_payment',
                    'pending_physical_payment',
                    'preparing',
                    'delivering'
                ) THEN 0 ELSE 1 END,
                created_at DESC
            LIMIT 1
        `,
        [restaurantId, phoneCandidates]
    );
    return result.rows[0] || null;
}

function isPickup(value: unknown): boolean {
    if (value === false) return true;
    return ["retirada", "pickup", "false", "0"].includes(normalize(value));
}

function getOrderStatusLabel(order: OrderStatusRow): string {
    const pickup = isPickup(order.is_delivery);
    const counterSale = normalize(order.is_delivery) === "balcao";
    const labels: Record<string, string> = {
        pending_online_payment: "aguardando a confirmação do pagamento online",
        pending_physical_payment: "recebido e aguardando o preparo",
        preparing: "em preparo 👨‍🍳",
        delivering: counterSale ? "pronto no balcão ✅" : pickup ? "pronto para retirada ✅" : "a caminho da entrega 🛵",
        done: counterSale ? "concluído ✅" : pickup ? "retirado ✅" : "entregue ✅",
        canceled: "cancelado ❌",
    };
    return labels[order.status] || order.status;
}

async function orderBelongsToRestaurant(
    restaurantId: string,
    orderId: string
): Promise<boolean> {
    const result = await query(
        `SELECT 1 FROM orders WHERE id = $1 AND restaurant_id = $2 LIMIT 1`,
        [orderId, restaurantId]
    );
    return result.rowCount > 0;
}

function detectFlow(value: unknown): BotFlow | null {
    const raw = String(value ?? "").trim();
    const normalized = normalize(raw);
    const direct = FLOW_BY_TEXT.get(normalized);
    if (direct) return direct;

    const firstLine = normalize(raw.split(/\r?\n/)[0]);
    const firstLineFlow = FLOW_BY_TEXT.get(firstLine);
    if (firstLineFlow) return firstLineFlow;

    const prefixes: Array<[string, BotFlow]> = [
        ["ver o cardapio", "menu_link"],
        ["meu pedido esta chegando", "order_status"],
        ["onde esta meu pedido", "order_status"],
        ["entrega e retirada", "delivery"],
        ["formas de pagamento", "payment"],
        ["falar com atendente", "handoff"],
    ];
    return prefixes.find(([prefix]) => normalized.startsWith(`${prefix} `))?.[1] || null;
}

function getOrderEtaText(order: OrderStatusRow): string {
    if (!order.delivery_eta || ["done", "canceled"].includes(order.status)) return "";
    const center = new Date(order.delivery_eta).getTime();
    if (!Number.isFinite(center)) return "";

    const start = new Date(center - 10 * 60_000);
    const end = new Date(center + 10 * 60_000);
    const date = new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit", month: "2-digit", timeZone: "America/Sao_Paulo",
    }).format(start);
    const clock = new Intl.DateTimeFormat("pt-BR", {
        hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo",
    });
    const pickup = isPickup(order.is_delivery) || normalize(order.is_delivery) === "balcao";
    const label = pickup ? "Previsão de retirada" : "Previsão de entrega";
    const overdue = end.getTime() < Date.now() ? " (horário já ultrapassado)" : "";
    return `\n🕒 ${label}: ${date}, ${clock.format(start)}–${clock.format(end)} (estimativa)${overdue}.`;
}

function renderOrderStatus(order: OrderStatusRow, templates: WhatsAppMessageTemplates, variables: WhatsAppTemplateVariables): string {
    return renderWhatsAppTemplate(templates.order_status_found, {
        ...variables,
        NOME_DO_CLIENTE: order.customer_name?.trim() || variables.NOME_DO_CLIENTE,
        NUMERO_DO_PEDIDO: String(order.display_id ?? order.id.slice(0, 4).toUpperCase()),
        STATUS_DO_PEDIDO: getOrderStatusLabel(order),
    }) + getOrderEtaText(order);
}

async function answerFlow({
    flow,
    templates,
    variables,
    restaurantId,
    sessionName,
    chatId,
    inboundMessageId,
    resolvedPhone,
}: {
    flow: BotFlow;
    templates: WhatsAppMessageTemplates;
    variables: WhatsAppTemplateVariables;
    restaurantId: string;
    sessionName: string;
    chatId: string;
    inboundMessageId: string;
    resolvedPhone: string | null;
}): Promise<void> {
    if (flow === "handoff") {
        let phone: string | null = null;
        try {
            phone = await resolveWahaChatPhone(sessionName, chatId);
        } catch (error) {
            console.warn("[WHATSAPP_AUTOMATION] handoff_phone_lookup_failed", error);
        }
        const newHandoff = await handoffConversation(restaurantId, chatId, false, phone);
        try {
            await sendTrackedText({
                dedupeKey: `${inboundMessageId}:handoff`,
                restaurantId,
                sessionName,
                chatId,
                text: renderWhatsAppTemplate(templates.handoff, variables),
                allowHuman: true,
            });
        } finally {
            // Notify the owner even if WhatsApp rejects the confirmation message.
            if (newHandoff) {
                try {
                    await sendOwnerPush(restaurantId, {
                        title: "Atendimento humano solicitado 🔔",
                        body: `${variables.NOME_DO_CLIENTE || "Um cliente"} precisa de atendimento no WhatsApp.`,
                        url: "/painel/robo-whatsapp#atendimentos-humanos",
                        tag: `whatsapp-handoff-${restaurantId}-${chatId}`,
                    });
                } catch (error) {
                    console.error("[WHATSAPP_AUTOMATION] handoff_push_failed", error);
                }
            }
        }
        return;
    }

    if (flow === "order_status") {
        const order = await getLatestOrder(restaurantId, resolvedPhone);
        await sendTrackedText({
            dedupeKey: `${inboundMessageId}:${flow}`,
            restaurantId,
            sessionName,
            chatId,
            text: order ? renderOrderStatus(order, templates, variables) : ORDER_NOT_FOUND_TEXT,
        });
        return;
    }

    const template = flow === "menu_link"
        ? templates.menu_link
        : flow === "delivery"
          ? templates.delivery
          : templates.payment;
    await sendTrackedText({
        dedupeKey: `${inboundMessageId}:${flow}`,
        restaurantId,
        sessionName,
        chatId,
        text: renderWhatsAppTemplate(template, variables),
    });
}

export async function markOwnerTookOverConversation({
    restaurantId,
    chatId,
}: {
    restaurantId: string;
    chatId: string;
}): Promise<void> {
    await handoffConversation(restaurantId, chatId, true);
    console.info("[WHATSAPP_AUTOMATION] human_takeover", { restaurantId });
}

export async function processIncomingWhatsAppMessage({
    restaurantId,
    sessionName,
    chatId,
    body,
    hasMedia,
    messageId,
    customerName = null,
}: {
    restaurantId: string;
    sessionName: string;
    chatId: string;
    body: string;
    hasMedia: boolean;
    messageId: string;
    customerName?: string | null;
}): Promise<void> {
    const phone = await resolveWahaChatPhone(sessionName, chatId);
    if (phone === "5519997235394" || phone === "19997235394") return;

    const crmReply = await getCrmReply(restaurantId, phone, body);
    const prepared = await withAdvisoryLock(`${restaurantId}:${chatId}`, () =>
        prepareConversation(restaurantId, chatId, customerName)
    );

    if (await handleOrderNotificationReply(restaurantId, sessionName, chatId, body, phone)) return;

    if (prepared.state === "human") {
        console.info("[WHATSAPP_AUTOMATION] inbound_suppressed_human", {
            restaurantId,
        });
        return;
    }

    if (prepared.state === "storm") {
        console.info("[WHATSAPP_AUTOMATION] inbound_suppressed_storm", {
            restaurantId,
        });
        return;
    }

    if (crmReply) {
        const ok = !crmReply.text || await sendTrackedText({dedupeKey:`${messageId}:crm_reply`,restaurantId,sessionName,chatId,text:crmReply.text});
        if (ok) await sendTrackedMenu({dedupeKey:`${messageId}:crm_menu`,restaurantId,sessionName,chatId,rows:crmReply.rows});
        return;
    }

    const typingPromise = startWahaTyping(sessionName, chatId).catch((error) => {
        console.warn("[WHATSAPP_AUTOMATION] start_typing_failed", {
            restaurantId,
            error,
        });
    });

    try {
    const [restaurant, templates] = await Promise.all([
        getRestaurantTemplateData(restaurantId),
        getWhatsAppTemplates(restaurantId),
    ]);
    if (!restaurant) return;

    const variables = buildRestaurantTemplateVariables(restaurant, {
        NOME_DO_CLIENTE: prepared.customerName || customerName || "Cliente",
    });

    if (isComandaMessage(body)) {
        const orderId = getComandaOrderId(body);
        if (!orderId || !(await orderBelongsToRestaurant(restaurantId, orderId))) {
            return;
        }
        await sendTrackedText({
            dedupeKey: `${messageId}:order_tracking`,
            restaurantId,
            sessionName,
            chatId,
            text: renderWhatsAppTemplate(templates.order_tracking, {
                ...variables,
                LINK_DE_ACOMPANHAMENTO: `${variables.LINK_DO_CARDAPIO}/${encodeURIComponent(orderId)}`,
            }),
        });
        return;
    }

    if (hasMedia && !normalize(body)) {
        await sendTrackedText({
            dedupeKey: `${messageId}:unsupported_media`,
            restaurantId,
            sessionName,
            chatId,
            text: renderWhatsAppTemplate(templates.unsupported_media, variables),
        });
        return;
    }

    if (isExplicitMainMenuRequest(body)) {
        await sendTrackedMenu({
            dedupeKey: `${messageId}:main_menu`,
            restaurantId,
            sessionName,
            chatId,
        });
        return;
    }

    const flow = detectFlow(body);
    if (flow) {
        await answerFlow({
            flow,
            templates,
            variables,
            restaurantId,
            sessionName,
            chatId,
            inboundMessageId: messageId,
            resolvedPhone: phone,
        });
        return;
    }

    if (prepared.state === "welcome") {
        const welcomeSent = await sendTrackedText({
            dedupeKey: `${messageId}:welcome`,
            restaurantId,
            sessionName,
            chatId,
            text: renderWhatsAppTemplate(templates.welcome, variables),
        });
        if (welcomeSent && (await canBotRespond(restaurantId, chatId))) {
            await sendTrackedMenu({
                dedupeKey: `${messageId}:main_menu`,
                restaurantId,
                sessionName,
                chatId,
            });
        }
        return;
    }

    const { getWhatsAppAiReply } = await import("@/lib/services/whatsappAi");
    const aiReply = await getWhatsAppAiReply({
        restaurantId, sessionName, chatId, messageId, body, variables,
    });
    if (aiReply) {
        // The owner may have taken over while the model was answering.
        if (!(await canBotRespond(restaurantId, chatId))) return;
        if (aiReply.flow) {
            await answerFlow({
                flow: aiReply.flow, templates, variables, restaurantId,
                sessionName, chatId, inboundMessageId: messageId, resolvedPhone: phone,
            });
        } else {
            await sendTrackedText({
                dedupeKey: `${messageId}:ai`, restaurantId, sessionName, chatId,
                text: aiReply.text,
            });
        }
        return;
    }

    const fallbackSent = await sendTrackedText({
        dedupeKey: `${messageId}:fallback`,
        restaurantId,
        sessionName,
        chatId,
        text: "Não entendi essa mensagem.",
    });
    if (fallbackSent) {
        await sendTrackedMenu({
            dedupeKey: `${messageId}:main_menu`,
            restaurantId,
            sessionName,
            chatId,
        });
    }
    } finally {
        await typingPromise;
        try {
            await stopWahaTyping(sessionName, chatId);
        } catch (error) {
            console.warn("[WHATSAPP_AUTOMATION] stop_typing_failed", {
                restaurantId,
                error,
            });
        }
    }
}

export async function processWhatsAppMenuSelection({
    restaurantId,
    sessionName,
    chatId,
    selection,
}: {
    restaurantId: string;
    sessionName: string;
    chatId: string;
    selection: string;
}): Promise<void> {
    await processIncomingWhatsAppMessage({
        restaurantId,
        sessionName,
        chatId,
        body: selection,
        hasMedia: false,
        messageId: `legacy-selection:${Date.now()}`,
    });
}

export async function processWhatsAppMenuVoteFailed({
    restaurantId,
    sessionName,
    chatId,
}: {
    restaurantId: string;
    sessionName: string;
    chatId: string;
}): Promise<void> {
    await processIncomingWhatsAppMessage({
        restaurantId,
        sessionName,
        chatId,
        body: "menu",
        hasMedia: false,
        messageId: `legacy-menu:${Date.now()}`,
    });
}

