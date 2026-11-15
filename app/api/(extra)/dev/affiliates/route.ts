import { NextResponse } from "next/server";
import { AFFILIATE_PAID_PURCHASES } from "@/lib/analytics/affiliateAttribution";
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
                `WITH attributed AS (${AFFILIATE_PAID_PURCHASES})
                 SELECT partner.code, partner.name, COUNT(attributed.id)::int purchases
                 FROM public.affiliate_partners partner
                 LEFT JOIN attributed ON attributed.affiliate_code = partner.code
                 GROUP BY partner.code
                 ORDER BY partner.created_at DESC, partner.code LIMIT $1 OFFSET $2`,
                [PAGE_SIZE, page * PAGE_SIZE]
            ),
            query<{ id: string; name: string; code: string; restaurant_id: string; restaurant_name: string; paid_at: string; amount_cents: number }>(
                `WITH attributed AS (${AFFILIATE_PAID_PURCHASES})
                 SELECT attributed.id, partner.name, partner.code,
                    attributed.restaurant_id, attributed.restaurant_name, attributed.paid_at, attributed.amount_cents
                 FROM attributed
                 JOIN public.affiliate_partners partner ON partner.code = attributed.affiliate_code
                 ORDER BY attributed.paid_at DESC, attributed.id DESC LIMIT $1 OFFSET $2`,
                [PAGE_SIZE, purchasePage * PAGE_SIZE]
            ),
            query<{ partners: number; purchases: number }>(
                `WITH attributed AS (${AFFILIATE_PAID_PURCHASES})
                 SELECT (SELECT COUNT(*)::int FROM public.affiliate_partners) AS partners,
                        (SELECT COUNT(*)::int FROM attributed) AS purchases`
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
