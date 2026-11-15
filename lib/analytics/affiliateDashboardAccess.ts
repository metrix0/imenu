import { createHmac, timingSafeEqual } from "node:crypto";

export function affiliateDashboardToken(code: string): string | null {
    const secret = process.env.CRON_SECRET?.trim();
    return secret ? createHmac("sha256", secret).update(`imenu-affiliate-dashboard:${code}`).digest("hex") : null;
}

export function canViewAffiliateDashboard(code: string, authorization: string | null): boolean {
    const token = authorization?.match(/^Bearer ([0-9a-f]{64})$/)?.[1];
    const expected = affiliateDashboardToken(code);
    return !!token && !!expected && timingSafeEqual(Buffer.from(token, "hex"), Buffer.from(expected, "hex"));
}
