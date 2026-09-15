import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import {
    createPayZuPixCharge,
    PayZuApiError,
    type PayZuTransaction,
} from "@/lib/payzu";
import {
    createPayZuCardRecurringCharge,
    PayZuCardApiError,
    type PayZuCardInput,
} from "@/lib/payzuCard";
import {
    activatePayZuQrTableCard,
    activatePayZuQrTablePrepaid,
    payZuCardPaymentStatus,
    QR_TABLE_PRICE_CENTS,
    savePayZuQrTablePayment,
    setPayZuQrTablePending,
} from "@/lib/qr-table/payzuBilling";
import type { QrTableAddon, QrTableSource } from "@/lib/qr-table/types";
import { hasQrTableAccess } from "@/lib/qr-table/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SOURCES: QrTableSource[] = ["onboarding", "mesas", "settings"];
const CARD_NUMBER_LENGTH = 13;

type CheckoutBody = {
    restaurantId?: string;
    source?: QrTableSource;
    paymentMethod?: "pix" | "credit_card";
    card?: PayZuCardInput;
};

type PayZuPixWithPaidAt = PayZuTransaction & {
    paidAt?: string | null;
};

function validCard(card: PayZuCardInput | undefined): card is PayZuCardInput {
    if (!card) return false;
    const digits = card.number.replace(/\D/g, "");
    const cvv = card.cvv.replace(/\D/g, "");
    return (
        digits.length >= CARD_NUMBER_LENGTH &&
        digits.length <= 19 &&
        card.holder.trim().length >= 2 &&
        /^\d{2}\/\d{4}$/.test(card.expiration.trim()) &&
        cvv.length >= 3 &&
        cvv.length <= 4
    );
}

async function prepareAddon(
    restaurantId: string,
    source: QrTableSource
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
            VALUES ($1, 'qr_code_mesa', 'pending', $2, 'monthly', $3)
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
        [restaurantId, QR_TABLE_PRICE_CENTS, source]
    );

    const addon = result.rows[0];
    if (!addon) {
        throw new Error("Não foi possível preparar o pagamento.");
    }
    return addon;
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as CheckoutBody;
        const restaurantId = String(body.restaurantId || "");
        const source = SOURCES.includes(body.source as QrTableSource)
            ? (body.source as QrTableSource)
            : "mesas";
        const paymentMethod = body.paymentMethod;

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
        if (paymentMethod === "credit_card" && !validCard(body.card)) {
            return NextResponse.json(
                { error: "Preencha os dados do cartão corretamente." },
                { status: 400 }
            );
        }

        const { user, restaurant } = await requireRestaurantOwner(
            request,
            restaurantId
        );
        const addon = await prepareAddon(restaurantId, source);

        if (hasQrTableAccess(addon)) {
            return NextResponse.json(
                { error: "O iMenu QR Code Mesa já está ativo." },
                { status: 409 }
            );
        }

        const origin = new URL(request.url).origin;
        const clientReference = `qr-table:${addon.id}:${randomUUID()}`;

        if (paymentMethod === "pix") {
            const payment = (await createPayZuPixCharge({
                amount: QR_TABLE_PRICE_CENTS / 100,
                callbackUrl: `${origin}/api/webhooks/payzu`,
                clientReference,
            })) as PayZuPixWithPaidAt;

            if (!payment.id) {
                throw new Error("O PayZu não retornou a cobrança Pix.");
            }

            await setPayZuQrTablePending({
                addonId: addon.id,
                paymentId: payment.id,
                method: "PIX",
                status: payment.status || "PENDING",
            });
            await savePayZuQrTablePayment({
                addonId: addon.id,
                paymentId: payment.id,
                method: "PIX",
                status: payment.status || "PENDING",
                paidAt: payment.paidAt || null,
            });

            const active = payment.status === "COMPLETED";
            if (active) {
                await activatePayZuQrTablePrepaid({
                    addonId: addon.id,
                    paymentId: payment.id,
                    method: "PIX",
                    status: payment.status,
                    paidAt: payment.paidAt || null,
                });
            }

            return NextResponse.json({
                active,
                recurring: false,
                paymentMethod,
                paymentStatus: payment.status || null,
                transactionId: payment.id,
                qrCodeText: payment.qrCodeText || null,
                qrCodeBase64: payment.qrCodeBase64 || null,
                qrCodeUrl: payment.qrCodeUrl || null,
            });
        }

        const card = body.card as PayZuCardInput;
        const charge = await createPayZuCardRecurringCharge({
            amountCents: QR_TABLE_PRICE_CENTS,
            externalId: clientReference,
            customerName:
                card.holder.trim() ||
                String(user.user_metadata?.name || "").trim() ||
                restaurant.name ||
                user.email ||
                "Cliente iMenu",
            postbackUrl: `${origin}/api/webhooks/payzu-card`,
            card,
        });
        const paymentId = String(charge.id || "");
        const cardStatus = charge.creditCardPayment?.status;
        const paymentStatus = payZuCardPaymentStatus(cardStatus);
        const recurrenceId = String(
            charge.recurrence?.recurrentPaymentId || ""
        );
        const chargedAt = charge.updatedAt || charge.createdAt || null;

        if (!paymentId) {
            throw new Error("O PayZu não retornou a cobrança do cartão.");
        }

        await setPayZuQrTablePending({
            addonId: addon.id,
            paymentId,
            method: "CREDIT_CARD",
            status: paymentStatus,
            recurrenceId: recurrenceId || null,
        });
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
                return NextResponse.json({
                    active: true,
                    recurring: true,
                    paymentMethod,
                    paymentStatus,
                    transactionId: paymentId,
                });
            }

            await activatePayZuQrTablePrepaid({
                addonId: addon.id,
                paymentId,
                method: "CREDIT_CARD",
                status: paymentStatus,
                paidAt: chargedAt,
            });
            return NextResponse.json({
                active: true,
                recurring: false,
                paymentMethod,
                paymentStatus,
                transactionId: paymentId,
                warning:
                    "Pagamento aprovado, mas a recorrência não foi criada pelo PayZu. O acesso foi liberado por 1 mês.",
            });
        }

        if ([3, 10, 11, 13].includes(Number(cardStatus))) {
            return NextResponse.json(
                {
                    error:
                        charge.creditCardPayment?.reasonMessage ||
                        charge.creditCardPayment?.returnMessage ||
                        "O pagamento no cartão não foi aprovado.",
                    paymentStatus,
                },
                { status: 402 }
            );
        }

        return NextResponse.json({
            active: false,
            recurring: true,
            paymentMethod,
            paymentStatus,
            transactionId: paymentId,
        });
    } catch (error) {
        console.error("[QR_TABLE_CHECKOUT] Falha ao processar pagamento:", error);

        if (
            error instanceof RestaurantOwnerAuthError ||
            error instanceof PayZuApiError ||
            error instanceof PayZuCardApiError
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
