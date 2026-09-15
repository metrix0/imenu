import { NextResponse } from "next/server";

import {
    getAuthenticatedUser,
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import {
    getPayZuPixCharge,
    PayZuApiError,
    type PayZuTransaction,
} from "@/lib/payzu";
import {
    getPayZuCardCharge,
    PayZuCardApiError,
} from "@/lib/payzuCard";
import { AsaasApiError, asaasRequest } from "@/lib/qr-table/asaas";
import {
    activatePayZuQrTableCard,
    activatePayZuQrTablePrepaid,
    markPayZuQrTablePaymentFailure,
    payZuCardPaymentStatus,
    savePayZuQrTablePayment,
} from "@/lib/qr-table/payzuBilling";
import type { QrTableAddon } from "@/lib/qr-table/types";
import { hasQrTableAccess } from "@/lib/qr-table/types";

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

type PayZuPixWithPaidAt = PayZuTransaction & {
    paidAt?: string | null;
};

const CONFIRMED_PAYMENT_STATUSES = new Set(["CONFIRMED", "RECEIVED"]);

async function saveLegacyAsaasPayment(
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

async function activateLegacyAsaasAddon(
    addon: QrTableAddon,
    payment: AsaasPayment
): Promise<"active" | "canceled"> {
    const subscriptionId =
        payment.billingType === "PIX"
            ? ""
            : payment.subscription || addon.asaas_subscription_id || "";
    const status = subscriptionId ? "active" : "canceled";

    await query(
        `
            UPDATE public.restaurant_addons
            SET
                status = $1,
                asaas_subscription_id = NULLIF($2, ''),
                current_period_ends_at = GREATEST(
                    COALESCE(current_period_ends_at, NOW()),
                    COALESCE($3::date::timestamptz, NOW()) + INTERVAL '1 month 1 day'
                ),
                activated_at = COALESCE(activated_at, NOW()),
                canceled_at = CASE
                    WHEN $1 = 'canceled' THEN COALESCE(canceled_at, NOW())
                    ELSE NULL
                END,
                updated_at = NOW()
            WHERE id = $4
        `,
        [status, subscriptionId, payment.dueDate || null, addon.id]
    );

    return status;
}

async function reconcilePayZu(addon: QrTableAddon) {
    if (!addon.payzu_payment_id) {
        return {
            active: false,
            activatedNow: false,
            status: addon.status,
            paymentStatus: addon.payzu_payment_status,
        };
    }

    if (addon.payzu_payment_method === "PIX") {
        const payment = (await getPayZuPixCharge({
            id: addon.payzu_payment_id,
        })) as PayZuPixWithPaidAt | null;

        if (!payment) {
            return {
                active: false,
                activatedNow: false,
                status: addon.status,
                paymentStatus: addon.payzu_payment_status,
            };
        }

        await savePayZuQrTablePayment({
            addonId: addon.id,
            paymentId: payment.id,
            method: "PIX",
            status: payment.status || "PENDING",
            paidAt: payment.paidAt || null,
        });

        if (payment.status === "COMPLETED") {
            await activatePayZuQrTablePrepaid({
                addonId: addon.id,
                paymentId: payment.id,
                method: "PIX",
                status: payment.status,
                paidAt: payment.paidAt || null,
            });
            return {
                active: true,
                activatedNow: true,
                status: "canceled",
                paymentStatus: payment.status,
            };
        }

        if (
            ["REFUNDED", "CANCELED", "CANCELLED", "EXPIRED", "FAILED"].includes(
                String(payment.status || "").toUpperCase()
            )
        ) {
            await markPayZuQrTablePaymentFailure({
                addonId: addon.id,
                paymentId: payment.id,
                status: payment.status || "FAILED",
                expireAccess: ["REFUNDED", "CANCELED", "CANCELLED"].includes(
                    String(payment.status || "").toUpperCase()
                ),
            });
        }

        return {
            active: false,
            activatedNow: false,
            status: addon.status,
            paymentStatus: payment.status || null,
        };
    }

    const charge = await getPayZuCardCharge(addon.payzu_payment_id);
    const cardStatus = charge.creditCardPayment?.status;
    const paymentStatus = payZuCardPaymentStatus(cardStatus);
    const recurrenceId = String(
        charge.recurrence?.recurrentPaymentId || addon.payzu_recurrence_id || ""
    );
    const chargedAt = charge.updatedAt || charge.createdAt || null;

    await savePayZuQrTablePayment({
        addonId: addon.id,
        paymentId: addon.payzu_payment_id,
        method: "CREDIT_CARD",
        status: paymentStatus,
        paidAt: cardStatus === 2 ? chargedAt : null,
    });

    if (cardStatus === 2) {
        if (recurrenceId) {
            await activatePayZuQrTableCard({
                addonId: addon.id,
                paymentId: addon.payzu_payment_id,
                recurrenceId,
                status: paymentStatus,
                chargedAt,
            });
            return {
                active: true,
                activatedNow: true,
                status: "active",
                paymentStatus,
            };
        }

        await activatePayZuQrTablePrepaid({
            addonId: addon.id,
            paymentId: addon.payzu_payment_id,
            method: "CREDIT_CARD",
            status: paymentStatus,
            paidAt: chargedAt,
        });
        return {
            active: true,
            activatedNow: true,
            status: "canceled",
            paymentStatus,
        };
    }

    if ([3, 10, 11, 13].includes(Number(cardStatus))) {
        await markPayZuQrTablePaymentFailure({
            addonId: addon.id,
            paymentId: addon.payzu_payment_id,
            status: paymentStatus,
            expireAccess: cardStatus === 10 || cardStatus === 11,
        });
    }

    return {
        active: false,
        activatedNow: false,
        status: addon.status,
        paymentStatus,
    };
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as { restaurantId?: string };
        let restaurantId = String(body.restaurantId || "");

        if (restaurantId) {
            await requireRestaurantOwner(request, restaurantId);
        } else {
            const user = await getAuthenticatedUser(request);
            const restaurantResult = await query<{ id: string }>(
                `
                    SELECT id
                    FROM public.restaurants
                    WHERE user_id = $1
                    ORDER BY created_at ASC
                    LIMIT 1
                `,
                [user.id]
            );
            restaurantId = restaurantResult.rows[0]?.id || "";

            if (!restaurantId) {
                return NextResponse.json(
                    { error: "Restaurante não encontrado." },
                    { status: 404 }
                );
            }
        }

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
                    paymentStatus:
                        addon.payzu_payment_status || null,
                },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        if (addon.payment_provider === "payzu") {
            return NextResponse.json(await reconcilePayZu(addon), {
                headers: { "Cache-Control": "no-store" },
            });
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
            await saveLegacyAsaasPayment(addon.id, observedPayment);
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

        const activatedStatus = await activateLegacyAsaasAddon(
            addon,
            confirmedPayment
        );

        return NextResponse.json(
            {
                active: true,
                activatedNow: true,
                status: activatedStatus,
                paymentStatus: confirmedPayment.status || null,
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[QR_TABLE_RECONCILE] Falha ao reconciliar pagamento:", error);

        if (
            error instanceof RestaurantOwnerAuthError ||
            error instanceof AsaasApiError ||
            error instanceof PayZuApiError ||
            error instanceof PayZuCardApiError
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
