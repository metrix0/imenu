"use client";

import { useCallback } from "react";
import { faQrcode } from "@fortawesome/free-solid-svg-icons";

import PaymentCheckoutModal from "@/components/payments/PaymentCheckoutModal";
import { supabase } from "@/lib/database/supabaseClient";
import type { OnlinePaymentMethod } from "@/lib/payments/types";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";
import {
    reconcileQrTableCheckout,
    startQrTableCheckout,
} from "@/lib/qr-table/clientApi";
import type { QrTableSource } from "@/lib/qr-table/types";

type QrCodeMesaCheckoutModalProps = {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    source: QrTableSource;
    renewal?: boolean;
    onBack?: () => void;
    onPaid?: () => void | Promise<void>;
};

const QR_TABLE_PAYMENT_PRODUCT = {
    name: "iMenu QR Code Mesa",
    periodLabel: "30 dias (1 mês)",
    detail: "Mesas e QR Codes ilimitados",
    priceLabel: "R$ 5,00",
    icon: faQrcode,
    pixDescription: "Pagamento único • acesso por 1 mês",
    cardDescription: "Cobrança recorrente mensal • cancele quando quiser",
    pixNotice:
        "O Pix libera o acesso por 1 mês, você receberá uma notificação no iMenu e Whatsapp antes da assinatura expirar.",
    cardNotice:
        "Ao pagar, você autoriza a cobrança recorrente mensal de R$ 5,00 até o cancelamento.",
    pixConfirmationDescription:
        "Assim que o PayZu confirmar o pagamento, o QR Code Mesa será liberado automaticamente.",
    cardConfirmationDescription:
        "Estamos aguardando a confirmação do Asaas. Não feche esta janela.",
} as const;

function textValue(value: unknown): string {
    if (value === null || value === undefined) return "";
    return String(value).trim();
}

function formatOwnerPhone(value: unknown): string {
    let digits = textValue(value).replace(/\D/g, "");

    if (digits.startsWith("55") && digits.length >= 12) {
        digits = digits.slice(2);
    }

    digits = digits.slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }
    if (digits.length <= 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatPostalCode(value: unknown): string {
    const digits = textValue(value).replace(/\D/g, "").slice(0, 8);
    return digits.length > 5
        ? `${digits.slice(0, 5)}-${digits.slice(5)}`
        : digits;
}

export default function QrCodeMesaCheckoutModal({
    open,
    onClose,
    restaurantId,
    source,
    renewal = false,
    onBack,
    onPaid,
}: QrCodeMesaCheckoutModalProps) {
    const loadCardPrefill = useCallback(async () => {
        const [
            {
                data: { user },
            },
            { data: restaurant },
        ] = await Promise.all([
            supabase.auth.getUser(),
            supabase
                .from("restaurants")
                .select("address")
                .eq("id", restaurantId)
                .maybeSingle(),
        ]);

        const address =
            restaurant?.address &&
            typeof restaurant.address === "object" &&
            !Array.isArray(restaurant.address)
                ? (restaurant.address as Record<string, unknown>)
                : {};
        const ownerPhone =
            user?.user_metadata?.phone ?? user?.phone ?? "";

        return {
            email: user?.email || "",
            mobilePhone: formatOwnerPhone(ownerPhone),
            postalCode: formatPostalCode(address.cep),
            addressNumber: textValue(address.number),
            addressComplement: textValue(address.complement),
        };
    }, [restaurantId]);

    const startPayment = useCallback(
        (payment: Parameters<typeof startQrTableCheckout>[2]) =>
            startQrTableCheckout(restaurantId, source, payment, {
                renew: renewal,
            }),
        [renewal, restaurantId, source]
    );

    const reconcilePayment = useCallback(
        () =>
            reconcileQrTableCheckout(restaurantId, {
                renew: renewal,
            }),
        [renewal, restaurantId]
    );

    const trackPaymentStarted = useCallback(
        (method: OnlinePaymentMethod) => {
            void captureQrTableEvent("qr_code_mesa_purchase_started", {
                restaurant_id: restaurantId,
                source,
                payment_method: method,
            });
        },
        [restaurantId, source]
    );

    return (
        <PaymentCheckoutModal
            open={open}
            onClose={onClose}
            product={QR_TABLE_PAYMENT_PRODUCT}
            onBack={onBack}
            startPayment={startPayment}
            reconcilePayment={reconcilePayment}
            loadCardPrefill={loadCardPrefill}
            onPaymentStarted={trackPaymentStarted}
            successEventName="imenu:qr-table-activated"
            onPaid={onPaid}
        />
    );
}
