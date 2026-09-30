import { NextResponse } from "next/server";

import { query, withTransaction } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import {
    getMercadoPagoPixPayment,
    isMercadoPagoPixFailureStatus,
    type MercadoPagoPixPayment,
} from "@/lib/mercadoPagoPix";
import {
    activateMercadoPagoQrTablePrepaid,
    markMercadoPagoQrTablePaymentFailure,
    saveMercadoPagoQrTablePayment,
} from "@/lib/qr-table/mercadoPagoBilling";
import { QR_TABLE_PRICE_CENTS } from "@/lib/qr-table/payzuBilling";
import { notifyOrderReady } from "@/lib/push/server";

function qrTableAddonId(externalReference: string): string | null {
    const match = externalReference.match(
        /^qr-table:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):/i
    );
    return match?.[1] || null;
}

async function processQrTablePix(
    payment: MercadoPagoPixPayment,
    addonId: string
): Promise<void> {
    const addonResult = await query<{
        id: string;
        payment_provider: string | null;
        mercadopago_order_id: string | null;
    }>(
        `
            SELECT id, payment_provider, mercadopago_order_id
            FROM public.restaurant_addons
            WHERE id = $1
              AND product_key = 'qr_code_mesa'
            LIMIT 1
        `,
        [addonId]
    );
    const addon = addonResult.rows[0];
    if (addon && (!addon.mercadopago_order_id || addon.payment_provider !== "mercadopago")) {
        // Charge creation can still be saving the provider reference. Ask MP to retry.
        throw new Error("A cobrança Pix ainda não está vinculada ao adicional.");
    }

    if (
        !addon ||
        addon.payment_provider !== "mercadopago" ||
        (addon.mercadopago_order_id &&
            addon.mercadopago_order_id !== payment.id)
    ) {
        return;
    }

    const paidAmountCents = Math.round(payment.amount * 100);
    if (
        !Number.isFinite(paidAmountCents) ||
        paidAmountCents !== QR_TABLE_PRICE_CENTS
    ) {
        console.error("[MERCADO_PAGO_QR_TABLE] Valor divergente:", {
            addonId,
            expected: QR_TABLE_PRICE_CENTS,
            received: payment.amount,
        });
        return;
    }

    const status = String(payment.status || "pending").toLowerCase();

    await saveMercadoPagoQrTablePayment({
        addonId,
        paymentId: payment.id,
        status,
        paidAt: payment.paidAt,
        amountCents: paidAmountCents,
    });

    if (status === "approved") {
        await activateMercadoPagoQrTablePrepaid({
            addonId,
            paymentId: payment.id,
            status,
            paidAt: payment.paidAt,
        });
        return;
    }

    if (isMercadoPagoPixFailureStatus(status)) {
        await markMercadoPagoQrTablePaymentFailure({
            addonId,
            paymentId: payment.id,
            status,
            expireAccess: [
                "refunded",
                "cancelled",
                "canceled",
                "charged_back",
            ].includes(status),
        });
    }
}

