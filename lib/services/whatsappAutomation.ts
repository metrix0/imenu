import { query, withAdvisoryLock, withTransaction } from "@/lib/database/sql";
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
    type WahaListRow,
} from "@/lib/services/wahaClient";

type ConversationRow = {
    mode: "bot" | "human";
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
};

type BotFlow =
    | "menu_link"
    | "order_status"
    | "delivery"
    | "payment"
    | "handoff";

type ConversationState = "human" | "welcome" | "continue";

type PreparedConversation = {
    state: ConversationState;
    customerName: string | null;
};

const BOT_SESSION_MINUTES = 30;

const MENU_ROWS: WahaListRow[] = [
    { title: "Ver o cardápio", rowId: "menu_link" },
    { title: "Onde está meu pedido?", rowId: "order_status" },
    { title: "Entrega e retirada", rowId: "delivery" },
    { title: "Formas de pagamento", rowId: "payment" },
    { title: "Falar com atendente", rowId: "handoff" },
];

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
    return !isConversationWithOwner(await getConversation(restaurantId, chatId));
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
            [restaurantId, chatId, customerName]
        );

        return {
            state: humanActive ? "human" : shouldWelcome ? "welcome" : "continue",
            customerName: touched.rows[0]?.customer_name || previous?.customer_name || null,
        };
    });
}

async function handoffConversation(
    restaurantId: string,
    chatId: string,
    ownerMessage: boolean
): Promise<void> {
    await query(
        `
            INSERT INTO whatsapp_conversations (
                restaurant_id,
                chat_id,
                mode,
                human_until,
                last_owner_message_at,
                updated_at
            )
            VALUES ($1, $2, 'human', NULL, CASE WHEN $3 THEN NOW() ELSE NULL END, NOW())
            ON CONFLICT (restaurant_id, chat_id)
            DO UPDATE SET
                mode = 'human',
                human_until = NULL,
                last_owner_message_at = CASE
                    WHEN $3 THEN NOW()
                    ELSE whatsapp_conversations.last_owner_message_at
                END,
                updated_at = NOW()
        `,
        [restaurantId, chatId, ownerMessage]
    );
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
            INSERT INTO whatsapp_outbound_messages (
                dedupe_key,
                restaurant_id,
                chat_id,
                message_type,
                status,
                updated_at
            )
            SELECT $1, $2, $3, $4, 'sending', NOW()
            WHERE $5::boolean
               OR NOT EXISTS (
                    SELECT 1
                    FROM whatsapp_conversations
                    WHERE restaurant_id = $2
                      AND chat_id = $3
                      AND mode = 'human'
                      AND (human_until IS NULL OR human_until > NOW())
               )
            ON CONFLICT (dedupe_key) DO NOTHING
            RETURNING dedupe_key
        `,
        [dedupeKey, restaurantId, chatId, messageType, allowHuman]
    );

    if (Math.random() < 0.02) {
        void query(
            `DELETE FROM whatsapp_outbound_messages
             WHERE created_at < NOW() - INTERVAL '48 hours'`
        ).catch((error) =>
            console.warn("[WHATSAPP_AUTOMATION] Outbound cleanup failed:", error)
        );
    }

    return result.rowCount > 0;
}

async function finishOutboundMessage(
    dedupeKey: string,
    status: "sent" | "failed",
    resultOrError: unknown
): Promise<void> {
    const messageId = status === "sent" ? providerMessageId(resultOrError) : null;
    const errorMessage =
        status === "failed"
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
}): Promise<void> {
    const claimed = await claimOutboundMessage({
        dedupeKey,
        restaurantId,
        chatId,
        messageType: "text",
        allowHuman,
    });
    if (!claimed) return;

    try {
        const response = await sendWahaText(sessionName, chatId, text);
        await finishOutboundMessage(dedupeKey, "sent", response);
        console.info("[WHATSAPP_AUTOMATION] outbound_sent", {
            restaurantId,
            messageType: "text",
        });
    } catch (error) {
        await finishOutboundMessage(dedupeKey, "failed", error);
        throw error;
    }
}

async function sendTrackedMenu({
    dedupeKey,
    restaurantId,
    sessionName,
    chatId,
}: {
    dedupeKey: string;
    restaurantId: string;
    sessionName: string;
    chatId: string;
}): Promise<void> {
    const claimed = await claimOutboundMessage({
        dedupeKey,
        restaurantId,
        chatId,
        messageType: "list",
    });
    if (!claimed) return;

    try {
        const response = await sendWahaList(sessionName, chatId, MENU_ROWS);
        await finishOutboundMessage(dedupeKey, "sent", response);
        console.info("[WHATSAPP_AUTOMATION] outbound_sent", {
            restaurantId,
            messageType: "list",
        });
    } catch (error) {
        await finishOutboundMessage(dedupeKey, "failed", error);
        throw error;
    }
}

function getPhoneCandidates(chatId: string): string[] {
    const digits = String(chatId).split("@")[0].replace(/\D/g, "");
    if (!digits) return [];
    const candidates = new Set<string>([digits]);
    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        candidates.add(digits.slice(2));
    } else if (digits.length === 10 || digits.length === 11) {
        candidates.add(`55${digits}`);
    }
    return [...candidates];
}

async function getLatestOrder(
    restaurantId: string,
    chatId: string
): Promise<OrderStatusRow | null> {
    const phoneCandidates = getPhoneCandidates(chatId);
    if (!phoneCandidates.length) return null;

    const result = await query<OrderStatusRow>(
        `
            SELECT id, display_id, status, is_delivery, customer_name, created_at
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
    const labels: Record<string, string> = {
        pending_online_payment: "aguardando a confirmação do pagamento online",
        pending_physical_payment: "recebido e aguardando o preparo",
        preparing: "em preparo 👨‍🍳",
        delivering: pickup ? "pronto para retirada ✅" : "a caminho da entrega 🛵",
        done: pickup ? "retirado ✅" : "entregue ✅",
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
        ["onde esta meu pedido", "order_status"],
        ["entrega e retirada", "delivery"],
        ["formas de pagamento", "payment"],
        ["falar com atendente", "handoff"],
    ];
    return prefixes.find(([prefix]) => normalized.startsWith(`${prefix} `))?.[1] || null;
}

