"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faArrowRotateLeft,
    faBellConcierge,
    faCalendarDays,
    faCopy,
    faCreditCard,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { faPix, faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import Image from "next/image";
import Link from "next/link";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";
import {
    reconcileQrTableCheckout,
    startQrTableCheckout,
    type QrTableCheckoutResult,
} from "@/lib/qr-table/clientApi";
import type { QrTableSource } from "@/lib/qr-table/types";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

type QrCodeMesaSalesModalProps = {
    open: boolean;
    onClose: () => void;
    onBuy?: () => void;
    buying?: boolean;
    active?: boolean;
    restaurantId?: string;
    source?: QrTableSource;
    onPaid?: () => void | Promise<void>;
};

type Step = "info" | "checkout" | "pix" | "processing";
type PaymentMethod = "pix" | "credit_card";

const BENEFITS = [
    {
        icon: faQrcode,
        title: "Sem limites de mesas",
        description:
            "Por apenas R$ 5,00 por mês, você cria mesas ilimitadas e QR Codes ilimitados.",
    },
    {
        icon: faBellConcierge,
        title: "Painel do Garçom",
        description:
            "Acompanhe os pedidos de cada mesa e adicione novos pedidos direto pelo painel do garçom.",
    },
    {
        icon: faUsers,
        title: "A mesa acompanha o pedido",
        description:
            "O pedido vai direto para o painel e para impressão, o cliente acompanha pela página.",
    },
] as const;

const SUPPORT_URL =
    "https://wa.me/5519988760900?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20iMenu%20QR%20Code%20Mesa.";

function formatCardNumber(value: string): string {
    return value
        .replace(/\D/g, "")
        .slice(0, 19)
        .replace(/(.{4})/g, "$1 ")
        .trim();
}

function formatExpiration(value: string): string {
    const digits = value.replace(/\D/g, "").slice(0, 6);
    if (digits.length <= 2) return digits;
    return `${digits.slice(0, 2)}/${digits.slice(2)}`;
}

export default function QrCodeMesaSalesModal({
    open,
    onClose,
    buying: legacyBuying = false,
    active = false,
    restaurantId,
    source,
    onPaid,
}: QrCodeMesaSalesModalProps) {
    const storedRestaurantId = useCreationStore((state) => state.restaurantId);
    const [step, setStep] = useState<Step>("info");
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("pix");
    const [cardNumber, setCardNumber] = useState("");
    const [cardHolder, setCardHolder] = useState("");
    const [cardExpiration, setCardExpiration] = useState("");
    const [cardCvv, setCardCvv] = useState("");
    const [processing, setProcessing] = useState(false);
    const [awaitingConfirmation, setAwaitingConfirmation] = useState(false);
    const [paymentRestaurantId, setPaymentRestaurantId] = useState<string | null>(
        null
    );
    const [pixResult, setPixResult] = useState<QrTableCheckoutResult | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);

    const resolvedRestaurantId = restaurantId || storedRestaurantId || "";
    const resolvedSource = useMemo<QrTableSource>(() => {
        if (source) return source;
        if (typeof window === "undefined") return "mesas";
        if (window.location.pathname.includes("/restaurante/criar/")) {
            return "onboarding";
        }
        if (window.location.pathname.includes("/configuracoes")) {
            return "settings";
        }
        return "mesas";
    }, [source, open]);

    const today = useMemo(
        () =>
            new Intl.DateTimeFormat("pt-BR", {
                weekday: "long",
                day: "2-digit",
                month: "long",
                year: "numeric",
            }).format(new Date()),
        [open]
    );

    const reset = () => {
        setStep("info");
        setPaymentMethod("pix");
        setCardNumber("");
        setCardHolder("");
        setCardExpiration("");
        setCardCvv("");
        setProcessing(false);
        setAwaitingConfirmation(false);
        setPaymentRestaurantId(null);
        setPixResult(null);
        setError(null);
        setCopied(false);
    };

    const close = () => {
        reset();
        onClose();
    };

    const completePayment = async () => {
        setAwaitingConfirmation(false);
        if (onPaid) {
            await onPaid();
            return;
        }
        window.location.reload();
    };

    useEffect(() => {
        if (!awaitingConfirmation || !paymentRestaurantId || !open) return;

        let disposed = false;
        let timeout: ReturnType<typeof setTimeout> | null = null;

        const poll = async () => {
            try {
                const result = await reconcileQrTableCheckout(paymentRestaurantId);
                if (disposed) return;
                if (result.active) {
                    await completePayment();
                    return;
                }
            } catch {
                // Keep polling while PayZu is still confirming the payment.
            }

            if (!disposed) timeout = setTimeout(poll, 3000);
        };

        timeout = setTimeout(poll, 1500);
        return () => {
            disposed = true;
            if (timeout) clearTimeout(timeout);
        };
    }, [awaitingConfirmation, paymentRestaurantId, open]);

    const proceedToCheckout = () => {
        setError(null);
        setStep("checkout");
    };

    const pay = async () => {
        if (!resolvedRestaurantId) {
            setError("Restaurante não encontrado.");
            return;
        }

        if (paymentMethod === "credit_card") {
            const digits = cardNumber.replace(/\D/g, "");
            const cvv = cardCvv.replace(/\D/g, "");
            if (
                digits.length < 13 ||
                cardHolder.trim().length < 2 ||
                !/^\d{2}\/\d{4}$/.test(cardExpiration) ||
                cvv.length < 3
            ) {
                setError("Preencha os dados do cartão corretamente.");
                return;
            }
        }

        setProcessing(true);
        setError(null);
        setCopied(false);
        setPaymentRestaurantId(resolvedRestaurantId);
        void captureQrTableEvent("qr_code_mesa_purchase_started", {
            restaurant_id: resolvedRestaurantId,
            source: resolvedSource,
            payment_method: paymentMethod,
        });

        try {
            const result = await startQrTableCheckout(
                resolvedRestaurantId,
                resolvedSource,
                paymentMethod === "pix"
                    ? { method: "pix" }
                    : {
                          method: "credit_card",
                          card: {
                              number: cardNumber,
                              holder: cardHolder,
                              expiration: cardExpiration,
                              cvv: cardCvv,
                          },
                      }
            );

            if (result.active) {
                await completePayment();
                return;
            }

            setAwaitingConfirmation(true);
            if (paymentMethod === "pix") {
                setPixResult(result);
                setStep("pix");
            } else {
                setStep("processing");
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
        setTimeout(() => setCopied(false), 1800);
    };

    const pixImage = pixResult?.qrCodeBase64
        ? pixResult.qrCodeBase64.startsWith("data:")
            ? pixResult.qrCodeBase64
            : `data:image/png;base64,${pixResult.qrCodeBase64}`
        : pixResult?.qrCodeUrl || null;

    const busy = processing || legacyBuying;

    const checkoutContent = (
        <>
            <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
                <h2 className="text-xl font-semibold text-gray-900">
                    Finalizar pagamento
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Confira os dados e escolha como deseja pagar.
                </p>
            </div>

            <div className="space-y-5 px-6 py-5 sm:px-8">
                <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <FontAwesomeIcon icon={faCalendarDays} className="text-brand" />
                    <div>
                        <p className="text-xs text-gray-500">Data da compra</p>
                        <p className="font-medium capitalize text-gray-900">{today}</p>
                    </div>
                </div>

                <div className="rounded-xl border border-gray-200 p-4">
                    <div className="flex items-start justify-between gap-4">
                        <div>
                            <p className="font-semibold text-gray-900">
                                iMenu QR Code Mesa
                            </p>
                            <p className="mt-1 text-sm text-gray-500">
                                Mesas e QR Codes ilimitados • 1 unidade
                            </p>
                        </div>
                        <span className="font-semibold text-gray-900">R$ 5,00</span>
                    </div>
                </div>

                <div>
                    <h3 className="mb-3 font-semibold text-gray-900">
                        Forma de pagamento
                    </h3>
                    <div className="space-y-3">
                        <button
                            type="button"
                            className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors duration-200 flex items-center gap-3 ${
                                paymentMethod === "pix"
                                    ? "border-brand"
                                    : "border-gray-300"
                            }`}
                            onClick={() => {
                                setPaymentMethod("pix");
                                setError(null);
                            }}
                        >
                            <FontAwesomeIcon icon={faPix} />
                            <div>
                                <p className="font-medium text-gray-900">Pix</p>
                                <p className="text-xs text-gray-500">
                                    Pagamento único • acesso por 1 mês + 1 dia
                                </p>
                            </div>
                        </button>

                        <button
                            type="button"
                            className={`w-full cursor-pointer rounded-xl border p-3 text-left transition-colors duration-200 flex items-center gap-3 ${
                                paymentMethod === "credit_card"
                                    ? "border-brand"
                                    : "border-gray-300"
                            }`}
                            onClick={() => {
                                setPaymentMethod("credit_card");
                                setError(null);
                            }}
                        >
                            <FontAwesomeIcon icon={faCreditCard} />
                            <div>
                                <p className="font-medium text-gray-900">
                                    Cartão de crédito
                                </p>
                                <p className="text-xs text-gray-500">
                                    Cobrança recorrente mensal • cancele quando quiser
                                </p>
                            </div>
                        </button>
                    </div>
                </div>

                {paymentMethod === "credit_card" && (
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="sm:col-span-2">
                            <Input
                                label="Número do cartão"
                                value={cardNumber}
                                inputMode="numeric"
                                autoComplete="cc-number"
                                onChange={(event) =>
                                    setCardNumber(formatCardNumber(event.target.value))
                                }
                            />
                        </div>
                        <div className="sm:col-span-2">
                            <Input
                                label="Nome no cartão"
                                value={cardHolder}
                                autoComplete="cc-name"
                                onChange={(event) =>
                                    setCardHolder(event.target.value.toUpperCase())
                                }
                            />
                        </div>
                        <Input
                            label="Validade"
                            placeholder="MM/AAAA"
                            value={cardExpiration}
                            inputMode="numeric"
                            autoComplete="cc-exp"
                            onChange={(event) =>
                                setCardExpiration(formatExpiration(event.target.value))
                            }
                        />
                        <Input
                            label="CVV"
                            value={cardCvv}
                            inputMode="numeric"
                            autoComplete="cc-csc"
                            maxLength={4}
                            onChange={(event) =>
                                setCardCvv(event.target.value.replace(/\D/g, ""))
                            }
                        />
                    </div>
                )}

                <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <h3 className="mb-4 font-semibold text-gray-900">
                        Resumo de valores
                    </h3>
                    <div className="flex justify-between text-[15px] text-gray-600">
                        <span>Subtotal</span>
                        <span>R$ 5,00</span>
                    </div>
                    <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 font-semibold text-gray-900">
                        <span>Total</span>
                        <span>R$ 5,00</span>
                    </div>
                </div>

                {error && (
                    <p className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </p>
                )}

                <p className="text-center text-xs leading-relaxed text-gray-500">
                    {paymentMethod === "credit_card"
                        ? "Ao pagar, você autoriza a cobrança recorrente mensal de R$ 5,00 até o cancelamento."
                        : "O Pix libera o acesso por 1 mês + 1 dia. Depois desse período, basta renovar pelo mesmo fluxo."}
                </p>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:justify-end sm:px-8 sm:py-5">
                <Button
                    type="button"
                    variant="secondary"
                    disabled={busy}
                    onClick={() => {
                        setError(null);
                        setStep("info");
                    }}
                >
                    Voltar
                </Button>
                <Button
                    type="button"
                    variant="primary"
                    loading={busy}
                    onClick={() => void pay()}
                    className="w-full sm:w-auto sm:min-w-48"
                >
                    Pagar R$ 5,00
                </Button>
            </div>
        </>
    );

    const pixContent = (
        <>
            <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
                <h2 className="text-xl font-semibold text-gray-900">Pague com Pix</h2>
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
                            <Button type="button" variant="secondary" onClick={() => void copyPix()}>
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
                <Button type="button" variant="secondary" onClick={close}>
                    Fechar
                </Button>
            </div>
        </>
    );

    const processingContent = (
        <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 px-6 text-center">
            <Loader className="h-8 w-8 border-t-brand" />
            <div>
                <h2 className="text-lg font-semibold text-gray-900">
                    Confirmando pagamento
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Estamos aguardando a confirmação do PayZu. Não feche esta janela.
                </p>
            </div>
        </div>
    );

    return (
        <Modal
            height={step === "info" ? 700 : 720}
            open={open}
            onClose={close}
            className="max-w-4xl"
            showCloseButton
        >
            {step === "checkout" && checkoutContent}
            {step === "pix" && pixContent}
            {step === "processing" && processingContent}
            {step === "info" && (
                <>
                    <div className="grid shrink-0 overflow-hidden md:grid-cols-[minmax(0,1fr)_300px]">
                        <div className="px-6 pb-1 pt-5 sm:px-8 sm:py-8">
                            <div className="relative h-12 w-56 max-w-full">
                                <Image
                                    src="/logos/QRCODECombinationMarkLogo_Brand.png"
                                    alt="iMenu QR Code Mesa"
                                    fill
                                    sizes="224px"
                                    className="object-contain object-left"
                                />
                            </div>

                            <p className="mt-7 text-xs font-bold uppercase tracking-[0.16em] text-brand">
                                Pedidos direto pela mesa
                            </p>
                            <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">
                                O cliente abre o cardápio, escolhe os produtos e envia o pedido já identificado com a mesa — direto para o seu painel e para a impressão.
                            </p>

                            <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-2 rounded-xl border border-brand/20 bg-brand/5 px-4 py-4">
                                <span className="text-3xl font-bold text-gray-900">R$ 5,00</span>
                                <span className="pb-1 text-sm text-gray-600">/mês</span>
                                <div className="ml-auto flex flex-col items-end gap-1 pb-1">
                                    <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
                                        <FontAwesomeIcon icon={faCreditCard} />
                                        Cartão recorrente ou Pix
                                    </span>
                                    <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500">
                                        <FontAwesomeIcon icon={faArrowRotateLeft} />
                                        cartão: cancele quando quiser
                                    </span>
                                </div>
                            </div>

                            <div className="mt-3 flex justify-center md:hidden">
                                <div className="relative aspect-[2/3] w-full max-w-[280px]">
                                    <Image
                                        src="/images/QRCodeMesa.png"
                                        alt="Demonstração do iMenu QR Code Mesa"
                                        fill
                                        sizes="280px"
                                        className="object-contain object-center"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="relative hidden min-h-0 md:block">
                            <div className="absolute -bottom-4 -left-8 right-10 top-16">
                                <Image
                                    src="/images/QRCodeMesa.png"
                                    alt="Demonstração do iMenu QR Code Mesa"
                                    fill
                                    sizes="300px"
                                    className="object-contain object-center"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="shrink-0 space-y-6 px-6 pb-5 pt-3 sm:px-8 sm:pt-1">
                        <div>
                            <h3 className="text-lg font-bold text-gray-900">
                                Tudo pronto para atender pelas mesas
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Use o QR Code nas mesas e facilite sua operação.
                            </p>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                            {BENEFITS.map((benefit) => (
                                <div
                                    key={benefit.title}
                                    className="rounded-xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/70 p-4"
                                >
                                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                                        <FontAwesomeIcon icon={benefit.icon} />
                                    </span>
                                    <p className="mt-3 font-semibold text-gray-900">
                                        {benefit.title}
                                    </p>
                                    <p className="mt-1 text-sm leading-relaxed text-gray-500">
                                        {benefit.description}
                                    </p>
                                </div>
                            ))}
                        </div>

                        {!active && (
                            <p className="text-center text-xs leading-relaxed text-gray-500">
                                Ao continuar, você concorda com os{" "}
                                <Link
                                    href="/restaurante/dados/termos/qr-code-mesa"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="underline underline-offset-2"
                                >
                                    Termos do iMenu QR Code Mesa
                                </Link>
                                . A cobrança recorrente só é ativada se você escolher cartão.
                            </p>
                        )}
                    </div>

                    <div className="sticky bottom-0 z-20 flex shrink-0 flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:static sm:flex-row sm:items-center sm:px-8 sm:py-5">
                        <a
                            href={SUPPORT_URL}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700 sm:mr-auto"
                        >
                            <FontAwesomeIcon
                                icon={faWhatsapp}
                                className="text-lg text-green-600"
                            />
                            <span>Está em dúvida? Fale conosco</span>
                        </a>
                        <Button type="button" variant="secondary" onClick={close}>
                            Agora não
                        </Button>
                        {!active && (
                            <Button
                                type="button"
                                variant="primary"
                                onClick={proceedToCheckout}
                                className="w-full sm:w-auto sm:min-w-64"
                            >
                                Continuar
                            </Button>
                        )}
                    </div>
                </>
            )}
        </Modal>
    );
}
