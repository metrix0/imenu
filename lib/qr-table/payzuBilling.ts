import { query } from "@/lib/database/sql";

export const QR_TABLE_PRICE_CENTS = 500;

export async function savePayZuQrTablePayment(input: {
    addonId: string;
    paymentId: string;
    status: string;
    paidAt?: string | null;
    amountCents?: number;
}): Promise<void> {
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
            VALUES (
                $1,
                $2,
                $3,
                $4,
                'PIX',
                COALESCE($5::timestamptz, NOW())::date,
                $5::timestamptz,
                NULL
            )
            ON CONFLICT (asaas_payment_id)
            DO UPDATE SET
                amount_cents = EXCLUDED.amount_cents,
                status = EXCLUDED.status,
                billing_type = EXCLUDED.billing_type,
                paid_at = COALESCE(
                    EXCLUDED.paid_at,
                    restaurant_addon_payments.paid_at
                ),
                updated_at = NOW()
        `,
        [
            input.addonId,
            input.paymentId,
            input.amountCents ?? QR_TABLE_PRICE_CENTS,
            input.status,
            input.paidAt || null,
        ]
    );
}

export async function setPayZuQrTablePending(input: {
    addonId: string;
    paymentId: string;
    status: string;
    preserveAccess?: boolean;
}): Promise<void> {
    await query(
        `
            UPDATE public.restaurant_addons
            SET
                status = CASE WHEN $4 THEN status ELSE 'pending' END,
                payment_provider = 'payzu',
                payzu_payment_method = 'PIX',
                payzu_payment_id = $2,
                payzu_recurrence_id = NULL,
                payzu_payment_status = $3,
                asaas_checkout_id = NULL,
                asaas_checkout_expires_at = NULL,
                asaas_subscription_id = NULL,
                canceled_at = CASE WHEN $4 THEN canceled_at ELSE NULL END,
                updated_at = NOW()
            WHERE id = $1
        `,
        [
            input.addonId,
            input.paymentId,
            input.status,
            input.preserveAccess === true,
        ]
    );
}

export async function activatePayZuQrTablePrepaid(input: {
    addonId: string;
    paymentId: string;
    status: string;
    paidAt?: string | null;
}): Promise<void> {
    await query(
        `
            UPDATE public.restaurant_addons
            SET
                status = 'canceled',
                payment_provider = 'payzu',
                payzu_payment_method = 'PIX',
                payzu_payment_id = $2,
                payzu_recurrence_id = NULL,
                payzu_payment_status = $3,
                asaas_checkout_id = NULL,
                asaas_checkout_expires_at = NULL,
                asaas_subscription_id = NULL,
                current_period_ends_at = CASE
                    WHEN
                        payzu_payment_id = $2
                        AND UPPER(COALESCE(payzu_payment_status, '')) = 'COMPLETED'
                    THEN current_period_ends_at
                    WHEN
                        current_period_ends_at IS NOT NULL
                        AND current_period_ends_at > COALESCE($4::timestamptz, NOW())
                    THEN current_period_ends_at + INTERVAL '30 days'
                    ELSE
                        COALESCE($4::timestamptz, NOW()) + INTERVAL '1 month 1 day'
                END,
                activated_at = COALESCE(
                    activated_at,
                    COALESCE($4::timestamptz, NOW())
                ),
                canceled_at = COALESCE($4::timestamptz, NOW()),
                updated_at = NOW()
            WHERE id = $1
        `,
        [
            input.addonId,
            input.paymentId,
            input.status,
            input.paidAt || null,
        ]
    );
}

export async function markPayZuQrTablePaymentFailure(input: {
    addonId: string;
    paymentId: string;
    status: string;
    expireAccess?: boolean;
}): Promise<void> {
    await query(
        `
            UPDATE public.restaurant_addons
            SET
                status = CASE
                    WHEN status IN ('active', 'canceled', 'past_due')
                        THEN 'past_due'
                    ELSE 'inactive'
                END,
                payment_provider = 'payzu',
                payzu_payment_id = $2,
                payzu_payment_status = $3,
                current_period_ends_at = CASE
                    WHEN
                        $4
                        AND (
                            current_period_ends_at IS NULL
                            OR current_period_ends_at <= NOW()
                        )
                    THEN NOW()
                    ELSE current_period_ends_at
                END,
                updated_at = NOW()
            WHERE id = $1
              AND payment_provider = 'payzu'
              AND payzu_payment_id = $2
        `,
        [
            input.addonId,
            input.paymentId,
            input.status,
            input.expireAccess === true,
        ]
    );
}
