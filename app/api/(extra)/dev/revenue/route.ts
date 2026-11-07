import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

// First confirmed payment for each Plus subscription; renewals are excluded.
const firstPurchases = `
    WITH paid AS (
        SELECT payment.id::text AS id,
            addon.restaurant_id::text AS restaurant_id,
            restaurant.name AS restaurant_name,
            payment.paid_at,
            payment.amount_cents,
            addon.payment_provider,
            CASE
                WHEN UPPER(COALESCE(NULLIF(payment.billing_type, ''), NULLIF(addon.payzu_payment_method, ''), '')) = 'PIX' THEN 'Pix'
                WHEN UPPER(COALESCE(NULLIF(payment.billing_type, ''), NULLIF(addon.payzu_payment_method, ''), '')) IN ('CREDIT_CARD', 'CREDIT CARD', 'CARD') THEN 'Cartão'
                ELSE 'Outro'
            END AS method,
            ROW_NUMBER() OVER (
                PARTITION BY payment.addon_id ORDER BY payment.paid_at, payment.id
            ) AS purchase_rank
        FROM public.restaurant_addon_payments payment
        JOIN public.restaurant_addons addon ON addon.id = payment.addon_id AND addon.product_key = 'ia_plus'
        JOIN public.restaurants restaurant ON restaurant.id = addon.restaurant_id
        WHERE payment.paid_at IS NOT NULL
          AND payment.amount_cents > 0
          AND UPPER(payment.status) IN ('CONFIRMED', 'RECEIVED', 'RECEIVED_IN_CASH', 'PAID', 'COMPLETED', 'APPROVED')
    ), first_purchases AS (
        SELECT * FROM paid WHERE purchase_rank = 1
    )
`;

type SummaryRow = {
    purchases30: number | string;
    gross30: number | string;
    pix30: number | string;
    pix_gross30: number | string;
    card30: number | string;
    card_gross30: number | string;
    other30: number | string;
};
type PurchaseRow = {
    id: string;
    restaurant_id: string;
    restaurant_name: string;
    paid_at: string;
    amount_cents: number | string;
    method: string;
    payment_provider: string | null;
    total: number | string;
};

export async function GET(request: Request) {
    try {
        const authError = await authorize(request);
        if (authError) return authError;

        const pageParam = new URL(request.url).searchParams.get("page") || "0";
        if (!/^\d+$/.test(pageParam) || Number(pageParam) > 10000) {
            return NextResponse.json({ error: "Página inválida." }, { status: 400 });
        }
        const page = Number(pageParam);
        const [summaryResult, purchasesResult] = await Promise.all([
            query<SummaryRow>(`${firstPurchases}
                SELECT
                    COUNT(*) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days')::int AS purchases30,
                    COALESCE(SUM(amount_cents) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days'), 0)::bigint AS gross30,
                    COUNT(*) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days' AND method = 'Pix')::int AS pix30,
                    COALESCE(SUM(amount_cents) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days' AND method = 'Pix'), 0)::bigint AS pix_gross30,
                    COUNT(*) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days' AND method = 'Cartão')::int AS card30,
                    COALESCE(SUM(amount_cents) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days' AND method = 'Cartão'), 0)::bigint AS card_gross30,
                    COUNT(*) FILTER (WHERE paid_at >= NOW() - INTERVAL '30 days' AND method = 'Outro')::int AS other30
                FROM first_purchases
            `),
            query<PurchaseRow>(`${firstPurchases}
                SELECT id, restaurant_id, restaurant_name, paid_at, amount_cents,
                    method, payment_provider, COUNT(*) OVER()::int AS total
                FROM first_purchases
                ORDER BY paid_at DESC, id DESC
                LIMIT $1 OFFSET $2
            `, [PAGE_SIZE, page * PAGE_SIZE]),
        ]);
        const summary = summaryResult.rows[0];
        const total = Number(purchasesResult.rows[0]?.total || 0);
        return NextResponse.json({
            summary: {
                purchases30: Number(summary?.purchases30 || 0),
                gross30: Number(summary?.gross30 || 0),
                pix30: Number(summary?.pix30 || 0),
                pixGross30: Number(summary?.pix_gross30 || 0),
                card30: Number(summary?.card30 || 0),
                cardGross30: Number(summary?.card_gross30 || 0),
                other30: Number(summary?.other30 || 0),
            },
            purchases: {
                rows: purchasesResult.rows.map(row => ({
                    id: row.id,
                    restaurantId: row.restaurant_id,
                    restaurantName: row.restaurant_name,
                    paidAt: row.paid_at,
                    amountCents: Number(row.amount_cents),
                    method: row.method,
                    provider: row.payment_provider,
                })),
                total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            },
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("[DEV_REVENUE]", error);
        return NextResponse.json({ error: "Não foi possível carregar a receita." }, { status: 500 });
    }
}
