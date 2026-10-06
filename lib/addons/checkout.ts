import type { AddonProduct } from "@/lib/addons/products";
import { createMercadoPagoPixCharge, getMercadoPagoPixPayment, isMercadoPagoPixFailureStatus, MercadoPagoPixApiError } from "@/lib/mercadoPagoPix";
import { activateMercadoPagoQrTablePrepaid, saveMercadoPagoQrTablePayment, setMercadoPagoQrTablePending } from "@/lib/qr-table/mercadoPagoBilling";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import {
    getCreditCardPaymentDataError,
    type CreditCardPaymentData,
} from "@/lib/payments/types";
import {
    getPayZuPixCharge,
    PayZuApiError,
    type PayZuTransaction,
} from "@/lib/payzu";
import {
    AsaasApiError,
    asaasRequest,
    formatAsaasDate,
} from "@/lib/qr-table/asaas";
import {
    activatePayZuQrTablePrepaid,
    savePayZuQrTablePayment,
} from "@/lib/qr-table/payzuBilling";
import type { QrTableAddon, QrTableSource } from "@/lib/qr-table/types";
import { hasQrTableAccess, isQrTablePrepaid } from "@/lib/qr-table/types";


const SOURCES: QrTableSource[] = ["onboarding", "mesas", "settings"];
const ASAAS_CARD_TIMEOUT_MS = 65_000;

type CheckoutBody = {
    restaurantId?: string;
    source?: QrTableSource;
    paymentMethod?: "pix" | "credit_card";
    card?: CreditCardPaymentData;
    renew?: boolean;
};

type PayZuPixWithPaidAt = PayZuTransaction & {
    paidAt?: string | null;
};

type AsaasCustomer = {
    id?: string;
};

type AsaasSubscription = {
    id?: string;
    status?: string;
};

type AsaasListResponse<T> = {
    data?: T[];
};

function digits(value: string): string {
    return value.replace(/\D/g, "");
}

function getClientIp(request: Request): string {
    const forwarded = request.headers.get("x-forwarded-for");
    const candidate =
        forwarded?.split(",")[0]?.trim() ||
        request.headers.get("x-real-ip")?.trim() ||
        request.headers.get("cf-connecting-ip")?.trim() ||
        "";

    if (!candidate) {
        throw new RestaurantOwnerAuthError(
            "Não foi possível identificar o dispositivo do pagamento.",
            400
        );
    }

    return candidate;
}

async function prepareAddon(
    restaurantId: string,
    source: QrTableSource,
    product: AddonProduct
): Promise<QrTableAddon> {
    const result = await query<QrTableAddon>(
        `
            INSERT INTO public.restaurant_addons (
                restaurant_id,
                product_key,
                status,
                price_cents,
                billing_cycle,
                acquisition_source
            )
            VALUES ($1, $4, 'pending', $2, 'monthly', $3)
            ON CONFLICT (restaurant_id, product_key)
            DO UPDATE SET
                price_cents = EXCLUDED.price_cents,
                acquisition_source = CASE
                    WHEN restaurant_addons.activated_at IS NULL
                        THEN EXCLUDED.acquisition_source
                    ELSE restaurant_addons.acquisition_source
                END,
                updated_at = NOW()
            RETURNING *
        `,
        [restaurantId, product.priceCents, source, product.key]
    );

    const addon = result.rows[0];
    if (!addon) {
        throw new Error("Não foi possível preparar o pagamento.");
    }
    return addon;
}

async function cancelPendingAsaasSubscription(
    addon: QrTableAddon
): Promise<void> {
    if (
        addon.payment_provider !== "asaas" ||
        !addon.asaas_subscription_id
    ) {
        return;
    }

    try {
        await asaasRequest<void>(
            `/subscriptions/${encodeURIComponent(addon.asaas_subscription_id)}`,
            { method: "DELETE" }
        );
    } catch (error) {
        if (!(error instanceof AsaasApiError) || error.status !== 404) {
            throw error;
        }
    }
}

function payZuFailureStatus(status: string): boolean {
    return [
        "REFUNDED",
        "CANCELED",
        "CANCELLED",
        "EXPIRED",
        "FAILED",
    ].includes(status.toUpperCase());
}

async function existingPayZuPix(
    addon: QrTableAddon,
    options: { reuseCompleted?: boolean } = {}
): Promise<PayZuPixWithPaidAt | null> {
    if (
        addon.payment_provider !== "payzu" ||
        addon.payzu_payment_method !== "PIX" ||
        !addon.payzu_payment_id
    ) {
        return null;
    }

    const payment = (await getPayZuPixCharge({
        id: addon.payzu_payment_id,
    })) as PayZuPixWithPaidAt | null;

    if (!payment || payZuFailureStatus(String(payment.status || ""))) {
        return null;
    }

    const remoteStatus = String(payment.status || "").toUpperCase();
    const storedStatus = String(addon.payzu_payment_status || "").toUpperCase();
    if (
        options.reuseCompleted === false &&
        remoteStatus === "COMPLETED" &&
        storedStatus === "COMPLETED"
    ) {
        return null;
    }

    return payment;
}

