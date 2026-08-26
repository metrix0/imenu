import { query, withTransaction } from "@/lib/database/sql";
import {
    sendWahaList,
    sendWahaText,
    type WahaListRow,
} from "@/lib/services/wahaClient";

type RestaurantAutomationData = {
    id: string;
    name: string;
    url_slug: string;
    min_order_cents: number | null;
    delivery_fee_json: unknown;
    allowed_payment_methods: string[] | null;
    pickup_enabled: boolean | null;
};

type ConversationRow = {
    mode: "bot" | "human";
    human_until: string | null;
    last_inbound_at: string | null;
};

type OrderStatusRow = {
    id: string;
    display_id: number | null;
    status: string;
    is_delivery: boolean | string | null;
    created_at: string;
};

type BotFlow =
    | "menu"
    | "order_status"
    | "delivery"
    | "payment"
    | "handoff";

type ConversationState = "human" | "welcome" | "continue";

type PreparedConversation = {
    state: ConversationState;
    burstContinuation: boolean;
    lastInboundAt: number | null;
};

const HUMAN_HANDOFF_MINUTES = 30;
const BOT_SESSION_MINUTES = 30;
const INBOUND_BURST_MS = 1800;
const MAX_BURST_SETTLE_CHECKS = 4;
const MENU_SEND_ATTEMPTS = 3;
const MENU_RETRY_DELAY_MS = 300;

const MENU_ROWS: WahaListRow[] = [
    { title: "Ver o cardápio", rowId: "menu" },
    { title: "Onde está meu pedido?", rowId: "order_status" },
    { title: "Entrega e retirada", rowId: "delivery" },
    { title: "Formas de pagamento", rowId: "payment" },
    { title: "Falar com atendente", rowId: "handoff" },
];

const PAYMENT_LABELS: Record<string, string> = {
    pix: "Pix online",
    "pix-entrega": "Pix na entrega",
    dinheiro: "Dinheiro",
    "trazer-maquininha": "Cartão na maquininha",
};

