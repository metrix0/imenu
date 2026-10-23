"use client";
import { IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";

import { useCallback } from "react";
import { faWandMagicSparkles } from "@fortawesome/free-solid-svg-icons";

import PaymentCheckout from "@/components/payments/PaymentCheckout";
import PaymentCheckoutModal from "@/components/payments/PaymentCheckoutModal";
import { supabase } from "@/lib/database/supabaseClient";
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
    productKey?: "ia_plus";
    renewal?: boolean;
    embedded?: boolean;
    onBack?: () => void;
    onPaid?: () => void | Promise<void>;
};

const PLUS_PAYMENT_PRODUCT = {
    name: "iMenu IA Plus",
    periodLabel: "30 dias (1 mês)",
    detail: "Automações de Marketing WhatsApp, Assistente IA e Vendas IA",
    priceLabel: IA_PLUS_PRICE_LABEL,
    icon: faWandMagicSparkles,
    pixDescription: "Pagamento único • acesso por 1 mês",
    cardDescription: "Cobrança recorrente mensal • cancele quando quiser",
    pixNotice: "O Pix libera um mês de acesso ao iMenu Plus.",
    cardNotice: `Ao pagar, você autoriza a cobrança recorrente mensal de ${IA_PLUS_PRICE_LABEL} até o cancelamento.`,
    pixConfirmationDescription: "Assim que o pagamento for confirmado, o iMenu Plus será liberado automaticamente.",
    cardConfirmationDescription: "Estamos aguardando a confirmação do pagamento. Não feche esta janela.",
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
    productKey = "ia_plus",
    renewal = false,
    embedded = false,
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
                productKey,
            }),
        [renewal, restaurantId, source, productKey]
    );

    const reconcilePayment = useCallback(
        () =>
            reconcileQrTableCheckout(restaurantId, {
                renew: renewal,
                productKey,
            }),
        [renewal, restaurantId, productKey]
    );

    const checkoutProps = {
        onClose,
        product: PLUS_PAYMENT_PRODUCT,
        onBack,
        startPayment,
        reconcilePayment,
        loadCardPrefill,
        successEventName: "imenu:ia-plus-activated",
        onPaid,
    };

    if (embedded) {
        if (!open) return null;
        return <PaymentCheckout {...checkoutProps} />;
    }

    return <PaymentCheckoutModal open={open} {...checkoutProps} />;
}
