import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import type { QrTableAddon } from "@/lib/qr-table/types";
import { asaasRequest } from "@/lib/services/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AsaasPayment = {
    id?: string;
    subscription?: string;
    externalReference?: string;
    checkoutSession?: string;
    value?: number;
    status?: string;
    billingType?: string;
    dueDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    confirmedDate?: string;
    invoiceUrl?: string;
};

type AsaasWebhook = {
    id?: string;
    event?: string;
    checkout?: {
        id?: string;
        status?: string;
        externalReference?: string;
    };
    payment?: AsaasPayment;
};

type PaymentListResponse = {
    data?: AsaasPayment[];
};

function validWebhookToken(request: Request): boolean {
    const expected = process.env.ASAAS_WEBHOOK_TOKEN?.trim() || "";
    const received = request.headers.get("asaas-access-token")?.trim() || "";
    if (!expected || !received) return false;

    const expectedBuffer = Buffer.from(expected);
    const receivedBuffer = Buffer.from(received);
    return (
        expectedBuffer.length === receivedBuffer.length &&
        timingSafeEqual(expectedBuffer, receivedBuffer)
    );
}

async function findAddon(
    checkoutId: string | null,
    payment: AsaasPayment | null
): Promise<QrTableAddon | null> {
    const externalReference = String(payment?.externalReference || "");
    const subscriptionId = String(payment?.subscription || "");
    const paymentCheckoutId = String(payment?.checkoutSession || "");

    const result = await query<QrTableAddon>(
        `
            SELECT *
            FROM public.restaurant_addons
            WHERE product_key = 'qr_code_mesa'
              AND (
                    ($1 <> '' AND id::text = $1)
                 OR ($2 <> '' AND asaas_subscription_id = $2)
                 OR ($3 <> '' AND asaas_checkout_id = $3)
                 OR ($4 <> '' AND asaas_checkout_id = $4)
              )
            ORDER BY
                CASE
                    WHEN $1 <> '' AND id::text = $1 THEN 0
                    WHEN $2 <> '' AND asaas_subscription_id = $2 THEN 1
                    ELSE 2
                END
            LIMIT 1
        `,
        [
            externalReference,
            subscriptionId,
            paymentCheckoutId,
            checkoutId || "",
        ]
    );

    return result.rows[0] || null;
}

async function savePayment(
    addonId: string,
    payment: AsaasPayment,
    event: string
): Promise<void> {
    if (!payment.id) return;

    const amountCents = Math.max(
        0,
        Math.round((Number(payment.value) || 0) * 100)
    );
    const paidAt =
        payment.clientPaymentDate ||
        payment.paymentDate ||
        payment.confirmedDate ||
        null;

    await query(
        `
            INSERT INTO public.restaurant_addon_payments (
                addon_id,
                asaas_payment_id,
                amount_cents,
                status,
                billing_type,
                due_date,
                paid_at,
                invoice_url
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (asaas_payment_id)
            DO UPDATE SET
                amount_cents = EXCLUDED.amount_cents,
                status = EXCLUDED.status,
                billing_type = EXCLUDED.billing_type,
                due_date = EXCLUDED.due_date,
                paid_at = COALESCE(
                    EXCLUDED.paid_at,
                    restaurant_addon_payments.paid_at
                ),
                invoice_url = COALESCE(
                    EXCLUDED.invoice_url,
                    restaurant_addon_payments.invoice_url
                ),
                updated_at = NOW()
        `,
        [
            addonId,
            payment.id,
            amountCents,
            payment.status || event.replace(/^PAYMENT_/, ""),
            payment.billingType || null,
            payment.dueDate || null,
            paidAt,
            payment.invoiceUrl || null,
        ]
    );
}

async function activateAddon(
    addonId: string,
    payment?: AsaasPayment | null
): Promise<void> {
    await query(
        `
            UPDATE public.restaurant_addons
            SET
                status = 'active',
                asaas_subscription_id = COALESCE(
                    NULLIF($1, ''),
                    asaas_subscription_id
                ),
                current_period_ends_at = GREATEST(
                    COALESCE(current_period_ends_at, NOW()),
                    COALESCE($2::date::timestamptz, NOW()) + INTERVAL '1 month'
                ),
                activated_at = COALESCE(activated_at, NOW()),
                canceled_at = NULL,
                updated_at = NOW()
            WHERE id = $3
        `,
        [payment?.subscription || "", payment?.dueDate || null, addonId]
    );
}