async function answerFlow({
    flow,
    templates,
    variables,
    restaurantId,
    sessionName,
    chatId,
    inboundMessageId,
}: {
    flow: BotFlow;
    templates: WhatsAppMessageTemplates;
    variables: WhatsAppTemplateVariables;
    restaurantId: string;
    sessionName: string;
    chatId: string;
    inboundMessageId: string;
}): Promise<void> {
    if (flow === "handoff") {
        await handoffConversation(restaurantId, chatId, false);
        await sendTrackedText({
            dedupeKey: `${inboundMessageId}:handoff`,
            restaurantId,
            sessionName,
            chatId,
            text: renderWhatsAppTemplate(templates.handoff, variables),
            allowHuman: true,
        });
        return;
    }

    let template =
        flow === "menu_link"
            ? templates.menu_link
            : flow === "delivery"
              ? templates.delivery
              : flow === "payment"
                ? templates.payment
                : templates.order_status_not_found;
    let flowVariables = variables;
    if (flow === "order_status") {
        const order = await getLatestOrder(restaurantId, chatId);
        if (!order) {
            template = templates.order_status_not_found;
        } else {
            template = templates.order_status_found;
            flowVariables = {
                ...variables,
                NOME_DO_CLIENTE:
                    order.customer_name?.trim() || variables.NOME_DO_CLIENTE,
                NUMERO_DO_PEDIDO: String(
                    order.display_id ?? order.id.slice(0, 4).toUpperCase()
                ),
                STATUS_DO_PEDIDO: getOrderStatusLabel(order),
            };
        }
    }

    await sendTrackedText({
        dedupeKey: `${inboundMessageId}:${flow}`,
        restaurantId,
        sessionName,
        chatId,
        text: renderWhatsAppTemplate(template, flowVariables),
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
    await withAdvisoryLock(`${restaurantId}:${chatId}`, async () => {
        const prepared = await prepareConversation(
            restaurantId,
            chatId,
            customerName
        );
        if (prepared.state === "human") {
            console.info("[WHATSAPP_AUTOMATION] inbound_suppressed_human", {
                restaurantId,
            });
            return;
        }

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
            });
            return;
        }

        if (prepared.state === "welcome") {
            await sendTrackedText({
                dedupeKey: `${messageId}:welcome`,
                restaurantId,
                sessionName,
                chatId,
                text: renderWhatsAppTemplate(templates.welcome, variables),
            });
            if (await canBotRespond(restaurantId, chatId)) {
                await sendTrackedMenu({
                    dedupeKey: `${messageId}:main_menu`,
                    restaurantId,
                    sessionName,
                    chatId,
                });
            }
            return;
        }

        await sendTrackedText({
            dedupeKey: `${messageId}:fallback`,
            restaurantId,
            sessionName,
            chatId,
            text: "Não entendi essa mensagem.",
        });
        await sendTrackedMenu({
            dedupeKey: `${messageId}:main_menu`,
            restaurantId,
            sessionName,
            chatId,
        });
    });
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
