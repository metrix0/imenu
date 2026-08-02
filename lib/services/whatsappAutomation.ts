import { query } from "@/lib/database/sql";
import { sendWahaText } from "@/lib/services/wahaClient";

type RestaurantAutomationData = {
    id: string;
    name: string;
    url_slug: string;
    min_order_cents: number | null;
    delivery_fee_json: unknown;
    allowed_payment_methods: string[] | null;
    pickup_enabled: boolean | null;
};

type MenuRow = {
    name: string;
    description: string | null;
    price_cents: number;
    category_name: string | null;
    promotion_type: "fixed" | "percent" | null;
    promotion_value: number | null;
};

type ConversationRow = {
    mode: "bot" | "human";
    human_until: string | null;
};

const HUMAN_HANDOFF_HOURS = 24;
const MAX_MENU_ITEMS = 30;
const MAX_MESSAGE_LENGTH = 3900;

const PAYMENT_LABELS: Record<string, string> = {
    pix: "Pix online",
    "pix-entrega": "Pix na entrega",
    dinheiro: "Dinheiro",
    "trazer-maquininha": "Cartão na maquininha",
};

const GENERIC_MENU_WORDS = new Set([
    "cardapio",
    "menu",
    "itens",
    "item",
    "opcoes",
    "opcao",
    "produtos",
    "produto",
    "preco",
    "precos",
    "valor",
    "valores",
    "quanto",
    "custa",
    "tem",
    "voces",
    "voces",
    "qual",
    "quais",
    "me",
    "manda",
    "mandar",
    "ver",
    "queria",
    "quero",
    "gostaria",
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

function containsAny(text: string, terms: string[]): boolean {
    return terms.some((term) => text.includes(term));
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

function getEffectivePrice(item: MenuRow): number {
    const price = Number(item.price_cents) || 0;
    const value = Number(item.promotion_value) || 0;

    if (item.promotion_type === "percent" && value > 0) {
        return Math.max(0, Math.round(price * (1 - value / 100)));
    }

    if (item.promotion_type === "fixed" && value > 0) {
        return Math.max(0, price - value);
    }

    return price;
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

async function getLiveMenu(restaurantId: string): Promise<MenuRow[]> {
    const result = await query<MenuRow>(
        `
            SELECT
                items.name,
                items.description,
                items.price_cents,
                categories.name AS category_name,
                active_promotion.type AS promotion_type,
                active_promotion.value AS promotion_value
            FROM items
            LEFT JOIN categories
              ON categories.id = items.category_id
            LEFT JOIN LATERAL (
                SELECT
                    promotions.type,
                    promotions.value
                FROM promotions
                WHERE promotions.item_id = items.id
                  AND promotions.starts_at <= NOW()
                  AND (
                      promotions.ends_at IS NULL
                      OR promotions.ends_at >= NOW()
                  )
                ORDER BY promotions.starts_at DESC
                LIMIT 1
            ) AS active_promotion ON TRUE
            WHERE items.restaurant_id = $1
              AND items.is_available = TRUE
            ORDER BY
                categories.position ASC NULLS LAST,
                items.position ASC,
                items.name ASC
            LIMIT 100
        `,
        [restaurantId]
    );

    return result.rows;
}

async function getConversation(
    restaurantId: string,
    chatId: string
): Promise<ConversationRow | null> {
    const result = await query<ConversationRow>(
        `
            SELECT mode, human_until
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
                NOW() + ($3 * INTERVAL '1 hour'),
                CASE WHEN $4 THEN NOW() ELSE NULL END,
                NOW()
            )
            ON CONFLICT (restaurant_id, chat_id)
            DO UPDATE SET
                mode = 'human',
                human_until = NOW() + ($3 * INTERVAL '1 hour'),
                last_owner_message_at = CASE
                    WHEN $4 THEN NOW()
                    ELSE whatsapp_conversations.last_owner_message_at
                END,
                updated_at = NOW()
        `,
        [restaurantId, chatId, HUMAN_HANDOFF_HOURS, ownerMessage]
    );
}

function isConversationWithOwner(conversation: ConversationRow | null): boolean {
    if (!conversation || conversation.mode !== "human") return false;
    if (!conversation.human_until) return true;
    return new Date(conversation.human_until).getTime() > Date.now();
}

function buildMenuSearchTerms(incomingText: string): string[] {
    return normalize(incomingText)
        .split(" ")
        .filter((word) => word.length >= 3 && !GENERIC_MENU_WORDS.has(word));
}

function buildMenuMessage(
    restaurant: RestaurantAutomationData,
    items: MenuRow[],
    incomingText: string
): string {
    const searchTerms = buildMenuSearchTerms(incomingText);
    const matchingItems = searchTerms.length
        ? items.filter((item) => {
              const haystack = normalize(
                  `${item.name} ${item.description || ""} ${
                      item.category_name || ""
                  }`
              );
              return searchTerms.some((term) => haystack.includes(term));
          })
        : items;

    const selectedItems = (matchingItems.length ? matchingItems : items).slice(
        0,
        MAX_MENU_ITEMS
    );
    const lines: string[] = [`🍽️ *Cardápio — ${restaurant.name}*`];
    let lastCategory = "";

    for (const item of selectedItems) {
        const category = item.category_name || "Outros";
        if (category !== lastCategory) {
            lines.push("", `*${category}*`);
            lastCategory = category;
        }

        const original = Number(item.price_cents) || 0;
        const effective = getEffectivePrice(item);
        const priceText =
            effective < original
                ? `~${formatCurrency(original)}~ ${formatCurrency(effective)}`
                : formatCurrency(effective);

        lines.push(`• ${item.name} — ${priceText}`);
    }

    if (selectedItems.length === 0) {
        lines.push("", "O cardápio não tem itens disponíveis neste momento.");
    } else if (matchingItems.length > selectedItems.length) {
        lines.push("", "Há mais opções no cardápio completo.");
    } else if (searchTerms.length && matchingItems.length === 0) {
        lines.push(
            "",
            "Não encontrei exatamente esse item, então mostrei as opções disponíveis."
        );
    }

    lines.push(
        "",
        "Veja todos os detalhes e faça seu pedido aqui:",
        getOrderingUrl(restaurant.url_slug)
    );

    const message = lines.join("\n");
    return message.length <= MAX_MESSAGE_LENGTH
        ? message
        : `${message.slice(0, MAX_MESSAGE_LENGTH - 4)}...`;
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

function buildDeliveryMessage(restaurant: RestaurantAutomationData): string {
    const rules = parseDeliveryRules(restaurant.delivery_fee_json);
    const lines = [`🛵 *Entrega — ${restaurant.name}*`];

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

    if (restaurant.pickup_enabled) {
        lines.push("• Retirada no local também está disponível.");
    }

    lines.push(
        "",
        "Informe seu endereço e finalize o pedido para ver a opção exata:",
        getOrderingUrl(restaurant.url_slug)
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
        "Faça o pedido aqui:",
        getOrderingUrl(restaurant.url_slug),
    ].join("\n");
}

function buildGreetingMessage(restaurant: RestaurantAutomationData): string {
    return [
        `Olá! 👋 Este é o atendimento automático do *${restaurant.name}*.`,
        "Posso mostrar o cardápio e preços, explicar entrega e pagamentos ou enviar o link para pedir.",
        "",
        `Pedido online: ${getOrderingUrl(restaurant.url_slug)}`,
        "",
        "Para falar com a equipe, escreva *atendente*.",
    ].join("\n");
}

function buildOrderLinkMessage(restaurant: RestaurantAutomationData): string {
    return [
        `Faça seu pedido no cardápio do *${restaurant.name}*:`,
        getOrderingUrl(restaurant.url_slug),
        "",
        "Lá você escolhe os itens, endereço, entrega e pagamento.",
    ].join("\n");
}

function detectIntent(text: string):
    | "greeting"
    | "menu"
    | "delivery"
    | "payment"
    | "order"
    | "handoff"
    | "unknown" {
    if (
        containsAny(text, [
            "atendente",
            "humano",
            "uma pessoa",
            "falar com alguem",
            "falar com o dono",
            "falar com a loja",
            "responsavel",
            "reclamacao",
            "reembolso",
            "estorno",
            "cancelar pedido",
            "alterar pedido",
            "trocar pedido",
            "pedido errado",
            "problema com pedido",
        ])
    ) {
        return "handoff";
    }

    if (
        containsAny(text, [
            "entrega",
            "delivery",
            "taxa",
            "frete",
            "demora",
            "tempo de entrega",
            "prazo",
            "retirada",
            "buscar no local",
            "pedido minimo",
        ])
    ) {
        return "delivery";
    }

    if (
        containsAny(text, [
            "pagamento",
            "pagar",
            "pix",
            "dinheiro",
            "cartao",
            "maquininha",
            "credito",
            "debito",
        ])
    ) {
        return "payment";
    }

    if (
        containsAny(text, [
            "fazer pedido",
            "pedir",
            "comprar",
            "quero pedir",
            "link do pedido",
            "link para pedir",
            "onde peco",
        ])
    ) {
        return "order";
    }

    if (
        containsAny(text, [
            "cardapio",
            "menu",
            "preco",
            "precos",
            "quanto custa",
            "valor",
            "valores",
            "tem pizza",
            "tem lanche",
            "tem comida",
            "opcoes",
            "produtos",
        ])
    ) {
        return "menu";
    }

    if (
        /^(oi|ola|opa|bom dia|boa tarde|boa noite|e ai|hey|hello)(\s|$)/.test(
            text
        )
    ) {
        return "greeting";
    }

    return "unknown";
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
    await touchInboundConversation(restaurantId, chatId);

    const conversation = await getConversation(restaurantId, chatId);
    if (isConversationWithOwner(conversation)) return;

    const restaurant = await getRestaurant(restaurantId);
    if (!restaurant) return;

    const normalizedText = normalize(body);

    if (hasMedia && !normalizedText) {
        await handoffConversation(restaurantId, chatId);
        await sendWahaText(
            sessionName,
            chatId,
            "Recebi seu arquivo. Vou deixar esta conversa com a equipe do restaurante para que possam responder por aqui."
        );
        return;
    }

    const intent = detectIntent(normalizedText);

    if (intent === "handoff") {
        await handoffConversation(restaurantId, chatId);
        await sendWahaText(
            sessionName,
            chatId,
            "Certo — vou deixar esta conversa com a equipe do restaurante. Eles podem responder por aqui."
        );
        return;
    }

    if (intent === "unknown") {
        const items = await getLiveMenu(restaurantId);
        const terms = buildMenuSearchTerms(body);
        const hasMatchingItem =
            terms.length > 0 &&
            items.some((item) => {
                const haystack = normalize(
                    `${item.name} ${item.description || ""} ${
                        item.category_name || ""
                    }`
                );
                return terms.some((term) => haystack.includes(term));
            });

        if (hasMatchingItem) {
            await sendWahaText(
                sessionName,
                chatId,
                buildMenuMessage(restaurant, items, body)
            );
            return;
        }

        await handoffConversation(restaurantId, chatId);
        await sendWahaText(
            sessionName,
            chatId,
            "Essa pergunta precisa da equipe do restaurante. Vou deixar a conversa com eles para responderem por aqui."
        );
        return;
    }

    if (intent === "greeting") {
        await sendWahaText(
            sessionName,
            chatId,
            buildGreetingMessage(restaurant)
        );
        return;
    }

    if (intent === "menu") {
        const items = await getLiveMenu(restaurantId);
        await sendWahaText(
            sessionName,
            chatId,
            buildMenuMessage(restaurant, items, body)
        );
        return;
    }

    if (intent === "delivery") {
        await sendWahaText(
            sessionName,
            chatId,
            buildDeliveryMessage(restaurant)
        );
        return;
    }

    if (intent === "payment") {
        await sendWahaText(
            sessionName,
            chatId,
            buildPaymentMessage(restaurant)
        );
        return;
    }

    await sendWahaText(
        sessionName,
        chatId,
        buildOrderLinkMessage(restaurant)
    );
}
