import { query } from "@/lib/database/sql";
import { sendWahaPoll, sendWahaText } from "@/lib/services/wahaClient";

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

const HUMAN_HANDOFF_MINUTES = 30;
const BOT_SESSION_MINUTES = 30;

const MENU_OPTIONS = [
    "Ver o cardápio",
    "Onde está meu pedido?",
    "Entrega e retirada",
    "Formas de pagamento",
    "Falar com atendente",
] as const;

const PAYMENT_LABELS: Record<string, string> = {
    pix: "Pix online",
    "pix-entrega": "Pix na entrega",
    dinheiro: "Dinheiro",
    "trazer-maquininha": "Cartão na maquininha",
};

const FLOW_BY_TEXT = new Map<string, BotFlow>([
    ["1", "menu"],
    ["ver o cardapio", "menu"],
    ["cardapio", "menu"],
    ["menu", "menu"],
    ["fazer pedido", "menu"],
    ["quero pedir", "menu"],

    ["2", "order_status"],
    ["onde esta meu pedido", "order_status"],
    ["onde esta o meu pedido", "order_status"],
    ["meu pedido", "order_status"],
    ["status do pedido", "order_status"],
    ["acompanhar pedido", "order_status"],

    ["3", "delivery"],
    ["entrega e retirada", "delivery"],
    ["entrega", "delivery"],
    ["retirada", "delivery"],

    ["4", "payment"],
    ["formas de pagamento", "payment"],
    ["forma de pagamento", "payment"],
    ["pagamento", "payment"],
    ["pagamentos", "payment"],

    ["5", "handoff"],
    ["falar com atendente", "handoff"],
    ["atendente", "handoff"],
    ["falar com uma pessoa", "handoff"],
]);

function normalize(value: unknown): string {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
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

async function touchInboundConversation(
    restaurantId: string,
    chatId: string
): Promise<void> {
    await query(
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
        `,
        [restaurantId, chatId]
    );
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

function hasSessionExpired(conversation: ConversationRow | null): boolean {
    if (!conversation?.last_inbound_at) return true;

    const lastInbound = new Date(conversation.last_inbound_at).getTime();
    if (!Number.isFinite(lastInbound)) return true;

    return Date.now() - lastInbound >= BOT_SESSION_MINUTES * 60_000;
}

async function prepareConversation(
    restaurantId: string,
    chatId: string
): Promise<ConversationState> {
    const previous = await getConversation(restaurantId, chatId);
    const humanActive = isConversationWithOwner(previous);
    const expiredHumanHandoff = previous?.mode === "human" && !humanActive;
    const shouldWelcome =
        !previous || expiredHumanHandoff || hasSessionExpired(previous);

    await touchInboundConversation(restaurantId, chatId);

    if (humanActive) return "human";
    return shouldWelcome ? "welcome" : "continue";
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
        "Escolha uma opção abaixo:",
    ].join("\n");
}

function buildTextMenuFallback(): string {
    return [
        "Responda com o número da opção:",
        "1. Ver o cardápio",
        "2. Onde está meu pedido?",
        "3. Entrega e retirada",
        "4. Formas de pagamento",
        "5. Falar com atendente",
    ].join("\n");
}

async function sendMainMenu(sessionName: string, chatId: string): Promise<void> {
    try {
        await sendWahaPoll(
            sessionName,
            chatId,
            "Como posso ajudar?",
            [...MENU_OPTIONS]
        );
    } catch (error) {
        console.warn(
            "[WHATSAPP_AUTOMATION] Interactive menu unavailable; using text fallback:",
            error
        );
        await sendWahaText(sessionName, chatId, buildTextMenuFallback());
    }
}

async function sendWelcome(
    sessionName: string,
    chatId: string,
    restaurant: RestaurantAutomationData
): Promise<void> {
    await sendWahaText(sessionName, chatId, buildGreetingMessage(restaurant));
    await sendMainMenu(sessionName, chatId);
}

function buildMenuLinkMessage(restaurant: RestaurantAutomationData): string {
    return [
        `🍽️ *Cardápio — ${restaurant.name}*`,
        "Veja todos os itens, preços e promoções e faça seu pedido aqui:",
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
        `Pedido *#${order.id.slice(0, 4).toUpperCase()}*: ${getOrderStatusLabel(order)}.`,
    ].join("\n");
}

function detectFlow(value: unknown): BotFlow | null {
    return FLOW_BY_TEXT.get(normalize(value)) || null;
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

    await sendWahaText(sessionName, chatId, message);
    await sendMainMenu(sessionName, chatId);
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
    const state = await prepareConversation(restaurantId, chatId);
    if (state === "human") return;

    const restaurant = await getRestaurant(restaurantId);
    if (!restaurant) return;

    if (state === "welcome") {
        await sendWelcome(sessionName, chatId, restaurant);
        return;
    }

    if (hasMedia && !normalize(body)) {
        await sendWahaText(
            sessionName,
            chatId,
            "Não consigo analisar arquivos automaticamente. Escolha *Falar com atendente* para enviar isso à equipe."
        );
        await sendMainMenu(sessionName, chatId);
        return;
    }

    const flow = detectFlow(body);
    if (!flow) {
        await sendWahaText(
            sessionName,
            chatId,
            "Este atendimento funciona por opções prontas. Escolha uma das alternativas abaixo."
        );
        await sendMainMenu(sessionName, chatId);
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
    const state = await prepareConversation(restaurantId, chatId);
    if (state === "human") return;

    const restaurant = await getRestaurant(restaurantId);
    if (!restaurant) return;

    if (state === "welcome") {
        await sendWelcome(sessionName, chatId, restaurant);
        return;
    }

    const flow = detectFlow(selection);
    if (!flow) {
        await sendMainMenu(sessionName, chatId);
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

export async function processWhatsAppMenuVoteFailed({
    restaurantId,
    sessionName,
    chatId,
}: {
    restaurantId: string;
    sessionName: string;
    chatId: string;
}): Promise<void> {
    const state = await prepareConversation(restaurantId, chatId);
    if (state === "human") return;

    const restaurant = await getRestaurant(restaurantId);
    if (!restaurant) return;

    if (state === "welcome") {
        await sendWelcome(sessionName, chatId, restaurant);
        return;
    }

    await sendWahaText(
        sessionName,
        chatId,
        "Não consegui identificar a opção selecionada. Escolha novamente:"
    );
    await sendMainMenu(sessionName, chatId);
}
