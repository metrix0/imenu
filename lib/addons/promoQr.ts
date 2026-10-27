import { IA_PLUS } from "@/lib/addons/products";

export const PROMO_QR_CODE = "PROMOQR";
// São Paulo time: October 29 inclusive to November 28 exclusive.
const START = Date.parse("2026-10-29T00:00:00-03:00");
const END = Date.parse("2026-11-28T00:00:00-03:00");

export const PROMO_QR_PRICE_CENTS = Math.round(IA_PLUS.priceCents / 2);
export const PROMO_QR_PRICE_LABEL = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
}).format(PROMO_QR_PRICE_CENTS / 100);

export function isPromoQrDate(now = Date.now()): boolean {
    return now >= START && now < END;
}
