const funnelEvents = ["ViewContent", "AddToCart", "InitiateCheckout", "AddPaymentInfo"] as const;

export type MetaFunnelEvent = (typeof funnelEvents)[number];
export type MetaEvent = MetaFunnelEvent | "Purchase";

export function isMetaFunnelEvent(value: unknown): value is MetaFunnelEvent {
    return funnelEvents.some(event => event === value);
}

export function cleanMetaPixelId(value: unknown): string | null {
    return typeof value === "string" && /^[0-9]{5,25}$/.test(value.trim()) ? value.trim() : null;
}

export type MetaCommerceData = {
    content_type: "product";
    content_ids: string[];
    contents: { id: string; quantity: number }[];
    num_items: number;
    value: number;
    currency: "BRL";
    order_id?: string;
};

export type MetaCustomer = {
    name?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    postalCode?: string | null;
};

export type TrackMetaFunnelEvent = (
    event: MetaFunnelEvent,
    data: MetaCommerceData,
    customer?: MetaCustomer,
) => void;

export function metaCommerceData(
    items: readonly { id: string; quantity: number }[],
    totalCents: number,
    orderId?: string,
): MetaCommerceData {
    const quantities = new Map<string, number>();
    for (const { id, quantity } of items) {
        if (!id) continue;
        quantities.set(id, (quantities.get(id) ?? 0) + quantity);
    }
    const contents = Array.from(quantities, ([id, quantity]) => ({ id, quantity }));
    return {
        content_type: "product",
        content_ids: [...quantities.keys()],
        contents,
        num_items: contents.reduce((sum, item) => sum + item.quantity, 0),
        value: totalCents / 100,
        currency: "BRL",
        ...(orderId ? { order_id: orderId } : {}),
    };
}

export const metaPurchaseEventId = (orderId: string) => `purchase:${orderId}`;
