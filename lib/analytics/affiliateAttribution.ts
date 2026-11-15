import { query } from "@/lib/database/sql";
import { readAffiliateCookie } from "./affiliateCode";

export const CONFIRMED_AFFILIATE_PAYMENT_STATUSES = "('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'PAID', 'COMPLETED', 'APPROVED')";

// Use the same eligibility rules for PostHog and the developer purchase history.
export const AFFILIATE_PAID_PURCHASES = `
    SELECT payment.id, referral.user_id, referral.affiliate_code, referral.visit_id,
           addon.id AS addon_id, payment.asaas_payment_id, addon.restaurant_id,
           restaurant.name AS restaurant_name, payment.amount_cents, payment.paid_at
    FROM public.affiliate_referrals referral
    JOIN public.restaurants restaurant ON restaurant.user_id = referral.user_id
    JOIN public.restaurant_addons addon ON addon.restaurant_id = restaurant.id AND addon.product_key = 'ia_plus'
    JOIN public.restaurant_addon_payments payment ON payment.addon_id = addon.id
    WHERE payment.paid_at IS NOT NULL AND payment.amount_cents > 0
      AND UPPER(payment.status) IN ${CONFIRMED_AFFILIATE_PAYMENT_STATUSES}
      AND (payment.id = referral.purchase_id OR GREATEST(payment.paid_at, payment.created_at) >= referral.referred_at)
`;

export async function captureAffiliateEvent(
    event: "affiliate_link_visited" | "imenu_plus_affiliate_purchase",
    distinctId: string,
    id: string,
    properties: Record<string, string | number | boolean>,
    timestamp?: Date
): Promise<boolean> {
    const host = process.env.NEXT_PUBLIC_POSTHOG_HOST?.trim().replace(/\/+$/, "");
    const apiKey = process.env.NEXT_PUBLIC_POSTHOG_KEY?.trim();
    if (!host || !apiKey) return false;

    try {
        const response = await fetch(`${host}/i/v0/e/`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(2500),
            body: JSON.stringify({
                api_key: apiKey, event, distinct_id: distinctId, uuid: id, timestamp,
                properties: { ...properties, $process_person_profile: event === "imenu_plus_affiliate_purchase" },
            }),
        });
        await response.body?.cancel();
        return response.ok;
    } catch {
        return false;
    }
}

export async function rememberAffiliateReferral(request: Request, userId: string): Promise<void> {
    const referral = readAffiliateCookie(request);
    if (!referral) return;
    try {
        await query(
            `INSERT INTO public.affiliate_referrals (user_id, affiliate_code, visit_id)
             SELECT $1, partner.code, $3 FROM public.affiliate_partners partner
             WHERE partner.code = $2
               AND NOT EXISTS (
                 SELECT 1 FROM public.restaurants restaurant
                 JOIN public.restaurant_addons addon ON addon.restaurant_id = restaurant.id AND addon.product_key = 'ia_plus'
                 JOIN public.restaurant_addon_payments payment ON payment.addon_id = addon.id
                 WHERE restaurant.user_id = $1 AND payment.paid_at IS NOT NULL AND payment.amount_cents > 0
                   AND UPPER(payment.status) IN ${CONFIRMED_AFFILIATE_PAYMENT_STATUSES}
               )
             ON CONFLICT (user_id) DO NOTHING`,
            [userId, referral.code, referral.visitId]
        );
    } catch (error) {
        console.warn("[AFFILIATE] Could not store referral:", error instanceof Error ? error.name : "unknown");
    }
}

export async function recordAffiliatePurchase(addonId: string, providerPaymentId: string): Promise<void> {
    try {
        const { rows: [purchase] } = await query<{
            id: string; user_id: string; affiliate_code: string; visit_id: string;
            restaurant_id: string; amount_cents: number; paid_at: Date;
        }>(
            `WITH attributed AS (${AFFILIATE_PAID_PURCHASES})
             SELECT attributed.* FROM attributed
             WHERE addon_id = $1 AND asaas_payment_id = $2
               AND NOT EXISTS (
                   SELECT 1 FROM public.affiliate_purchase_events event WHERE event.payment_id = attributed.id
               )`,
            [addonId, providerPaymentId]
        );
        if (!purchase) return;
        if (await captureAffiliateEvent("imenu_plus_affiliate_purchase", purchase.user_id, purchase.id, {
            af: purchase.affiliate_code,
            referral_visit_id: purchase.visit_id,
            restaurant_id: purchase.restaurant_id,
            payment_id: purchase.id,
            amount_cents: Number(purchase.amount_cents),
        }, purchase.paid_at)) {
            await query(
                "INSERT INTO public.affiliate_purchase_events (payment_id) VALUES ($1) ON CONFLICT DO NOTHING",
                [purchase.id]
            );
        }
    } catch (error) {
        console.warn("[AFFILIATE] Could not record purchase:", error instanceof Error ? error.name : "unknown");
    }
}
