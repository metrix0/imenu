export const LEGACY_CARD_METHOD = "trazer-maquininha";

export const CARD_AT_DELIVERY_LABELS = {
    "credito-entrega": "Crédito (Na entrega)",
    "debito-entrega": "Débito (Na entrega)",
} as const;

export type CardAtDeliveryMethod = keyof typeof CARD_AT_DELIVERY_LABELS;

export const CARD_AT_DELIVERY_METHODS = Object.keys(CARD_AT_DELIVERY_LABELS) as CardAtDeliveryMethod[];

export const PHYSICAL_PAYMENT_METHODS = [
    "dinheiro",
    "pix-entrega",
    ...CARD_AT_DELIVERY_METHODS,
    LEGACY_CARD_METHOD,
] as const;

export type PhysicalPaymentMethod = (typeof PHYSICAL_PAYMENT_METHODS)[number];

export const DEFAULT_ALLOWED_PAYMENT_METHODS = ["pix", "dinheiro", ...CARD_AT_DELIVERY_METHODS];
export const CHECKOUT_PAYMENT_METHODS = ["pix", "pix-entrega", "dinheiro", ...CARD_AT_DELIVERY_METHODS];

export function normalizeAllowedPaymentMethods(methods: unknown): string[] {
    if (!Array.isArray(methods) || methods.length === 0) return DEFAULT_ALLOWED_PAYMENT_METHODS;

    return [...new Set(methods.flatMap(method =>
        method === LEGACY_CARD_METHOD ? CARD_AT_DELIVERY_METHODS :
        typeof method === "string" ? [method] : []
    ))];
}

export function isCardAtDeliveryMethod(method: unknown): method is CardAtDeliveryMethod {
    return CARD_AT_DELIVERY_METHODS.some(option => option === method);
}

export function isPhysicalPaymentMethod(method: unknown): method is PhysicalPaymentMethod {
    return PHYSICAL_PAYMENT_METHODS.some(option => option === method);
}

export function isCheckoutCardMethodEnabled(method: CardAtDeliveryMethod | typeof LEGACY_CARD_METHOD, methods: unknown): boolean {
    const allowed = normalizeAllowedPaymentMethods(methods);
    return method === LEGACY_CARD_METHOD
        ? CARD_AT_DELIVERY_METHODS.every(option => allowed.includes(option))
        : allowed.includes(method);
}

export function cardAtDeliveryLabel(method: CardAtDeliveryMethod, destination?: string | null): string {
    const label = CARD_AT_DELIVERY_LABELS[method];
    if (destination === "retirada") return label.replace("Na entrega", "Na retirada");
    if (destination === "balcao") return label.replace("Na entrega", "No balcão");
    return label;
}
