import { query } from "@/lib/database/sql";

export const WHATSAPP_TEMPLATE_KEYS = [
    "welcome",
    "menu_link",
    "delivery",
    "payment",
    "order_status_found",
    "order_status_not_found",
    "handoff",
    "unsupported_media",
    "fallback",
    "order_tracking",
    "status_notification",
] as const;

export type WhatsAppTemplateKey = (typeof WHATSAPP_TEMPLATE_KEYS)[number];
export type WhatsAppMessageTemplates = Record<WhatsAppTemplateKey, string>;
export type WhatsAppTemplateVariables = Record<string, string>;

export const DEFAULT_WHATSAPP_MESSAGE_TEMPLATES: WhatsAppMessageTemplates = {
    welcome: [
        "Olá! 👋 Sou o atendimento automático do *{{NOME_DO_RESTAURANTE}}*.",
        "Posso enviar o cardápio, consultar o status do seu pedido e explicar entrega, retirada e pagamentos.",
        "",
        "Pedido online: {{LINK_DO_CARDAPIO}}",
        "",
        "Para atendimento humano, escolha *Falar com atendente* ou escreva *atendente*.",
    ].join("\n"),
    menu_link: [
        "🍽️ *Cardápio — {{NOME_DO_RESTAURANTE}}*",
        "Veja o cardápio e faça seu pedido aqui:",
        "{{LINK_DO_CARDAPIO}}",
    ].join("\n"),
    delivery: [
        "🛵 *Entrega e retirada — {{NOME_DO_RESTAURANTE}}*",
        "{{INFORMACOES_DE_ENTREGA}}",
        "",
        "Confira a opção exata no pedido: {{LINK_DO_CARDAPIO}}",
    ].join("\n"),
    payment: [
        "💳 *Pagamentos — {{NOME_DO_RESTAURANTE}}*",
        "{{FORMAS_DE_PAGAMENTO}}",
        "",
        "Faça o pedido aqui: {{LINK_DO_CARDAPIO}}",
    ].join("\n"),
    order_status_found: [
        "🔎 *Status do pedido — {{NOME_DO_RESTAURANTE}}*",
        "Pedido *#{{NUMERO_DO_PEDIDO}}*: {{STATUS_DO_PEDIDO}}.",
    ].join("\n"),
    order_status_not_found: [
        "🔎 *Status do pedido — {{NOME_DO_RESTAURANTE}}*",
        "Não encontrei um pedido recente vinculado a este número de WhatsApp.",
        "Caso tenha usado outro número ou precise de ajuda, escolha *Falar com atendente*.",
    ].join("\n"),
    handoff: "Certo — a conversa ficará com a equipe do restaurante. O robô só voltará a responder quando a equipe reativá-lo no painel.",
    unsupported_media: "Não consigo analisar arquivos automaticamente. Escolha *Falar com atendente* para enviar isso à equipe.",
    fallback: "Não entendi essa mensagem. Digite *menu* para ver as opções ou *atendente* para falar com a equipe.",
    order_tracking: "Ótimo! Você pode acompanhar seu pedido por: {{LINK_DE_ACOMPANHAMENTO}}",
    status_notification: [
        "Olá, {{NOME_DO_CLIENTE}}! 👋",
        "",
        "Seu pedido *#{{NUMERO_DO_PEDIDO}}* no *{{NOME_DO_RESTAURANTE}}* {{STATUS_DO_PEDIDO}}",
    ].join("\n"),
};

type RestaurantTemplateData = {
    id: string;
    name: string | null;
    url_slug: string | null;
    min_order_cents: number | null;
    delivery_fee_json: unknown;
    allowed_payment_methods: string[] | null;
    pickup_enabled: boolean | null;
    availability_json: unknown;
};

type DeliveryRule = {
    radius_km: number;
    time_minutes: number;
    fee_cents: number | null;
};

const DAY_LABELS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

const PAYMENT_LABELS: Record<string, string> = {
    pix: "Pix online",
    "pix-entrega": "Pix na entrega",
    dinheiro: "Dinheiro",
    "trazer-maquininha": "Cartão na maquininha",
};

