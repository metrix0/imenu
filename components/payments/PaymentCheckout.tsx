"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faCalendarDays,
    faCopy,
} from "@fortawesome/free-solid-svg-icons";
import type { IconDefinition } from "@fortawesome/fontawesome-svg-core";

import PaymentForm from "@/components/payments/PaymentForm";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import {
    EMPTY_CREDIT_CARD_PAYMENT_DATA,
    getCreditCardPaymentDataError,
    type CreditCardPaymentData,
    type OnlinePaymentMethod,
    type PaymentCheckoutInput,
} from "@/lib/payments/types";

export type PaymentCheckoutResult = {
    active: boolean;
    recurring?: boolean;
    paymentMethod: OnlinePaymentMethod;
    paymentStatus: string | null;
    transactionId?: string;
    qrCodeText?: string | null;
    qrCodeBase64?: string | null;
    qrCodeUrl?: string | null;
};

export type PaymentCheckoutProduct = {
    name: string;
    periodLabel: string;
    detail: string;
    priceLabel: string;
    icon: IconDefinition;
    pixDescription: string;
    cardDescription: string;
    pixNotice: string;
    cardNotice: string;
    pixConfirmationDescription: string;
    cardConfirmationDescription: string;
};

export type PaymentCheckoutProps = {
    product: PaymentCheckoutProduct;
    onBack?: () => void;
    onClose: () => void;
    startPayment: (
        payment: PaymentCheckoutInput
    ) => Promise<PaymentCheckoutResult>;
    reconcilePayment: () => Promise<{
        active: boolean;
        paymentStatus: string | null;
    }>;
    loadCardPrefill?: () => Promise<Partial<CreditCardPaymentData>>;
    onPaymentStarted?: (
        method: OnlinePaymentMethod
    ) => void | Promise<void>;
    successEventName?: string;
    onPaid?: () => void | Promise<void>;
};

type Phase = "form" | "pix" | "processing";

const FAILED_PAYMENT_STATUSES = new Set([
    "ABORTED",
    "CANCELED",
    "CANCELLED",
    "CHARGEBACK_REQUESTED",
    "DENIED",
    "EXPIRED",
    "FAILED",
    "OVERDUE",
    "REFUNDED",
    "REFUSED",
    "VOIDED",
]);

