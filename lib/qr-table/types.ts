export type QrTableSource = "onboarding" | "mesas" | "settings";

export type QrTableMenuTable = {
    id: string;
    name: string;
};

export type QrTableMenuContext = {
    token: string;
    tableId: string | null;
    tableName: string | null;
    requiresTableSelection: boolean;
    tables: QrTableMenuTable[];
};

export type QrTableAddon = {
    id: string;
    restaurant_id: string;
    status: string;
    price_cents: number;
    billing_cycle: string;
    acquisition_source: QrTableSource | null;
    universal_token: string;
    asaas_checkout_id: string | null;
    asaas_checkout_expires_at: string | null;
    asaas_subscription_id: string | null;
    payment_provider: string | null;
    payzu_payment_method: string | null;
    payzu_payment_id: string | null;
    payzu_recurrence_id: string | null;
    payzu_payment_status: string | null;
    mercadopago_order_id: string | null;
    mercadopago_order_status: string | null;
    current_period_ends_at: string | null;
    activated_at: string | null;
    canceled_at: string | null;
    qr_design_template:
        | "classic"
        | "dark"
        | "banner"
        | "logo"
        | "xadrez"
        | "gradient"
        | "minimal"
        | "white"
        | "poster"
        | null;
    qr_design_color: string | null;
};

export function hasQrTableAccess(
    addon: Pick<QrTableAddon, "status" | "current_period_ends_at"> | null,
    now = Date.now()
): boolean {
    if (!addon) return false;
    if (addon.status === "active") return true;

    if (!addon.current_period_ends_at) return false;
    const periodEnd = new Date(addon.current_period_ends_at).getTime();

    return (
        (addon.status === "canceled" || addon.status === "past_due") &&
        Number.isFinite(periodEnd) &&
        periodEnd > now
    );
}

export function isQrTablePrepaid(addon: {
    payment_provider: string | null;
    payzu_payment_method: string | null;
    payzu_recurrence_id: string | null;
} | null): boolean {
    return addon?.payment_provider === "mercadopago" || Boolean(
        addon?.payment_provider === "payzu" &&
        addon.payzu_payment_method?.toUpperCase() === "PIX" &&
        !addon.payzu_recurrence_id
    );
}
