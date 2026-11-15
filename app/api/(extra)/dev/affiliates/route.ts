import { NextResponse } from "next/server";
import { normalizeAffiliateCode } from "@/lib/analytics/affiliateCode";
import { query } from "@/lib/database/sql";
import { authorize } from "@/lib/dev/authorize";
import { devPage, paged } from "@/lib/dev/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;
const noStore = { "Cache-Control": "no-store" };

export async function GET(request: Request) {
    try {
        const denied = await authorize(request);
        if (denied) return denied;

        const params = new URL(request.url).searchParams;
        const page = devPage(params);
        const purchasePage = devPage(params, "purchases");
        const [partners, purchases, totals] = await Promise.all([
            query<{ code: string; name: string; purchases: number }>(
                `SELECT partner.code, partner.name, COUNT(referral.purchase_id)::int purchases
                 FROM public.affiliate_partners partner
                 LEFT JOIN public.affiliate_referrals referral ON referral.affiliate_code = partner.code
                 GROUP BY partner.code
                 ORDER BY partner.created_at DESC, partner.code LIMIT $1 OFFSET $2`,
                [PAGE_SIZE, page * PAGE_SIZE]
            ),
            query<{ id: string; name: string; code: string; restaurant_id: string; restaurant_name: string; paid_at: string; amount_cents: number }>(
                `SELECT payment.id, partner.name, partner.code, restaurant.id AS restaurant_id,
                    restaurant.name AS restaurant_name, payment.paid_at, payment.amount_cents
                 FROM public.affiliate_referrals referral
                 JOIN public.affiliate_partners partner ON partner.code = referral.affiliate_code
                 JOIN public.restaurant_addon_payments payment ON payment.id = referral.purchase_id
                 JOIN public.restaurant_addons addon ON addon.id = payment.addon_id
                 JOIN public.restaurants restaurant ON restaurant.id = addon.restaurant_id
                 ORDER BY payment.paid_at DESC, payment.id DESC LIMIT $1 OFFSET $2`,
                [PAGE_SIZE, purchasePage * PAGE_SIZE]
            ),
            query<{ partners: number; purchases: number }>(
                `SELECT (SELECT COUNT(*)::int FROM public.affiliate_partners) AS partners,
                         (SELECT COUNT(purchase_id)::int FROM public.affiliate_referrals) AS purchases`
            ),
        ]);
        return NextResponse.json({
            partners: paged(partners.rows, totals.rows[0].partners, page, PAGE_SIZE),
            purchases: paged(purchases.rows, totals.rows[0].purchases, purchasePage, PAGE_SIZE),
        }, { headers: noStore });
    } catch (error) {
        console.error("[DEV_AFFILIATES]", error);
        return NextResponse.json({ error: "Não foi possível carregar os afiliados." }, { status: 500 });
    }
}

export async function POST(request: Request) {
    try {
        const denied = await authorize(request);
        if (denied) return denied;

        const body = await request.json().catch(() => null) as { name?: unknown; code?: unknown } | null;
        const name = typeof body?.name === "string" ? body.name.trim() : "";
        const code = typeof body?.code === "string" ? normalizeAffiliateCode(body.code) : null;
        if (!name || name.length > 100 || !code) {
            return NextResponse.json({ error: "Informe o nome e um código com até 40 letras, números, hífens ou sublinhados." }, { status: 400 });
        }

        const { rows: [partner] } = await query(
            `INSERT INTO public.affiliate_partners (code, name) VALUES ($1, $2)
             ON CONFLICT (code) DO NOTHING RETURNING code, name`,
            [code, name]
        );
        if (!partner) return NextResponse.json({ error: "Esse código já existe." }, { status: 409 });
        return NextResponse.json(partner, { status: 201, headers: noStore });
    } catch (error) {
        console.error("[DEV_AFFILIATES]", error);
        return NextResponse.json({ error: "Não foi possível criar o código." }, { status: 500 });
    }
}