async function processOrderPix(
    payment: MercadoPagoPixPayment,
    orderId: string
): Promise<void> {
    const orderResult = await query<{
        id: string;
        status: string;
        total_cents: number;
        payment_ref: string | null;
        payment_method: string | null;
        restaurant_id: string;
    }>(
        `
            SELECT id, status, total_cents, payment_ref, payment_method, restaurant_id
            FROM orders
            WHERE id = $1
            LIMIT 1
        `,
        [orderId]
    );
    const order = orderResult.rows[0];

    if (!order || order.payment_method !== "pix") return;

    if (
        order.payment_ref &&
        String(order.payment_ref) !== payment.id
    ) {
        console.error("[MERCADO_PAGO] Referência de pagamento divergente:", {
            orderId: order.id,
            storedPaymentRef: order.payment_ref,
            paymentId: payment.id,
        });
        return;
    }

    const paidAmountCents = Math.round(payment.amount * 100);
    if (
        !Number.isFinite(paidAmountCents) ||
        paidAmountCents !== Number(order.total_cents)
    ) {
        console.error("[MERCADO_PAGO] Valor do pagamento divergente:", {
            orderId: order.id,
            expected: order.total_cents,
            received: payment.amount,
        });
        return;
    }

    const supabase = createSupabaseServerClient();

    if (String(payment.status).toLowerCase() !== "approved") {
        if (order.status === "pending_online_payment") {
            const { error: printJobError } = await supabase
                .from("print_jobs")
                .update({ status: "canceled" })
                .eq("order_id", order.id)
                .eq("status", "queued");

            if (printJobError) throw printJobError;
        }
        return;
    }

    const confirmed = await withTransaction(async (client) => {
        const locked = await client.query(
            "SELECT * FROM public.orders WHERE id = $1 FOR UPDATE", [order.id]
        );
        const current = locked.rows[0];
        if (!current || !["pending_online_payment", "paid"].includes(current.status) ||
            current.payment_method !== "pix" || Number(current.total_cents) !== paidAmountCents ||
            (current.payment_ref && current.payment_ref !== payment.id)) return false;
        const updateResult = await client.query(
            `UPDATE public.orders SET status = 'paid', payment_ref = COALESCE(payment_ref, $2), updated_at = NOW()
             WHERE id = $1 AND status = 'pending_online_payment'
             RETURNING id`, [order.id, payment.id]
        );
        // The order lock and transaction make status + print enqueue retryable together.
        const printResult = await client.query(
            `INSERT INTO public.print_jobs (restaurant_id, order_id)
             SELECT $1, $2 WHERE NOT EXISTS (
                 SELECT 1 FROM public.print_jobs WHERE order_id = $2 AND status IN ('queued', 'printing', 'printed')
             )
             RETURNING id`, [current.restaurant_id, order.id]
        );
        return (updateResult.rowCount || 0) > 0 || (printResult.rowCount || 0) > 0;
    });
    if (!confirmed) return;

    try {
        await notifyOrderReady(order.id);
    } catch (pushError) {
        console.error(
            "[OWNER_PUSH] Failed after Mercado Pago payment:",
            pushError
        );
    }
}

function extractPaymentId(body: any, searchParams: URLSearchParams): string {
    const raw =
        body?.data?.id ||
        searchParams.get("data.id") ||
        searchParams.get("id") ||
        body?.resource ||
        "";

    const value = String(raw || "").trim();
    if (!value) return "";

    if (/^https?:\/\//i.test(value)) {
        try {
            return new URL(value).pathname.split("/").filter(Boolean).pop() || "";
        } catch {
            return "";
        }
    }

    return value;
}

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    let body: any = {};

    try {
        body = await req.json();
    } catch {
        // Mercado Pago can send the resource ID in the query string.
    }

    const topic = String(
        searchParams.get("topic") ||
            searchParams.get("type") ||
            body?.type ||
            ""
    ).toLowerCase();
    const action = String(body?.action || "").toLowerCase();
    const paymentId = extractPaymentId(body, searchParams);

    if (
        !paymentId ||
        (topic && topic !== "payment") ||
        (action && !action.startsWith("payment."))
    ) {
        return NextResponse.json({ ok: true });
    }

    try {
        const payment = await getMercadoPagoPixPayment({
            id: paymentId,
        });

        if (
            !payment ||
            payment.id !== paymentId ||
            String(payment.paymentMethodId || "").toLowerCase() !== "pix" ||
            !payment.externalReference
        ) {
            console.error(
                "[MERCADO_PAGO] Webhook não corresponde a um Pix do iMenu:",
                { paymentId }
            );
            return NextResponse.json({ ok: true });
        }

        const addonId = qrTableAddonId(payment.externalReference);
        if (addonId) {
            await processQrTablePix(payment, addonId);
            return NextResponse.json({ ok: true });
        }

        if (/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(payment.externalReference)) {
            await processOrderPix(payment, payment.externalReference);
        }
    } catch (error) {
        console.error(
            "[MERCADO_PAGO] Falha ao processar webhook:",
            error
        );
        return NextResponse.json({ error: "Falha ao processar pagamento." }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
}
