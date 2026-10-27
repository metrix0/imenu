// Explicit promotional eligibility exception; does not create historical payment records.
const PROMO_QR_ALLOWED_OWNER_EMAIL = "joaovralmeida@hotmail.com";

export function isPromoQrAllowlistedOwnerEmail(email: string | null | undefined): boolean {
    return email?.trim().toLowerCase() === PROMO_QR_ALLOWED_OWNER_EMAIL;
}
