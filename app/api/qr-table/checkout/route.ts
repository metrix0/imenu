import { NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import type { QrTableAddon, QrTableSource } from "@/lib/qr-table/types";
import { hasQrTableAccess } from "@/lib/qr-table/types";
import {
    AsaasApiError,
    asaasRequest,
    buildAsaasCheckoutUrl,
    formatAsaasDate,
} from "@/lib/services/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECKOUT_EXPIRATION_MINUTES = 60;
const SOURCES: QrTableSource[] = ["onboarding", "mesas", "settings"];

type CheckoutResponse = {
    id: string;
    link?: string;
};

function getReturnPath(source: QrTableSource): string {
    if (source === "onboarding") return "/restaurante/criar/localizacao";
    if (source === "settings") return "/painel/configuracoes";
    return "/painel/mesas";
}

export async function POST(request: Request) {
    try {
        const body = (await request.json()) as {
            restaurantId?: string;
            source?: QrTableSource;
        };
        const restaurantId = String(body.restaurantId || "");
        const source = SOURCES.includes(body.source as QrTableSource)
            ? (body.source as QrTableSource)
            : "mesas";

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não informado." },
                { status: 400 }
            );
        }

        const { user, restaurant } = await requireRestaurantOwner(
            request,
            restaurantId
        );
        const customerEmail = user.email?.trim() || "";
        const customerPhone = String(
            user.user_metadata?.phone || restaurant.phone || ""
        ).replace(/\D/g, "");
        const hasValidCustomerData =
            /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerEmail) &&
            /^\d{10,11}$/.test(customerPhone);

        const addonResult = await query<QrTableAddon>(
            `
                INSERT INTO public.restaurant_addons (
                    restaurant_id,
                    product_key,
                    status,
                    price_cents,
                    billing_cycle,
                    acquisition_source
                )
                VALUES ($1, 'qr_code_mesa', 'pending', 500, 'monthly', $2)
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
            [restaurantId, source]
        );
        const addon = addonResult.rows[0];

        if (!addon) {
            throw new Error("Não foi possível preparar a assinatura.");
        }

        if (hasQrTableAccess(addon)) {
            return NextResponse.json(
                { error: "O iMenu QR Code Mesa já está ativo." },
                { status: 409 }
            );
        }

        const checkoutExpiresAt = addon.asaas_checkout_expires_at
            ? new Date(addon.asaas_checkout_expires_at).getTime()
            : 0;

        if (
            addon.asaas_checkout_id &&
            Number.isFinite(checkoutExpiresAt) &&
            checkoutExpiresAt > Date.now()
        ) {
            return NextResponse.json({
                checkoutUrl: buildAsaasCheckoutUrl(addon.asaas_checkout_id),
            });
        }

        const origin = new URL(request.url).origin;
        const returnPath = getReturnPath(source);
        const nextDueDate = formatAsaasDate(new Date());
        const checkout = await asaasRequest<CheckoutResponse>("/checkouts", {
            method: "POST",
            body: JSON.stringify({
                billingTypes: ["CREDIT_CARD"],
                chargeTypes: ["RECURRENT"],
                minutesToExpire: CHECKOUT_EXPIRATION_MINUTES,
                externalReference: addon.id,
                ...(hasValidCustomerData
                    ? {
                          customerData: {
                              name: "",
                              email: customerEmail,
                              phone: customerPhone,
                          },
                      }
                    : {}),
                callback: {
                    successUrl: `${origin}${returnPath}?checkout=success`,
                    cancelUrl: `${origin}${returnPath}?checkout=cancel`,
                    expiredUrl: `${origin}${returnPath}?checkout=expired`,
                },
                items: [
                    {
                        externalReference: addon.id,
                        name: "iMenu QR Code Mesa",
                        description:
                            "Pedidos por QR Code identificados por mesa.",
                        quantity: 1,
                        value: 5,
                    },
                ],
                subscription: {
                    cycle: "MONTHLY",
                    nextDueDate,
                },
            }),
        });

        if (!checkout.id) {
            throw new Error("O Asaas não retornou o checkout.");
        }

        await query(
            `
                UPDATE public.restaurant_addons
                SET
                    status = 'pending',
                    asaas_checkout_id = $1,
                    asaas_checkout_expires_at = NOW() + ($2 * INTERVAL '1 minute'),
                    updated_at = NOW()
                WHERE id = $3
            `,
            [checkout.id, CHECKOUT_EXPIRATION_MINUTES, addon.id]
        );

        return NextResponse.json({
            checkoutUrl: checkout.link || buildAsaasCheckoutUrl(checkout.id),
        });
    } catch (error) {
        console.error("[QR_TABLE_CHECKOUT] Falha ao criar checkout:", error);

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
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível iniciar a assinatura.",
            },
            { status: 500 }
        );
    }
}
