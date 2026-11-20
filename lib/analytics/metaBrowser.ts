import {
    type MetaCommerceData,
    type MetaEvent,
    type TrackMetaFunnelEvent,
    metaPurchaseEventId,
} from "./metaEvents";

type PixelWindow = Window & {
    fbq?: (...args: unknown[]) => void;
    imenuMetaPixels?: Record<string, true>;
};

export const META_PIXEL_READY = "imenu:meta-pixel-ready";

export function trackMetaPixel(
    pixelId: string,
    event: MetaEvent,
    data: MetaCommerceData,
    eventId: string,
): void {
    const browser = window as PixelWindow;
    const send = () => {
        if (!browser.imenuMetaPixels?.[pixelId] || typeof browser.fbq !== "function") return false;
        browser.fbq("trackSingle", pixelId, event, data, { eventID: eventId });
        return true;
    };
    if (send()) return;

    const onReady = () => {
        if (send()) {
            window.removeEventListener(META_PIXEL_READY, onReady);
            window.clearTimeout(timeout);
        }
    };
    const timeout = window.setTimeout(() => window.removeEventListener(META_PIXEL_READY, onReady), 10_000);
    window.addEventListener(META_PIXEL_READY, onReady);
}

export function trackMetaFunnel(
    pixelId: string,
    slug: string,
    capiEnabled: boolean,
    ...[event, data, customer]: Parameters<TrackMetaFunnelEvent>
): void {
    const eventId = window.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`;
    trackMetaPixel(pixelId, event, data, eventId);
    if (capiEnabled) {
        void fetch("/api/meta", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ slug, event_name: event, event_id: eventId, custom_data: data, customer }),
            keepalive: true,
        }).catch(() => {});
    }
}

export type PixPixelPurchase = { pixelId: string; data: MetaCommerceData };
const pendingPurchaseKey = (id: string) => `imenu:meta-pix:${id}`;

export function rememberPixPixelPurchase(purchase: PixPixelPurchase): void {
    if (!purchase.data.order_id) return;
    try {
        sessionStorage.setItem(pendingPurchaseKey(purchase.data.order_id), JSON.stringify(purchase));
    } catch {}
}

export function readPixPixelPurchase(id: string): PixPixelPurchase | null {
    try {
        return JSON.parse(sessionStorage.getItem(pendingPurchaseKey(id)) ?? "null");
    } catch {
        return null;
    }
}

export function trackPixPixelPurchase(id: string, purchase: PixPixelPurchase): void {
    try {
        sessionStorage.removeItem(pendingPurchaseKey(id));
    } catch {}
    trackMetaPixel(purchase.pixelId, "Purchase", purchase.data, metaPurchaseEventId(id));
}
