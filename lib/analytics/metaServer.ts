import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { query } from "@/lib/database/sql";
import { readCookie, structuredAddress } from "@/lib/services/checkoutCustomer";
import { normalizeCustomerPhone } from "@/lib/services/crmRules";
import {
    cleanMetaPixelId,
    metaPurchaseEventId,
    type MetaCommerceData,
    type MetaCustomer,
    type MetaEvent,
} from "./metaEvents";

type TrackingRow = {
    restaurant_id: string;
    meta_pixel_id: string | null;
    meta_capi_token: string | null;
};

export async function metaDestination(restaurant: { id: string } | { slug: string }) {
    const byId = "id" in restaurant;
    const { rows: [tracking] } = await query<TrackingRow>(
        `SELECT t.restaurant_id, t.meta_pixel_id, t.meta_capi_token
         FROM public.tracking_integrations t
         JOIN public.restaurants r ON r.id = t.restaurant_id
         WHERE ${byId ? "r.id" : "r.url_slug"} = $1
           AND t.is_enabled IS TRUE
         ORDER BY t.updated_at DESC NULLS LAST
         LIMIT 1`,
        [byId ? restaurant.id : restaurant.slug]
    );
    const pixelId = cleanMetaPixelId(tracking?.meta_pixel_id);
    if (!pixelId) return null;
    return { pixelId, token: tracking.meta_capi_token?.trim() || null, restaurantId: tracking.restaurant_id };
}

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const letters = (value: string) =>
    value.normalize("NFKD").toLowerCase().replace(/[^a-z]/g, "");
const name = (value: string) =>
    value.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{M}]/gu, "");
const text = (value: unknown) => typeof value === "string" ? value.trim().slice(0, 200) : "";

export function metaCustomerFromOrder(body: {
    customer_name?: unknown;
    customer_phone?: unknown;
    customer_address_details?: unknown;
}, includeAddress: boolean): MetaCustomer {
    const address = includeAddress ? structuredAddress(body.customer_address_details) : null;
    return {
        name: text(body.customer_name),
        phone: text(body.customer_phone),
        city: address?.cidade,
        state: address?.estado,
        postalCode: address?.cep,
    };
}

type MetaContext = { event_source_url: string; user_data: Record<string, string> };

export function metaContext(
    request: Request,
    slug: string,
    restaurantId: string,
    customer: MetaCustomer = {},
): MetaContext {
    const phone = normalizeCustomerPhone(text(customer.phone));
    const nameParts = text(customer.name).split(/\s+/);
    const firstName = name(nameParts[0]);
    const lastName = nameParts.length > 1 ? name(nameParts[nameParts.length - 1]) : "";
    const city = letters(text(customer.city));
    const state = letters(text(customer.state));
    const postalCode = text(customer.postalCode).replace(/\D/g, "");
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
    const agent = request.headers.get("user-agent")?.slice(0, 1024);
    const fbp = readCookie(request, "_fbp");
    const fbc = readCookie(request, "_fbc");
    const user_data: Record<string, string> = { country: hash("br") };

    if (phone) {
        user_data.ph = hash(phone);
        user_data.external_id = hash(`${restaurantId}:${phone}`);
    }
    if (firstName) user_data.fn = hash(firstName);
    if (lastName) user_data.ln = hash(lastName);
    if (city) user_data.ct = hash(city);
    if (state.length === 2) user_data.st = hash(state);
    if (postalCode.length === 8) user_data.zp = hash(postalCode);
    if (ip && isIP(ip)) user_data.client_ip_address = ip;
    if (agent) user_data.client_user_agent = agent;
    if (/^fb\.\d+\.\d+\.\d+$/.test(fbp) && fbp.length < 100) user_data.fbp = fbp;
    if (/^fb\.\d+\.\d+\.[\w-]+$/.test(fbc) && fbc.length <= 512) user_data.fbc = fbc;

    const requestUrl = new URL(request.url);
    let source = new URL(`/${encodeURIComponent(slug)}`, requestUrl);
    try {
        const referrer = new URL(request.headers.get("referer") ?? "");
        if (referrer.origin === requestUrl.origin) {
            source = referrer;
            const clickId = referrer.searchParams.get("fbclid");
            if (!user_data.fbc && clickId && /^[\w-]{1,400}$/.test(clickId)) {
                user_data.fbc = `fb.1.${Date.now()}.${clickId}`;
            }
        }
    } catch {}
    source.search = "";
    source.hash = "";
    return { event_source_url: source.toString(), user_data };
}