export default function PaymentCheckout({
    product,
    onBack,
    onClose,
    startPayment,
    reconcilePayment,
    loadCardPrefill,
    onPaymentStarted,
    successEventName,
    onPaid,
}: PaymentCheckoutProps) {
    const [phase, setPhase] = useState<Phase>("form");
    const [paymentMethod, setPaymentMethod] =
        useState<OnlinePaymentMethod>("pix");
    const [card, setCard] = useState<CreditCardPaymentData>(
        EMPTY_CREDIT_CARD_PAYMENT_DATA
    );
    const [processing, setProcessing] = useState(false);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
    const [pixResult, setPixResult] =
        useState<PaymentCheckoutResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const today = useMemo(
        () =>
            new Intl.DateTimeFormat("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
            }).format(new Date()),
        []
    );

    const completePayment = useCallback(async () => {
        setAwaitingConfirmation(false);
        if (successEventName) {
            window.dispatchEvent(new Event(successEventName));
        }
        if (onPaid) {
            await onPaid();
            return;
        }
        window.location.reload();
    }, [onPaid, successEventName]);

    useEffect(() => {
        if (!loadCardPrefill) return;

        let disposed = false;

        void loadCardPrefill().then((prefill) => {
            if (disposed) return;

            setCard((current) => ({
                ...current,
                number: current.number || prefill.number || "",
                holderName: current.holderName || prefill.holderName || "",
                expiry: current.expiry || prefill.expiry || "",
                ccv: current.ccv || prefill.ccv || "",
                cpfCnpj: current.cpfCnpj || prefill.cpfCnpj || "",
                email: current.email || prefill.email || "",
                postalCode: current.postalCode || prefill.postalCode || "",
                addressNumber:
                    current.addressNumber || prefill.addressNumber || "",
                addressComplement:
                    current.addressComplement ||
                    prefill.addressComplement ||
                    "",
                mobilePhone:
                    current.mobilePhone || prefill.mobilePhone || "",
            }));
        });

        return () => {
            disposed = true;
        };
    }, [loadCardPrefill]);

    useEffect(() => {
        if (!awaitingConfirmation) return;

        let disposed = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;

        const poll = async () => {
            try {
                const result = await reconcilePayment();
                if (disposed) return;

                if (result.active) {
                    await completePayment();
                    return;
                }

                if (
                    result.paymentStatus &&
                    FAILED_PAYMENT_STATUSES.has(
                        result.paymentStatus.toUpperCase()
                    )
                ) {
                    setAwaitingConfirmation(false);
                    setPhase("form");
                    setError(
                        "O pagamento não foi aprovado. Confira os dados e tente novamente."
                    );
                    return;
                }
            } catch {
                // Keep polling while the provider finishes processing.
            }

            if (!disposed) timeout = setTimeout(poll, 3000);
        };

        timeout = setTimeout(poll, 1500);
        return () => {
            disposed = true;
            if (timeout) clearTimeout(timeout);
        };
    }, [awaitingConfirmation, completePayment, reconcilePayment]);

    const pay = async () => {
        if (paymentMethod === "credit_card") {
            const validationError = getCreditCardPaymentDataError(card);
            if (validationError) {
                setError(validationError);
                return;
            }
        }

        setProcessing(true);
        setError(null);
        setCopied(false);

        void onPaymentStarted?.(paymentMethod);

        try {
            const result = await startPayment(
                paymentMethod === "pix"
                    ? { method: "pix" }
                    : { method: "credit_card", card }
            );

            if (result.active) {
                await completePayment();
                return;
            }

            setAwaitingConfirmation(true);
            if (paymentMethod === "pix") {
                setPixResult(result);
                setPhase("pix");
            } else {
                setPhase("processing");
            }
        } catch (paymentError) {
            setError(
                paymentError instanceof Error
                    ? paymentError.message
                    : "Não foi possível processar o pagamento."
            );
        } finally {
            setProcessing(false);
        }
    };

    const copyPix = async () => {
        if (!pixResult?.qrCodeText) return;
        await navigator.clipboard.writeText(pixResult.qrCodeText);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
    };

    const pixImage = pixResult?.qrCodeBase64
        ? pixResult.qrCodeBase64.startsWith("data:")
            ? pixResult.qrCodeBase64
            : `data:image/png;base64,${pixResult.qrCodeBase64}`
        : pixResult?.qrCodeUrl || null;

    if (phase === "pix") {
        return (
            <>
                <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
                    <h2 className="text-xl font-semibold text-gray-900">
                        Pague com Pix
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {product.pixConfirmationDescription}
                    </p>
                </div>
                <div className="flex flex-1 flex-col items-center justify-center gap-5 px-6 py-7 text-center sm:px-8">
                    {pixImage && (
                        <img
                            src={pixImage}
                            alt="QR Code Pix"
                            className="h-52 w-52 rounded-xl border border-gray-200 bg-white p-2"
                        />
                    )}
                    {pixResult?.qrCodeText && (
                        <div className="w-full max-w-xl">
                            <p className="mb-2 text-sm font-medium text-gray-700">
                                Pix copia e cola
                            </p>
                            <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
                                <p className="min-w-0 flex-1 truncate text-left text-xs text-gray-600">
                                    {pixResult.qrCodeText}
                                </p>
                                <Button
                                    type="button"
                                    variant="secondary"
                                    onClick={() => void copyPix()}
                                >
                                    <FontAwesomeIcon icon={faCopy} />
                                    {copied ? "Copiado" : "Copiar"}
                                </Button>
                            </div>
                        </div>
                    )}
                    <div className="flex items-center gap-3 text-sm text-gray-500">
                        <Loader className="h-5 w-5 border-t-brand" />
                        Aguardando confirmação do pagamento...
                    </div>
                    {error && <p className="text-sm text-red-600">{error}</p>}
                </div>
                <div className="sticky bottom-0 z-20 flex justify-end border-t border-gray-100 bg-white px-6 py-4 sm:px-8">
                    <Button type="button" variant="secondary" onClick={onClose}>
                        Fechar
                    </Button>
                </div>
            </>
        );
    }

    if (phase === "processing") {
        return (
            <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 text-center">
                <Loader className="h-8 w-8 border-t-brand" />
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Confirmando pagamento
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        {product.cardConfirmationDescription}
                    </p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
                <h2 className="text-xl font-semibold text-gray-900">
                    Finalizar pedido
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Confira seu pedido e escolha a forma de pagamento.
                </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
                <div className="grid min-h-full md:grid-cols-[minmax(0,1fr)_320px]">
                    <div className="px-6 py-6 sm:px-8">
                        <h2 className="mb-4 text-md font-semibold text-gray-900 2xl:text-lg">
                            Pagamento
                        </h2>

                        <PaymentForm
                            method={paymentMethod}
                            card={card}
                            disabled={processing}
                            error={error}
                            onMethodChange={(method) => {
                                setPaymentMethod(method);
                                setError(null);
                            }}
                            onCardChange={setCard}
                            pixDescription={product.pixDescription}
                            cardDescription={product.cardDescription}
                        />

                        <p className="mt-5 text-xs leading-relaxed text-gray-500">
                            {paymentMethod === "credit_card"
                                ? product.cardNotice
                                : product.pixNotice}
                        </p>
                    </div>

                    <div className="border-t border-gray-100 bg-gray-50/60 px-6 py-6 sm:px-8 md:border-l md:border-t-0">
                        <h2 className="text-md font-semibold text-gray-900 2xl:text-lg">
                            Seu pedido
                        </h2>

                        <div className="mt-4 flex items-start gap-3 border-b border-gray-200 pb-4">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                                <FontAwesomeIcon icon={product.icon} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            {product.name}
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-500">
                                            {product.periodLabel}
                                        </p>
                                    </div>
                                    <span className="shrink-0 font-medium text-gray-900">
                                        {product.priceLabel}
                                    </span>
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    {product.detail}
                                </p>
                            </div>
                        </div>

                        <div className="flex items-start gap-3 border-b border-gray-200 py-4">
                            <FontAwesomeIcon
                                icon={faCalendarDays}
                                className="mt-0.5 text-gray-500"
                            />
                            <div>
                                <p className="text-xs text-gray-500">
                                    Data da compra
                                </p>
                                <p className="mt-0.5 text-sm font-medium capitalize text-gray-900">
                                    {today}
                                </p>
                            </div>
                        </div>

                        <div className="mt-5 rounded-xl border border-gray-200 bg-gray-50 p-4">
                            <h2 className="mb-4 font-semibold text-gray-900 2xl:text-lg">
                                Resumo de valores
                            </h2>
                            <div className="flex justify-between text-[15px] text-gray-600 2xl:text-lg">
                                <span>Subtotal</span>
                                <span>{product.priceLabel}</span>
                            </div>
                            <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-semibold text-gray-900">
                                <span>Total</span>
                                <span>{product.priceLabel}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="sticky bottom-0 z-20 flex shrink-0 flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:px-8 sm:py-5">
                <div className="hidden sm:mr-auto sm:block">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-semibold text-gray-900">
                        {product.priceLabel}
                    </p>
                </div>
                {onBack && (
                    <Button
                        type="button"
                        variant="secondary"
                        disabled={processing}
                        onClick={onBack}
                    >
                        Voltar
                    </Button>
                )}
                <Button
                    type="button"
                    variant="primary"
                    loading={processing}
                    onClick={() => void pay()}
                    className="w-full sm:w-auto sm:min-w-48"
                >
                    Pagar {product.priceLabel}
                </Button>
            </div>
        </>
    );
}
