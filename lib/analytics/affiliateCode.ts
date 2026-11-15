export const AFFILIATE_COOKIE = "imenu_affiliate";
export const AFFILIATE_COOKIE_MAX_AGE = 30 * 24 * 60 * 60;
const IMENU_ORIGIN = "https://www.imenuapp.com.br";

export function affiliateReferralLink(code: string): string {
    return `${IMENU_ORIGIN}/?af=${encodeURIComponent(code)}`;
}

export function affiliateDashboardLink(code: string): string {
    return `${IMENU_ORIGIN}/afiliados/${encodeURIComponent(code)}`;
}

export function normalizeAffiliateCode(value: string | null | undefined): string | null {
    const code = value?.trim().toLowerCase();
    return code && /^[a-z0-9][a-z0-9_-]{0,39}$/.test(code) ? code : null;
}

export function readAffiliateCookie(request: Request) {
    const value = request.headers.get("cookie")?.match(/(?:^|;\s*)imenu_affiliate=([^;]*)/)?.[1];
    const [code, visitId, extra] = value?.split(".") ?? [];
    const normalized = normalizeAffiliateCode(code);
    if (!normalized || extra !== undefined || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/.test(visitId || "")) return null;
    return { code: normalized, visitId };
}