function formatCurrency(cents: number | null | undefined): string {
    return ((Number(cents) || 0) / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function getOrderingUrl(slug: string | null): string {
    const base =
        process.env.IMENU_PUBLIC_URL?.trim().replace(/\/+$/, "") ||
        (process.env.VERCEL_PROJECT_PRODUCTION_URL
            ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
            : "");

    if (!base) throw new Error("IMENU_PUBLIC_URL is not configured");
    return `${base}/${encodeURIComponent(slug || "")}`;
}

function parseDeliveryRules(value: unknown): DeliveryRule[] {
    if (!Array.isArray(value)) return [];

    return value
        .map((item) => {
            const rule = item as Record<string, unknown>;
            return {
                radius_km: Number(rule.radius_km),
                time_minutes: Number(rule.time_minutes),
                fee_cents:
                    rule.fee_cents === null || rule.fee_cents === undefined
                        ? null
                        : Number(rule.fee_cents),
            };
        })
        .filter(
            (rule) =>
                Number.isFinite(rule.radius_km) &&
                Number.isFinite(rule.time_minutes)
        )
        .sort((first, second) => first.radius_km - second.radius_km);
}

function buildDeliveryDetails(restaurant: RestaurantTemplateData): string {
    const lines: string[] = [];
    const rules = parseDeliveryRules(restaurant.delivery_fee_json);

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
        lines.push(`• Pedido mínimo: ${formatCurrency(restaurant.min_order_cents)}`);
    }

    lines.push(
        restaurant.pickup_enabled
            ? "• Retirada no local está disponível."
            : "• Retirada no local não está disponível neste momento."
    );

    return lines.join("\n");
}

function buildPaymentMethods(restaurant: RestaurantTemplateData): string {
    const methods = Array.isArray(restaurant.allowed_payment_methods)
        ? restaurant.allowed_payment_methods
        : [];
    const labels = methods.map((method) => PAYMENT_LABELS[method] || method);

    return labels.length
        ? `Aceitamos: ${labels.join(", ")}.`
        : "As formas disponíveis aparecem na finalização do pedido.";
}

function formatOpeningHours(value: unknown): string {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
        return "Consulte os horários no cardápio.";
    }

    const days: string[] = [];
    for (let day = 0; day < 7; day += 1) {
        const rawSlots = (value as Record<string, unknown>)[String(day)];
        if (!Array.isArray(rawSlots) || rawSlots.length === 0) continue;

        const slots = rawSlots
            .map((item) => {
                if (!item || typeof item !== "object" || Array.isArray(item)) {
                    return null;
                }
                const slot = item as Record<string, unknown>;
                const open = String(slot.open || "");
                const close = String(slot.close || "");
                if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(open)) return null;
                if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(close)) return null;
                return `${open}–${close}`;
            })
            .filter((slot): slot is string => Boolean(slot));

        if (slots.length) days.push(`${DAY_LABELS[day]}: ${slots.join(" e ")}`);
    }

    return days.length ? days.join("; ") : "Consulte os horários no cardápio.";
}

export function mergeWhatsAppTemplates(
    value: unknown
): WhatsAppMessageTemplates {
    const saved = value && typeof value === "object" && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};

    return Object.fromEntries(
        WHATSAPP_TEMPLATE_KEYS.map((key) => [
            key,
            typeof saved[key] === "string" && saved[key].trim()
                ? saved[key]
                : DEFAULT_WHATSAPP_MESSAGE_TEMPLATES[key],
        ])
    ) as WhatsAppMessageTemplates;
}

export function validateWhatsAppTemplates(
    value: unknown
): WhatsAppMessageTemplates | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const templates = value as Record<string, unknown>;

    for (const key of WHATSAPP_TEMPLATE_KEYS) {
        if (
            typeof templates[key] !== "string" ||
            !templates[key].trim() ||
            templates[key].length > 4000
        ) {
            return null;
        }
    }

    return Object.fromEntries(
        WHATSAPP_TEMPLATE_KEYS.map((key) => [key, String(templates[key])])
    ) as WhatsAppMessageTemplates;
}

export async function getWhatsAppTemplates(
    restaurantId: string
): Promise<WhatsAppMessageTemplates> {
    const result = await query<{ message_templates: unknown }>(
        `
            SELECT message_templates
            FROM whatsapp_bot_settings
            WHERE restaurant_id = $1
            LIMIT 1
        `,
        [restaurantId]
    );

    return mergeWhatsAppTemplates(result.rows[0]?.message_templates);
}

export async function getRestaurantTemplateData(
    restaurantId: string
): Promise<RestaurantTemplateData | null> {
    const result = await query<RestaurantTemplateData>(
        `
            SELECT
                id,
                name,
                url_slug,
                min_order_cents,
                delivery_fee_json,
                allowed_payment_methods,
                pickup_enabled,
                availability_json
            FROM restaurants
            WHERE id = $1
            LIMIT 1
        `,
        [restaurantId]
    );

    return result.rows[0] || null;
}

export function buildRestaurantTemplateVariables(
    restaurant: RestaurantTemplateData,
    extra: Partial<WhatsAppTemplateVariables> = {}
): WhatsAppTemplateVariables {
    return {
        NOME_DO_RESTAURANTE: restaurant.name?.trim() || "Restaurante",
        NOME_DO_CLIENTE: "Cliente",
        HORARIOS_DE_ABERTURA: formatOpeningHours(restaurant.availability_json),
        LINK_DO_CARDAPIO: getOrderingUrl(restaurant.url_slug),
        PEDIDO_MINIMO:
            Number(restaurant.min_order_cents) > 0
                ? formatCurrency(restaurant.min_order_cents)
                : "Sem pedido mínimo",
        INFORMACOES_DE_ENTREGA: buildDeliveryDetails(restaurant),
        FORMAS_DE_PAGAMENTO: buildPaymentMethods(restaurant),
        NUMERO_DO_PEDIDO: "1234",
        STATUS_DO_PEDIDO: "está sendo preparado 👨‍🍳",
        LINK_DE_ACOMPANHAMENTO: `${getOrderingUrl(restaurant.url_slug)}/pedido`,
        ...extra,
    };
}

export function renderWhatsAppTemplate(
    template: string,
    variables: WhatsAppTemplateVariables
): string {
    return template.replace(/\{\{([A-Z0-9_]+)\}\}/g, (match, key: string) =>
        Object.prototype.hasOwnProperty.call(variables, key)
            ? variables[key]
            : match
    );
}