const FLOW_BY_TEXT = new Map<string, BotFlow>([
    ["1", "menu"],
    ["menu", "menu"],
    ["ver o cardapio", "menu"],
    ["cardapio", "menu"],
    ["fazer pedido", "menu"],
    ["quero pedir", "menu"],

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

function formatCurrency(cents: number | null | undefined): string {
    return ((Number(cents) || 0) / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function getOrderingUrl(slug: string): string {
    const base =
        process.env.IMENU_PUBLIC_URL?.trim().replace(/\/+$/, "") ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : "");

    if (!base) {
        throw new Error("IMENU_PUBLIC_URL is not configured");
    }

    return `${base}/${encodeURIComponent(slug)}`;
}

async function getRestaurant(
    restaurantId: string
): Promise<RestaurantAutomationData | null> {
    const result = await query<RestaurantAutomationData>(
        `
            SELECT
                id,
                name,
                url_slug,
                min_order_cents,
                delivery_fee_json,
                allowed_payment_methods,
                pickup_enabled
            FROM restaurants
            WHERE id = $1
            LIMIT 1
        `,
        [restaurantId]
    );

    return result.rows[0] || null;
}

async function getConversation(
    restaurantId: string,
    chatId: string
): Promise<ConversationRow | null> {
    const result = await query<ConversationRow>(
        `
            SELECT mode, human_until, last_inbound_at
            FROM whatsapp_conversations
            WHERE restaurant_id = $1
              AND chat_id = $2
            LIMIT 1
        `,
        [restaurantId, chatId]
    );

    return result.rows[0] || null;
}

async function handoffConversation(
    restaurantId: string,
    chatId: string,
    ownerMessage = false
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
            VALUES (
                $1,
                $2,
                'human',
                NOW() + ($3 * INTERVAL '1 minute'),
                CASE WHEN $4 THEN NOW() ELSE NULL END,
                NOW()
            )
            ON CONFLICT (restaurant_id, chat_id)
            DO UPDATE SET
                mode = 'human',
                human_until = NOW() + ($3 * INTERVAL '1 minute'),
                last_owner_message_at = CASE
                    WHEN $4 THEN NOW()
                    ELSE whatsapp_conversations.last_owner_message_at
                END,
                updated_at = NOW()
        `,
        [restaurantId, chatId, HUMAN_HANDOFF_MINUTES, ownerMessage]
    );
}

function isConversationWithOwner(conversation: ConversationRow | null): boolean {
    if (!conversation || conversation.mode !== "human") return false;
    if (!conversation.human_until) return true;

    const humanUntil = new Date(conversation.human_until).getTime();
    return Number.isFinite(humanUntil) && humanUntil > Date.now();
}

async function canBotRespond(
    restaurantId: string,
    chatId: string
): Promise<boolean> {
    const conversation = await getConversation(restaurantId, chatId);
    return !isConversationWithOwner(conversation);
}

function getConversationTimestamp(value: string | null | undefined): number | null {
    if (!value) return null;

    const timestamp = new Date(value).getTime();
    return Number.isFinite(timestamp) ? timestamp : null;
}

function hasSessionExpired(conversation: ConversationRow | null): boolean {
    const lastInbound = getConversationTimestamp(conversation?.last_inbound_at);
    if (lastInbound === null) return true;

    return Date.now() - lastInbound >= BOT_SESSION_MINUTES * 60_000;
}

function sleep(milliseconds: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, milliseconds));
}

async function prepareConversation(
    restaurantId: string,
    chatId: string
): Promise<PreparedConversation> {
    return withTransaction(async (client) => {
        // Serialize only this restaurant/chat while deciding who owns a burst.
        // This prevents two concurrent webhook requests from both welcoming.
        await client.query(
            "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            [`${restaurantId}:${chatId}`]
        );

        const previousResult = await client.query<ConversationRow>(
            `
                SELECT mode, human_until, last_inbound_at
                FROM whatsapp_conversations
                WHERE restaurant_id = $1
                  AND chat_id = $2
                LIMIT 1
            `,
            [restaurantId, chatId]
        );

        const previous = previousResult.rows[0] || null;
        const humanActive = isConversationWithOwner(previous);
        const expiredHumanHandoff =
            previous?.mode === "human" && !humanActive;
        const shouldWelcome =
            !previous || expiredHumanHandoff || hasSessionExpired(previous);

        const previousInboundAt = getConversationTimestamp(
            previous?.last_inbound_at
        );
        const burstContinuation =
            !humanActive &&
            !shouldWelcome &&
            previousInboundAt !== null &&
            Date.now() - previousInboundAt < INBOUND_BURST_MS;

        const touchedResult = await client.query<ConversationRow>(
            `
                INSERT INTO whatsapp_conversations (
                    restaurant_id,
                    chat_id,
                    mode,
                    last_inbound_at,
                    updated_at
                )
                VALUES ($1, $2, 'bot', NOW(), NOW())
                ON CONFLICT (restaurant_id, chat_id)
                DO UPDATE SET
                    last_inbound_at = NOW(),
                    updated_at = NOW(),
                    mode = CASE
                        WHEN whatsapp_conversations.mode = 'human'
                         AND whatsapp_conversations.human_until > NOW()
                            THEN 'human'
                        ELSE 'bot'
                    END,
                    human_until = CASE
                        WHEN whatsapp_conversations.mode = 'human'
                         AND whatsapp_conversations.human_until > NOW()
                            THEN whatsapp_conversations.human_until
                        ELSE NULL
                    END
                RETURNING mode, human_until, last_inbound_at
            `,
            [restaurantId, chatId]
        );

        const lastInboundAt = getConversationTimestamp(
            touchedResult.rows[0]?.last_inbound_at
        );

        if (humanActive) {
            return {
                state: "human",
                burstContinuation: false,
                lastInboundAt,
            };
        }

        return {
            state: shouldWelcome ? "welcome" : "continue",
            burstContinuation,
            lastInboundAt,
        };
    });
}

async function waitForInboundBurstToSettle(
    restaurantId: string,
    chatId: string,
    initialLastInboundAt: number | null
): Promise<boolean> {
    let observedLastInboundAt = initialLastInboundAt;

    for (let attempt = 0; attempt < MAX_BURST_SETTLE_CHECKS; attempt += 1) {
        await sleep(INBOUND_BURST_MS);

        const conversation = await getConversation(restaurantId, chatId);
        if (isConversationWithOwner(conversation)) return false;

        const currentLastInboundAt = getConversationTimestamp(
            conversation?.last_inbound_at
        );

        if (currentLastInboundAt === observedLastInboundAt) {
            return true;
        }

        observedLastInboundAt = currentLastInboundAt;
    }

    return true;
}

function parseDeliveryRules(value: unknown): Array<{
    radius_km: number;
    time_minutes: number;
    fee_cents: number | null;
}> {
    if (!Array.isArray(value)) return [];

    return value
        .map((rule) => {
            const current = rule as Record<string, unknown>;
            return {
                radius_km: Number(current.radius_km),
                time_minutes: Number(current.time_minutes),
                fee_cents:
                    current.fee_cents === null ||
                    current.fee_cents === undefined
                        ? null
                        : Number(current.fee_cents),
            };
        })
        .filter(
            (rule) =>
                Number.isFinite(rule.radius_km) &&
                Number.isFinite(rule.time_minutes)
        )
        .sort((first, second) => first.radius_km - second.radius_km);
}

function buildGreetingMessage(restaurant: RestaurantAutomationData): string {
    return [
        `Olá! 👋 Sou o atendimento automático do *${restaurant.name}*.`,
        "Posso enviar o cardápio, consultar o status do seu pedido e explicar entrega, retirada e pagamentos.",
        "",
        `Pedido online: ${getOrderingUrl(restaurant.url_slug)}`,
        "",
        "Para atendimento humano, escolha *Falar com atendente* ou escreva *atendente*.",
    ].join("\n");
}

async function sendMainMenu(
    restaurantId: string,
    sessionName: string,
    chatId: string
): Promise<void> {
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MENU_SEND_ATTEMPTS; attempt += 1) {
        if (!(await canBotRespond(restaurantId, chatId))) return;

        try {
            await sendWahaList(sessionName, chatId, MENU_ROWS);
            return;
        } catch (error) {
            lastError = error;

            if (attempt < MENU_SEND_ATTEMPTS - 1) {
                await sleep(MENU_RETRY_DELAY_MS * (attempt + 1));
            }
        }
    }

    console.warn(
        "[WHATSAPP_AUTOMATION] WhatsApp list failed after retries:",
        lastError
    );
}

async function sendWelcome(
    restaurantId: string,
    sessionName: string,
    chatId: string,
    restaurant: RestaurantAutomationData
): Promise<void> {
    if (!(await canBotRespond(restaurantId, chatId))) return;

    await sendWahaText(sessionName, chatId, buildGreetingMessage(restaurant));
    await sendMainMenu(restaurantId, sessionName, chatId);
}

function buildMenuLinkMessage(restaurant: RestaurantAutomationData): string {
    return [
        `🍽️ *Cardápio — ${restaurant.name}*`,
        "Veja o cardápio e faça seu pedido aqui:",
        getOrderingUrl(restaurant.url_slug),
    ].join("\n");
}

function buildDeliveryMessage(restaurant: RestaurantAutomationData): string {
    const rules = parseDeliveryRules(restaurant.delivery_fee_json);
    const lines = [`🛵 *Entrega e retirada — ${restaurant.name}*`];

    if (rules.length) {
        for (const rule of rules.slice(0, 8)) {
            const fee =
                rule.fee_cents === null
                    ? "taxa calculada no pedido"
                    : formatCurrency(rule.fee_cents);
            lines.push(
                `• Até ${rule.radius_km.toLocaleString("pt-BR")} km: ${fee} · cerca de ${rule.time_minutes} min`
            );
        }
    } else {
        lines.push("• A taxa e o prazo são calculados pelo endereço no pedido.");
    }

    if (Number(restaurant.min_order_cents) > 0) {
        lines.push(
            `• Pedido mínimo: ${formatCurrency(restaurant.min_order_cents)}`
        );
    }

    lines.push(
        restaurant.pickup_enabled
            ? "• Retirada no local está disponível."
            : "• Retirada no local não está disponível neste momento.",
        "",
        `Confira a opção exata no pedido: ${getOrderingUrl(restaurant.url_slug)}`
    );

    return lines.join("\n");
}

function buildPaymentMessage(restaurant: RestaurantAutomationData): string {
    const methods = Array.isArray(restaurant.allowed_payment_methods)
        ? restaurant.allowed_payment_methods
        : [];
    const labels = methods.map((method) => PAYMENT_LABELS[method] || method);

    return [
        `💳 *Pagamentos — ${restaurant.name}*`,
        labels.length
            ? `Aceitamos: ${labels.join(", ")}.`
            : "As formas disponíveis aparecem na finalização do pedido.",
        "",
        `Faça o pedido aqui: ${getOrderingUrl(restaurant.url_slug)}`,
    ].join("\n");
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
            SELECT
                id,
                display_id,
                status,
                is_delivery,
                created_at
            FROM orders
            WHERE restaurant_id = $1
              AND regexp_replace(
                    COALESCE(customer_phone, ''),
                    '[^0-9]',
                    '',
                    'g'
                  ) = ANY($2::text[])
              AND created_at >= NOW() - INTERVAL '7 days'
            ORDER BY
                CASE
                    WHEN status IN (
                        'pending_online_payment',
                        'pending_physical_payment',
                        'preparing',
                        'delivering'
                    ) THEN 0
                    ELSE 1
                END,
                created_at DESC
            LIMIT 1
        `,
        [restaurantId, phoneCandidates]
    );

    return result.rows[0] || null;
}

function isPickup(value: unknown): boolean {
    if (value === false) return true;

    const normalized = normalize(value);
    return ["retirada", "pickup", "false", "0"].includes(normalized);
}

function getOrderStatusLabel(order: OrderStatusRow): string {
    const pickup = isPickup(order.is_delivery);
    const labels: Record<string, string> = {
        pending_online_payment: "aguardando a confirmação do pagamento online",
        pending_physical_payment: "recebido e aguardando o preparo",
        preparing: "em preparo 👨‍🍳",
        delivering: pickup
            ? "pronto para retirada ✅"
            : "a caminho da entrega 🛵",
        done: pickup ? "retirado ✅" : "entregue ✅",
        canceled: "cancelado ❌",
    };

    return labels[order.status] || order.status;
}

async function buildOrderStatusMessage(
    restaurant: RestaurantAutomationData,
    chatId: string
): Promise<string> {
    const order = await getLatestOrder(restaurant.id, chatId);

    if (!order) {
        return [
            `🔎 *Status do pedido — ${restaurant.name}*`,
            "Não encontrei um pedido recente vinculado a este número de WhatsApp.",
            "Caso tenha usado outro número ou precise de ajuda, escolha *Falar com atendente*.",
        ].join("\n");
    }

    return [
        `🔎 *Status do pedido — ${restaurant.name}*`,
        `Pedido *#${
            order.display_id ?? order.id.slice(0, 4).toUpperCase()
        }*: ${getOrderStatusLabel(order)}.`,
    ].join("\n");
}

function detectFlow(value: unknown): BotFlow | null {
    const raw = String(value ?? "").trim();
    const normalized = normalize(raw);
    const direct = FLOW_BY_TEXT.get(normalized);
    if (direct) return direct;

    // Some WAHA/GOWS list replies expose the visible title together with the
    // old description. Matching the first line keeps the flow deterministic.
    const firstLine = normalize(raw.split(/\r?\n/)[0]);
    const firstLineFlow = FLOW_BY_TEXT.get(firstLine);
    if (firstLineFlow) return firstLineFlow;

    const deterministicPrefixes: Array<[string, BotFlow]> = [
        ["ver o cardapio", "menu"],
        ["onde esta meu pedido", "order_status"],
        ["entrega e retirada", "delivery"],
        ["formas de pagamento", "payment"],
        ["falar com atendente", "handoff"],
    ];

    return (
        deterministicPrefixes.find(([prefix]) =>
            normalized.startsWith(`${prefix} `)
        )?.[1] || null
    );
}

async function answerFlow({
    flow,
    restaurant,
    restaurantId,
    sessionName,
    chatId,
}: {
    flow: BotFlow;
    restaurant: RestaurantAutomationData;
    restaurantId: string;
    sessionName: string;
    chatId: string;
}): Promise<void> {
    if (flow === "handoff") {
        await handoffConversation(restaurantId, chatId);
        await sendWahaText(
            sessionName,
            chatId,
            "Certo — a conversa ficará com a equipe do restaurante pelos próximos 30 minutos. O bot não responderá durante esse período."
        );
        return;
    }

    let message: string;

    if (flow === "menu") {
        message = buildMenuLinkMessage(restaurant);
    } else if (flow === "order_status") {
        message = await buildOrderStatusMessage(restaurant, chatId);
    } else if (flow === "delivery") {
        message = buildDeliveryMessage(restaurant);
    } else {
        message = buildPaymentMessage(restaurant);
    }

    if (!(await canBotRespond(restaurantId, chatId))) return;

    await sendWahaText(sessionName, chatId, message);
    await sendMainMenu(restaurantId, sessionName, chatId);
}

export async function markOwnerTookOverConversation({
    restaurantId,
    chatId,
}: {
    restaurantId: string;
    chatId: string;
}): Promise<void> {
    await handoffConversation(restaurantId, chatId, true);
}

export async function processIncomingWhatsAppMessage({
    restaurantId,
    sessionName,
    chatId,
    body,
    hasMedia,
}: {
    restaurantId: string;
    sessionName: string;
    chatId: string;
    body: string;
    hasMedia: boolean;
}): Promise<void> {
    const prepared = await prepareConversation(restaurantId, chatId);
    if (prepared.state === "human" || prepared.burstContinuation) return;

    const shouldContinue = await waitForInboundBurstToSettle(
        restaurantId,
        chatId,
        prepared.lastInboundAt
    );
    if (!shouldContinue) return;

    const restaurant = await getRestaurant(restaurantId);
    if (!restaurant) return;

    if (prepared.state === "welcome") {
        await sendWelcome(restaurantId, sessionName, chatId, restaurant);
        return;
    }

    if (hasMedia && !normalize(body)) {
        if (!(await canBotRespond(restaurantId, chatId))) return;

        await sendWahaText(
            sessionName,
            chatId,
            "Não consigo analisar arquivos automaticamente. Escolha *Falar com atendente* para enviar isso à equipe."
        );
        await sendMainMenu(restaurantId, sessionName, chatId);
        return;
    }

    const flow = detectFlow(body);
    if (!flow) {
        await sendMainMenu(restaurantId, sessionName, chatId);
        return;
    }

    await answerFlow({
        flow,
        restaurant,
        restaurantId,
        sessionName,
        chatId,
    });
}

// Kept for compatibility with deployments that still send queued poll events.
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
    });
}

// Kept for compatibility with deployments that still send queued poll failures.
export async function processWhatsAppMenuVoteFailed({
    restaurantId,
    sessionName,
    chatId,
}: {
    restaurantId: string;
    sessionName: string;
    chatId: string;
}): Promise<void> {
    const prepared = await prepareConversation(restaurantId, chatId);
    if (prepared.state === "human" || prepared.burstContinuation) return;

    const shouldContinue = await waitForInboundBurstToSettle(
        restaurantId,
        chatId,
        prepared.lastInboundAt
    );
    if (!shouldContinue) return;

    const restaurant = await getRestaurant(restaurantId);
    if (!restaurant) return;

    if (prepared.state === "welcome") {
        await sendWelcome(restaurantId, sessionName, chatId, restaurant);
        return;
    }

    await sendMainMenu(restaurantId, sessionName, chatId);
}
