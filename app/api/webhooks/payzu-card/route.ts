import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import {
    getPayZuCardCharge,
    PayZuCardApiError,
    type PayZuCardCharge,
    verifyPayZuCardWebhookSignature,
} from "@/lib/payzuCard";
import {
    activatePayZuQrTableCard,
    activatePayZuQrTablePrepaid,
    markPayZuQrTablePaymentFailure,
    payZuCardPaymentStatus,
    QR_TABLE_PRICE_CENTS,
    savePayZuQrTablePayment,
} from "@/lib/qr-table/payzuBilling";
import type { QrTableAddon } from "@/lib/qr-table/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function addonIdFromReference(value: unknown): string | null {
    const match = String(value || "").match(
        /^qr-table:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):/i
    );
    return match?.[1] || null;
}

async function findAddon(charge: PayZuCardCharge): Promise<QrTableAddon | null> {
    const addonId = addonIdFromReference(charge.externalId);
    const paymentId = String(charge.id || "");
    const recurrenceId = String(charge.recurrence?.recurrentPaymentId || "");

    const result = await query<QrTableAddon>(
        `
            SELECT *
            FROM public.restaurant_addons
            WHERE product_key = 'qr_code_mesa'
              AND (
                    ($1 <> '' AND id::text = $1)
                 OR ($2 <> '' AND payzu_payment_id = $2)
                 OR ($3 <> '' AND payzu_recurrence_id = $3)
              )
            ORDER BY
                CASE
                    WHEN $1 <> '' AND id::text = $1 THEN 0
                    WHEN $2 <> '' AND payzu_payment_id = $2 THEN 1
                    ELSE 2
                END
            LIMIT 1
        `,
        [addonId || "", paymentId, recurrenceId]
    );

    return result.rows[0] || null;
}

export async function POST(request: Request) {
    if (!process.env.PAYZU_CARD_WEBHOOK_SECRET?.trim()) {
        return NextResponse.json(
            { error: "Webhook PayZu Cartão não configurado." },
            { status: 503 }
        );
    }

    const rawBody = await request.text();
    if (!verifyPayZuCardWebhookSignature(rawBody, request.headers)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    let payload: any;
    try {
        payload = JSON.parse(rawBody);
    } catch {
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const incoming = (payload?.data || payload) as PayZuCardCharge;
    const chargeId = String(incoming?.id || "");
    if (!chargeId) {
        return NextResponse.json({ received: true });
    }

    try {
        const charge = await getPayZuCardCharge(chargeId);
        const addon = await findAddon(charge);
        if (!addon) {
            return NextResponse.json({ received: true });
        }

        const amountCents = Number(charge.amount);
        if (
            Number.isFinite(amountCents) &&
            amountCents !== QR_TABLE_PRICE_CENTS
        ) {
            console.error("[PAYZU_CARD_QR_TABLE] Valor divergente:", {
                addonId: addon.id,
                expected: QR_TABLE_PRICE_CENTS,
                received: charge.amount,
            });
            return NextResponse.json({ received: true });
        }

        const paymentId = String(charge.id || addon.payzu_payment_id || "");
        const cardStatus = charge.creditCardPayment?.status;
        const paymentStatus = payZuCardPaymentStatus(cardStatus);
        const recurrenceId = String(
            charge.recurrence?.recurrentPaymentId ||
                addon.payzu_recurrence_id ||
                ""
        );
        const chargedAt = charge.updatedAt || charge.createdAt || null;

        if (!paymentId) {
            return NextResponse.json({ received: true });
        }

        await savePayZuQrTablePayment({
            addonId: addon.id,
            paymentId,
            method: "CREDIT_CARD",
            status: paymentStatus,
            paidAt: cardStatus === 2 ? chargedAt : null,
        });

        if (cardStatus === 2) {
            if (recurrenceId) {
                await activatePayZuQrTableCard({
                    addonId: addon.id,
                    paymentId,
                    recurrenceId,
                    status: paymentStatus,
                    chargedAt,
                });
            } else {
                await activatePayZuQrTablePrepaid({
                    addonId: addon.id,
                    paymentId,
                    method: "CREDIT_CARD",
                    status: paymentStatus,
                    paidAt: chargedAt,
                });
            }
        } else if ([3, 10, 11, 13].includes(Number(cardStatus))) {
            await markPayZuQrTablePaymentFailure({
                addonId: addon.id,
                paymentId,
                status: paymentStatus,
                expireAccess: cardStatus === 10 || cardStatus === 11,
            });
        }
    } catch (error) {
        console.error("[PAYZU_CARD_QR_TABLE] Falha ao processar webhook:", error);
        if (error instanceof PayZuCardApiError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status >= 500 ? 500 : 400 }
            );
        }
        return NextResponse.json(
            { error: "Falha ao processar webhook." },
            { status: 500 }
        );
    }

    return NextResponse.json({ received: true });
}