async function findAsaasCustomer(
    externalReference: string
): Promise<string | null> {
    const response = await asaasRequest<AsaasListResponse<AsaasCustomer>>(
        `/customers?externalReference=${encodeURIComponent(
            externalReference
        )}&limit=1`
    );
    return response.data?.find((customer) => customer.id)?.id || null;
}

async function getOrCreateAsaasCustomer(
    restaurantId: string,
    card: CreditCardPaymentData
): Promise<string> {
    const cpfCnpj = digits(card.cpfCnpj);
    const externalReference = `qr-table:${restaurantId}:${cpfCnpj}`;
    const existing = await findAsaasCustomer(externalReference);
    if (existing) return existing;

    const customer = await asaasRequest<AsaasCustomer>("/customers", {
        method: "POST",
        body: JSON.stringify({
            name: card.holderName.trim(),
            cpfCnpj,
            email: card.email.trim(),
            mobilePhone: digits(card.mobilePhone),
            postalCode: digits(card.postalCode),
            addressNumber: card.addressNumber.trim(),
            complement: card.addressComplement?.trim() || undefined,
            externalReference,
        }),
    });

    if (!customer.id) {
        throw new Error("O Asaas não retornou o cliente do pagamento.");
    }
    return customer.id;
}

async function findExistingAsaasSubscription(
    addonId: string
): Promise<string | null> {
    const response = await asaasRequest<
        AsaasListResponse<AsaasSubscription>
    >(
        `/subscriptions?externalReference=${encodeURIComponent(
            addonId
        )}&status=ACTIVE&limit=100`
    );

    return response.data?.find((subscription) => subscription.id)?.id || null;
}

async function setAsaasSubscriptionPending(
    addonId: string,
    subscriptionId: string,
    preserveAccess = false
): Promise<void> {
    await query(
        `
            UPDATE public.restaurant_addons
            SET
                status = CASE WHEN $3 THEN status ELSE 'pending' END,
                payment_provider = 'asaas',
                asaas_subscription_id = $2,
                asaas_checkout_id = NULL,
                asaas_checkout_expires_at = NULL,
                payzu_payment_method = NULL,
                payzu_payment_id = NULL,
                payzu_recurrence_id = NULL,
                payzu_payment_status = NULL,
                canceled_at = CASE WHEN $3 THEN canceled_at ELSE NULL END,
                updated_at = NOW()
            WHERE id = $1
        `,
        [addonId, subscriptionId, preserveAccess]
    );
}

