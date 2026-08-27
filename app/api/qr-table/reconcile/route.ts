import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import type { QrTableAddon } from "@/lib/qr-table/types";
import { hasQrTableAccess } from "@/lib/qr-table/types";
import { AsaasApiError, asaasRequest } from "@/lib/services/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AsaasPayment = {
    id?: string;
    subscription?: string;
    value?: number;
    status?: string;
    billingType?: string;
    dueDate?: string;
    paymentDate?: string;
    clientPaymentDate?: string;
    confirmedDate?: string;
    invoiceUrl?: string;
};

type PaymentListResponse = {
    data?: AsaasPayment[];
};

const CONFIRMED_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);

async function savePayment(
    addonId: string,
    payment: AsaasPayment
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
            payment.status || "PENDING",
            payment.billingType || null,
            payment.dueDate || null,
            paidAt,
            payment.invoiceUrl || null,
        ]
    );
}

async function activateAddon(
    addonId: string,
    payment: AsaasPayment
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
        [payment.subscription || "", payment.dueDate || null, addonId]
    );
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { restaurantId?: string };
        const restaurantId = String(body.restaurantId || "");

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não informado." },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);

        const addonResult = await query<QrTableAddon>(
            `
                SELECT *
                FROM public.restaurant_addons
                WHERE restaurant_id = $1
                  AND product_key = 'qr_code_mesa'
                LIMIT 1
            `,
            [restaurantId]
        );
        const addon = addonResult.rows[0] || null;

        if (!addon) {
            return NextResponse.json(
                {
                    active: false,
                    activatedNow: false,
                    status: "inactive",
                    paymentStatus: null,
                },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        if (hasQrTableAccess(addon)) {
            return NextResponse.json(
                {
                    active: true,
                    activatedNow: false,
                    status: addon.status,
                    paymentStatus: null,
                },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        if (!addon.asaas_checkout_id) {
            return NextResponse.json(
                {
                    active: false,
                    activatedNow: false,
                    status: addon.status,
                    paymentStatus: null,
                },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        const paymentList = await asaasRequest<PaymentListResponse>(
            `/payments?checkoutSession=${encodeURIComponent(
                addon.asaas_checkout_id
            )}&limit=100`
        );
        const payments = paymentList.data || [];
        const confirmedPayment = payments.find((payment) =>
            CONFIRMED_PAYMENT_STATUSES.has(
                String(payment.status || "").toUpperCase()
            )
        );
        const observedPayment = confirmedPayment || payments[0] || null;

        if (observedPayment) {
            await savePayment(addon.id, observedPayment);
        }

        if (!confirmedPayment) {
            return NextResponse.json(
                {
                    active: false,
                    activatedNow: false,
                    status: addon.status,
                    paymentStatus: observedPayment?.status || null,
                },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        await activateAddon(addon.id, confirmedPayment);

        return NextResponse.json(
            {
                active: true,
                activatedNow: true,
                status: "active",
                paymentStatus: confirmedPayment.status || null,
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[QR_TABLE_RECONCILE] Falha ao reconciliar checkout:", error);

        if (
            error instanceof RestaurantOwnerAuthError ||
            error instanceof AsaasApiError
        ) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            { error: "Não foi possível confirmar o pagamento." },
            { status: 500 }
        );
    }
}
