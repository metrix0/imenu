// Explicit promotional eligibility exception; does not create historical payment records.
const PROMO_QR_ALLOWED_OWNER_EMAIL = "joaovralmeida@hotmail.com";

export function isPromoQrAllowlistedOwnerEmail(email: string | null | undefined): boolean {
    return email?.trim().toLowerCase() === PROMO_QR_ALLOWED_OWNER_EMAIL;
}

export function hasLegacyQrPurchase(payments: readonly { amount_cents: number; status: string }[]): boolean {
    return payments.some(payment => payment.amount_cents > 0 &&
        ["APPROVED", "COMPLETED", "CONFIRMED", "RECEIVED", "RECEIVED_IN_CASH"].includes(payment.status.toUpperCase()));
}