async function processEvent(payload: AsaasWebhook): Promise<void> {
    const event = String(payload.event || "");
    const checkoutId = String(payload.checkout?.id || "") || null;
    let payment = payload.payment || null;
    let addon = await findAddon(checkoutId, payment);

    if (!addon) return;

    if (event === "CHECKOUT_PAID" && checkoutId) {
        try {
            const paymentList = await asaasRequest<PaymentListResponse>(
                `/payments?checkoutSession=${encodeURIComponent(
                    checkoutId
                )}&limit=1`
            );
            payment = paymentList.data?.[0] || payment;
            addon = (await findAddon(checkoutId, payment)) || addon;
        } catch (error) {
            console.warn(
                "[ASAAS_WEBHOOK] Cobrança do checkout ainda indisponível:",
                error instanceof Error ? error.message : "erro desconhecido"
            );
        }

        await activateAddon(addon.id, payment);
        if (payment) await savePayment(addon.id, payment, event);
        return;
    }

    if (event === "CHECKOUT_CANCELED" || event === "CHECKOUT_EXPIRED") {
        await query(
            `
                UPDATE public.restaurant_addons
                SET
                    status = CASE
                        WHEN status = 'pending' THEN 'inactive'
                        ELSE status
                    END,
                    asaas_checkout_id = NULL,
                    asaas_checkout_expires_at = NULL,
                    updated_at = NOW()
                WHERE id = $1
            `,
            [addon.id]
        );
        return;
    }

    if (!event.startsWith("PAYMENT_") || !payment) return;

    await savePayment(addon.id, payment, event);

    if (event === "PAYMENT_CONFIRMED" || event === "PAYMENT_RECEIVED") {
        await activateAddon(addon.id, payment);
        return;
    }

    if (
        event === "PAYMENT_OVERDUE" ||
        event === "PAYMENT_CREDIT_CARD_CAPTURE_REFUSED"
    ) {
        await query(
            `
                UPDATE public.restaurant_addons
                SET status = 'past_due', updated_at = NOW()
                WHERE id = $1
                  AND status <> 'canceled'
            `,
            [addon.id]
        );
        return;
    }

    if (
        event === "PAYMENT_REFUNDED" ||
        event === "PAYMENT_CHARGEBACK_REQUESTED"
    ) {
        await query(
            `
                UPDATE public.restaurant_addons
                SET
                    status = 'past_due',
                    current_period_ends_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
            `,
            [addon.id]
        );
    }
}

export async function POST(request: Request) {
    if (!process.env.ASAAS_WEBHOOK_TOKEN?.trim()) {
        return NextResponse.json(
            { error: "Webhook não configurado." },
            { status: 503 }
        );
    }

    if (!validWebhookToken(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    let payload: AsaasWebhook;
    try {
        payload = (await request.json()) as AsaasWebhook;
    } catch {
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const eventId = String(payload.id || "");
    const event = String(payload.event || "");
    if (!eventId || !event) {
        return NextResponse.json(
            { error: "Evento inválido." },
            { status: 400 }
        );
    }

    try {
        const inserted = await query<{ event_id: string }>(
            `
                INSERT INTO public.billing_webhook_events (
                    event_id,
                    event_type
                )
                VALUES ($1, $2)
                ON CONFLICT (event_id) DO NOTHING
                RETURNING event_id
            `,
            [eventId, event]
        );

        if (!inserted.rows[0]) {
            const existing = await query<{ processed_at: string | null }>(
                `
                    SELECT processed_at
                    FROM public.billing_webhook_events
                    WHERE event_id = $1
                    LIMIT 1
                `,
                [eventId]
            );

            if (existing.rows[0]?.processed_at) {
                return NextResponse.json({ received: true, duplicate: true });
            }
        }

        await processEvent(payload);
        await query(
            `
                UPDATE public.billing_webhook_events
                SET
                    processed_at = NOW(),
                    processing_error = NULL
                WHERE event_id = $1
            `,
            [eventId]
        );

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error("[ASAAS_WEBHOOK] Falha ao processar evento:", error);
        await query(
            `
                UPDATE public.billing_webhook_events
                SET processing_error = $2
                WHERE event_id = $1
            `,
            [
                eventId,
                error instanceof Error
                    ? error.message.slice(0, 500)
                    : "Erro desconhecido",
            ]
        ).catch(() => undefined);

        return NextResponse.json(
            { error: "Falha ao processar evento." },
            { status: 500 }
        );
    }
}