class MetaDeliveryError extends Error {
    constructor(message: string, readonly retryable: boolean) {
        super(message);
    }
}

export async function sendMetaEvent(
    destination: { pixelId: string; token: string | null },
    event: MetaEvent,
    eventId: string,
    data: MetaCommerceData,
    context: MetaContext,
    occurredAt = Date.now() / 1000,
    testEventCode?: string,
): Promise<void> {
    if (!destination.token) return;
    const url = new URL(`https://graph.facebook.com/v25.0/${destination.pixelId}/events`);
    url.searchParams.set("access_token", destination.token);
    let response: Response;
    try {
        response = await fetch(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({
                data: [{
                    ...context,
                    action_source: "website",
                    event_name: event,
                    event_id: eventId,
                    event_time: Math.floor(occurredAt),
                    custom_data: data,
                }],
                ...(testEventCode ? { test_event_code: testEventCode } : {}),
            }),
            signal: AbortSignal.timeout(3_000),
            cache: "no-store",
        });
    } catch {
        throw new MetaDeliveryError("Could not reach Meta Conversions API", true);
    }
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.events_received) {
        throw new MetaDeliveryError(
            `Meta ${event} rejected (HTTP ${response.status}, code ${Number(result?.error?.code) || 0})`,
            response.status === 429 || response.status >= 500 || result?.error?.is_transient === true,
        );
    }
}

export async function saveMetaPixPurchase(
    orderId: string,
    pixelId: string,
    data: MetaCommerceData,
    context: MetaContext,
): Promise<void> {
    await query(
        `WITH expired AS (
             DELETE FROM meta_private.pix_purchase WHERE expires_at <= now()
         )
         INSERT INTO meta_private.pix_purchase (order_id, pixel_id, event_data, browser_context)
         VALUES ($1, $2, $3::jsonb, $4::jsonb)`,
        [orderId, pixelId, JSON.stringify(data), JSON.stringify(context)],
    );
}

export async function discardMetaPixPurchase(orderId: string): Promise<void> {
    await query("DELETE FROM meta_private.pix_purchase WHERE order_id = $1", [orderId]);
}

export async function sendConfirmedMetaPixPurchase(
    orderId: string,
    restaurantId: string,
    paidAt: Date | string | null,
): Promise<void> {
    const { rows: [purchase] } = await query<{
        pixel_id: string;
        event_data: MetaCommerceData;
        browser_context: MetaContext;
    }>(
        `SELECT pixel_id, event_data, browser_context
         FROM meta_private.pix_purchase
         WHERE order_id = $1 AND expires_at > now()`,
        [orderId],
    );
    if (!purchase) return;
    const destination = await metaDestination({ id: restaurantId });
    if (destination?.pixelId === purchase.pixel_id && destination.token) {
        const paidTime = paidAt instanceof Date ? paidAt.getTime() : Date.parse(paidAt ?? "");
        try {
            await sendMetaEvent(
                destination, "Purchase", metaPurchaseEventId(orderId),
                purchase.event_data, purchase.browser_context,
                Number.isFinite(paidTime) ? paidTime / 1000 : undefined,
            );
        } catch (error) {
            if (!(error instanceof MetaDeliveryError) || error.retryable) throw error;
            console.warn("[META] Pix purchase rejected", error.message);
        }
    }
    await discardMetaPixPurchase(orderId);
}
