"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faCalendarDays,
    faCopy,
    faQrcode,
} from "@fortawesome/free-solid-svg-icons";

import PaymentForm from "@/components/payments/PaymentForm";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import {
    EMPTY_CREDIT_CARD_PAYMENT_DATA,
    isCreditCardPaymentDataComplete,
    type CreditCardPaymentData,
    type OnlinePaymentMethod,
} from "@/lib/payments/types";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";
import {
    reconcileQrTableCheckout,
    startQrTableCheckout,
    type QrTableCheckoutResult,
} from "@/lib/qr-table/clientApi";
import type { QrTableSource } from "@/lib/qr-table/types";

type QrTablePaymentCheckoutProps = {
    restaurantId: string;
    source: QrTableSource;
    onBack: () => void;
    onClose: () => void;
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

export default function QrTablePaymentCheckout({
    restaurantId,
    source,
    onBack,
    onClose,
    onPaid,
}: QrTablePaymentCheckoutProps) {
    const [phase, setPhase] = useState<Phase>("form");
    const [paymentMethod, setPaymentMethod] =
        useState<OnlinePaymentMethod>("pix");
    const [card, setCard] = useState<CreditCardPaymentData>(
        EMPTY_CREDIT_CARD_PAYMENT_DATA
    );
    const [processing, setProcessing] = useState(false);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
    const [pixResult, setPixResult] =
        useState<QrTableCheckoutResult | null>(null);
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
        if (onPaid) {
            await onPaid();
            return;
        }
        window.location.reload();
    }, [onPaid]);

    useEffect(() => {
        if (!awaitingConfirmation || !restaurantId) return;

        let disposed = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;

        const poll = async () => {
            try {
                const result = await reconcileQrTableCheckout(restaurantId);
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
    }, [awaitingConfirmation, completePayment, restaurantId]);

    const pay = async () => {
        if (!restaurantId) {
            setError("Restaurante não encontrado.");
            return;
        }

        if (
            paymentMethod === "credit_card" &&
            !isCreditCardPaymentDataComplete(card)
        ) {
            setError("Preencha os dados do cartão e do titular corretamente.");
            return;
        }

        setProcessing(true);
        setError(null);
        setCopied(false);

        void captureQrTableEvent("qr_code_mesa_purchase_started", {
            restaurant_id: restaurantId,
            source,
            payment_method: paymentMethod,
        });

        try {
            const result = await startQrTableCheckout(
                restaurantId,
                source,
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
                        Assim que o PayZu confirmar o pagamento, o QR Code Mesa será liberado automaticamente.
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
                <div className="flex justify-end border-t border-gray-100 px-6 py-4 sm:px-8">
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
                        Estamos aguardando a confirmação do Asaas. Não feche esta janela.
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
                            pixDescription="Pagamento único • acesso por 1 mês + 1 dia"
                            cardDescription="Cobrança recorrente mensal • cancele quando quiser"
                        />

                        <p className="mt-5 text-xs leading-relaxed text-gray-500">
                            {paymentMethod === "credit_card"
                                ? "Ao pagar, você autoriza a cobrança recorrente mensal de R$ 5,00 até o cancelamento."
                                : "O Pix libera o acesso por 1 mês + 1 dia. Depois desse período, basta renovar pelo mesmo fluxo."}
                        </p>
                    </div>

                    <div className="border-t border-gray-100 bg-gray-50/60 px-6 py-6 sm:px-8 md:border-l md:border-t-0">
                        <h2 className="text-md font-semibold text-gray-900 2xl:text-lg">
                            Seu pedido
                        </h2>

                        <div className="mt-4 flex items-start gap-3 border-b border-gray-200 pb-4">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                                <FontAwesomeIcon icon={faQrcode} />
                            </span>
                            <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-3">
                                    <div>
                                        <p className="font-medium text-gray-900">
                                            iMenu QR Code Mesa
                                        </p>
                                        <p className="mt-0.5 text-xs text-gray-500">
                                            1 unidade
                                        </p>
                                    </div>
                                    <span className="shrink-0 font-medium text-gray-900">
                                        R$ 5,00
                                    </span>
                                </div>
                                <p className="mt-2 text-xs text-gray-500">
                                    Mesas e QR Codes ilimitados
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
                                <span>R$ 5,00</span>
                            </div>
                            <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-semibold text-gray-900">
                                <span>Total</span>
                                <span>R$ 5,00</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:px-8 sm:py-5">
                <div className="hidden sm:mr-auto sm:block">
                    <p className="text-xs text-gray-500">Total</p>
                    <p className="text-lg font-semibold text-gray-900">
                        R$ 5,00
                    </p>
                </div>
                <Button
                    type="button"
                    variant="secondary"
                    disabled={processing}
                    onClick={onBack}
                >
                    Voltar
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    loading={processing}
                    onClick={() => void pay()}
                    className="w-full sm:w-auto sm:min-w-48"
                >
                    Pagar R$ 5,00
                </Button>
            </div>
        </>
    );
}
