import { NextResponse } from "next/server";
import { AFFILIATE_PAID_PURCHASES } from "@/lib/analytics/affiliateAttribution";
import { normalizeAffiliateCode } from "@/lib/analytics/affiliateCode";
import { canViewAffiliateDashboard } from "@/lib/analytics/affiliateDashboardAccess";
import { query } from "@/lib/database/sql";
import { devPage, paged } from "@/lib/dev/pagination";

const PAGE_SIZE = 10;
const headers = { "Cache-Control": "private, no-store" };

type DashboardRow = {
    referrals: number;
    purchases: number;
    commission_cents: number;
    referral_rows: { position: number; restaurant_name: string | null; referred_at: string; has_purchase: boolean }[];
    purchase_rows: { position: number; restaurant_name: string; paid_at: string; commission_cents: number }[];
};

export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
    const code = normalizeAffiliateCode((await params).code);
    if (!code || !canViewAffiliateDashboard(code, request.headers.get("authorization"))) {
        return NextResponse.json({ error: "Abra o link privado que a equipe do iMenu enviou para você." }, { status: 403, headers });
    }

    const search = new URL(request.url).searchParams;
    const referralPage = devPage(search);
    const purchasePage = devPage(search, "purchases");

    try {
        const { rows: [dashboard] } = await query<DashboardRow>(
            `WITH paid AS (
                 SELECT id, user_id, restaurant_name, paid_at, ROUND(amount_cents * 0.5)::int AS commission_cents
                 FROM (${AFFILIATE_PAID_PURCHASES}) attributed WHERE affiliate_code = $1
             ), referral_page AS (
                 SELECT referral.user_id, referral.referred_at
                 FROM public.affiliate_referrals referral WHERE referral.affiliate_code = $1
                 ORDER BY referral.referred_at DESC, referral.user_id DESC LIMIT $2 OFFSET $3
             ), purchase_page AS (
                 SELECT id, restaurant_name, paid_at, commission_cents
                 FROM paid ORDER BY paid_at DESC, id DESC LIMIT $2 OFFSET $4
             )
             SELECT (SELECT COUNT(*)::int FROM public.affiliate_referrals WHERE affiliate_code = partner.code) AS referrals,
                 (SELECT COUNT(*)::int FROM paid) AS purchases,
                 (SELECT COALESCE(SUM(commission_cents), 0)::float8 FROM paid) AS commission_cents,
                 ARRAY(SELECT json_build_object(
                       'position', ROW_NUMBER() OVER (ORDER BY referral.referred_at DESC, referral.user_id DESC),
                       'restaurant_name', (SELECT restaurant.name FROM public.restaurants restaurant
                           WHERE restaurant.user_id = referral.user_id ORDER BY restaurant.created_at, restaurant.id LIMIT 1),
                       'referred_at', referral.referred_at,
                       'has_purchase', EXISTS (SELECT 1 FROM paid WHERE paid.user_id = referral.user_id))
                   FROM referral_page referral ORDER BY referral.referred_at DESC, referral.user_id DESC) AS referral_rows,
                 ARRAY(SELECT json_build_object(
                       'position', ROW_NUMBER() OVER (ORDER BY paid_at DESC, id DESC),
                       'restaurant_name', restaurant_name, 'paid_at', paid_at, 'commission_cents', commission_cents)
                   FROM purchase_page ORDER BY paid_at DESC, id DESC) AS purchase_rows
             FROM public.affiliate_partners partner WHERE partner.code = $1`,
            [code, PAGE_SIZE, referralPage * PAGE_SIZE, purchasePage * PAGE_SIZE],
        );
        if (!dashboard) {
            return NextResponse.json({ error: "Painel de afiliado indisponível." }, { status: 404, headers });
        }

        return NextResponse.json({
            referrals: paged(dashboard.referral_rows, dashboard.referrals, referralPage, PAGE_SIZE),
            purchases: paged(dashboard.purchase_rows, dashboard.purchases, purchasePage, PAGE_SIZE),
            commissionCents: dashboard.commission_cents,
        }, { headers });
    } catch (error) {
        console.error("[AFFILIATE_DASHBOARD]", error);
        return NextResponse.json({ error: "Não foi possível carregar o painel." }, { status: 500, headers });
    }
}