export async function checkoutAddon(request: Request, product: AddonProduct) {
    try {
        const body = (await request.json()) as CheckoutBody;
        const restaurantId = String(body.restaurantId || "");
        const source = SOURCES.includes(body.source as QrTableSource)
            ? (body.source as QrTableSource)
            : "mesas";
        const paymentMethod = body.paymentMethod;
        const renew = body.renew === true;

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não informado." },
                { status: 400 }
            );
        }
        if (paymentMethod !== "pix" && paymentMethod !== "credit_card") {
            return NextResponse.json(
                { error: "Forma de pagamento inválida." },
                { status: 400 }
            );
        }
        if (paymentMethod === "credit_card") {
            const validationError = body.card
                ? getCreditCardPaymentDataError(body.card)
                : "Preencha os dados do cartão.";
            if (validationError) {
                return NextResponse.json(
                    { error: validationError },
                    { status: 400 }
                );
            }
        }

        const owner = await requireRestaurantOwner(request, restaurantId);
        const addon = await prepareAddon(restaurantId, source, product);
        const hasAccess = hasQrTableAccess(addon);
        const prepaidAccess =
            hasAccess &&
            isQrTablePrepaid(addon);

        if (hasAccess && (!renew || !prepaidAccess)) {
            return NextResponse.json(
                { error: `O ${product.name} já está ativo.` },
                { status: 409 }
            );
        }

        const preserveAccess = renew && prepaidAccess;
        const origin = new URL(request.url).origin;

        if (paymentMethod === "pix") {
            await cancelPendingAsaasSubscription(addon);

            const reusedPayment = await existingPayZuPix(addon, {
                reuseCompleted: !renew,
            });
            // Existing PayZu charges remain payable/reconcilable; new charges use MP.
            if (reusedPayment) {
                const active = String(reusedPayment.status).toUpperCase() === "COMPLETED";
                await savePayZuQrTablePayment({ addonId: addon.id, paymentId: reusedPayment.id, status: reusedPayment.status, paidAt: reusedPayment.paidAt });
                if (active) await activatePayZuQrTablePrepaid({ addonId: addon.id, paymentId: reusedPayment.id, status: reusedPayment.status, paidAt: reusedPayment.paidAt });
                return NextResponse.json({ active, recurring: false, paymentMethod, paymentStatus: reusedPayment.status, transactionId: reusedPayment.id, qrCodeText: reusedPayment.qrCodeText, qrCodeBase64: reusedPayment.qrCodeBase64, qrCodeUrl: reusedPayment.qrCodeUrl });
            }

            let payment = addon.payment_provider === "mercadopago" && addon.mercadopago_order_id
                ? await getMercadoPagoPixPayment({ id: addon.mercadopago_order_id }) : null;
            if (payment && (isMercadoPagoPixFailureStatus(payment.status) ||
                (payment.status === "approved" && addon.mercadopago_order_status === "APPROVED"))) payment = null;
            if (!payment) {
                // Retrying the same billing cycle must recover the same charge,
                // including when the API succeeded but saving its ID failed.
                const cycle = createHash("sha256").update(`${addon.id}:${addon.mercadopago_order_id || addon.payzu_payment_id || "initial"}`).digest("hex").slice(0, 16);
                const reference = `${product.referencePrefix}:${addon.id}:${cycle}`;
                payment = await createMercadoPagoPixCharge({
                    amount: product.priceCents / 100,
                    notificationUrl: `${origin}/api/webhooks/mercadopago`,
                    externalReference: reference,
                    idempotencyKey: reference,
                    payerEmail:
                        owner.user.email?.trim() ||
                        `qr_table_${addon.id}@fake.com`,
                    payerName: owner.restaurant.name,
                });
            }
            if (payment.paymentMethodId !== "pix" || Math.round(payment.amount * 100) !== product.priceCents ||
                !payment.externalReference?.startsWith(`${product.referencePrefix}:${addon.id}:`)) {
                throw new Error("Cobrança Mercado Pago divergente do pagamento solicitado.");
            }
            await setMercadoPagoQrTablePending({ addonId: addon.id, paymentId: payment.id,
                status: payment.status === "approved" ? "PENDING" : payment.status, preserveAccess });
            await saveMercadoPagoQrTablePayment({ addonId: addon.id, paymentId: payment.id, status: payment.status, paidAt: payment.paidAt, amountCents: product.priceCents });
            const active = payment.status === "approved";
            if (active) await activateMercadoPagoQrTablePrepaid({ addonId: addon.id, paymentId: payment.id, status: payment.status, paidAt: payment.paidAt });
            return NextResponse.json({ active, recurring: false, paymentMethod, paymentStatus: payment.status,
                transactionId: payment.id, qrCodeText: payment.qrCodeText, qrCodeBase64: payment.qrCodeBase64, qrCodeUrl: payment.qrCodeUrl });
        }

        const card = body.card as CreditCardPaymentData;
        const existingSubscription =
            await findExistingAsaasSubscription(addon.id);
        if (existingSubscription) {
            await setAsaasSubscriptionPending(
                addon.id,
                existingSubscription,
                preserveAccess
            );
            return NextResponse.json({
                active: false,
                recurring: true,
                paymentMethod,
                paymentStatus: "PENDING",
                transactionId: existingSubscription,
            });
        }

        const customerId = await getOrCreateAsaasCustomer(
            restaurantId,
            card
        );
        const expiry = card.expiry.trim().match(/^(\d{2})\/(\d{2}|\d{4})$/);
        if (!expiry) {
            return NextResponse.json(
                { error: "Validade do cartão inválida." },
                { status: 400 }
            );
        }

        const subscription = await asaasRequest<AsaasSubscription>(
            "/subscriptions",
            {
                method: "POST",
                body: JSON.stringify({
                    customer: customerId,
                    billingType: "CREDIT_CARD",
                    value: product.priceCents / 100,
                    nextDueDate: formatAsaasDate(new Date()),
                    cycle: "MONTHLY",
                    description: product.name,
                    externalReference: addon.id,
                    creditCard: {
                        holderName: card.holderName.trim(),
                        number: digits(card.number),
                        expiryMonth: expiry[1],
                        expiryYear:
                            expiry[2].length === 2
                                ? `20${expiry[2]}`
                                : expiry[2],
                        ccv: digits(card.ccv),
                    },
                    creditCardHolderInfo: {
                        name: card.holderName.trim(),
                        email: card.email.trim(),
                        cpfCnpj: digits(card.cpfCnpj),
                        postalCode: digits(card.postalCode),
                        addressNumber: card.addressNumber.trim(),
                        ...(card.addressComplement?.trim()
                            ? {
                                  addressComplement:
                                      card.addressComplement.trim(),
                              }
                            : {}),
                        mobilePhone: digits(card.mobilePhone),
                    },
                    remoteIp: getClientIp(request),
                }),
            },
            ASAAS_CARD_TIMEOUT_MS
        );

        if (!subscription.id) {
            throw new Error("O Asaas não retornou a assinatura.");
        }

        await setAsaasSubscriptionPending(
            addon.id,
            subscription.id,
            preserveAccess
        );

        return NextResponse.json({
            active: false,
            recurring: true,
            paymentMethod,
            paymentStatus: subscription.status || "PENDING",
            transactionId: subscription.id,
        });
    } catch (error) {
        console.error("[QR_TABLE_CHECKOUT] Falha ao processar pagamento:", error);

        if (
            error instanceof RestaurantOwnerAuthError ||
            error instanceof PayZuApiError ||
            error instanceof MercadoPagoPixApiError ||
            error instanceof AsaasApiError
        ) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível processar o pagamento.",
            },
            { status: 500 }
        );
    }
}
