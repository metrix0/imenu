"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faArrowRotateLeft,
    faBellConcierge,
    faCreditCard,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import Image from "next/image";
import Link from "next/link";

import PaymentCheckout from "@/components/payments/PaymentCheckout";
import { supabase } from "@/lib/database/supabaseClient";
import type { OnlinePaymentMethod } from "@/lib/payments/types";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";
import {
    reconcileQrTableCheckout,
    startQrTableCheckout,
} from "@/lib/qr-table/clientApi";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import type { QrTableSource } from "@/lib/qr-table/types";

type QrCodeMesaSalesModalProps = {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    source: QrTableSource;
    active?: boolean;
    onPaid?: () => void | Promise<void>;
};

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

export default function QrCodeMesaSalesModal({
    open,
    onClose,
    restaurantId,
    source,
    active = false,
    onPaid,
}: QrCodeMesaSalesModalProps) {
    const [checkoutOpen, setCheckoutOpen] = useState(false);
    const [switching, setSwitching] = useState(false);
    const transitionTimerRef = useRef<number | null>(null);

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
            startQrTableCheckout(restaurantId, source, payment),
        [restaurantId, source]
    );

    const reconcilePayment = useCallback(
        () => reconcileQrTableCheckout(restaurantId),
        [restaurantId]
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

    useEffect(() => {
        if (!open || active) {
            if (transitionTimerRef.current !== null) {
                window.clearTimeout(transitionTimerRef.current);
                transitionTimerRef.current = null;
            }
            setCheckoutOpen(false);
            setSwitching(false);
        }

        return () => {
            if (transitionTimerRef.current !== null) {
                window.clearTimeout(transitionTimerRef.current);
                transitionTimerRef.current = null;
            }
        };
    }, [open, active]);

    const transitionTo = (checkout: boolean) => {
        if (transitionTimerRef.current !== null) {
            window.clearTimeout(transitionTimerRef.current);
        }

        setSwitching(true);
        transitionTimerRef.current = window.setTimeout(() => {
            setCheckoutOpen(checkout);
            transitionTimerRef.current = null;
            window.requestAnimationFrame(() => setSwitching(false));
        }, 140);
    };

    const close = () => {
        if (transitionTimerRef.current !== null) {
            window.clearTimeout(transitionTimerRef.current);
            transitionTimerRef.current = null;
        }
        setSwitching(false);
        setCheckoutOpen(false);
        onClose();
    };

    if (checkoutOpen) {
        return (
            <Modal
                height={760}
                open={open}
                onClose={close}
                className="max-w-4xl"
                showCloseButton
            >
                <div
                    className={`flex min-h-0 flex-1 flex-col transition-[opacity,transform] duration-150 ease-out ${
                        switching
                            ? "translate-y-1 opacity-0"
                            : "translate-y-0 opacity-100"
                    }`}
                >
                    <PaymentCheckout
                        product={QR_TABLE_PAYMENT_PRODUCT}
                        onBack={() => transitionTo(false)}
                        onClose={close}
                        startPayment={startPayment}
                        reconcilePayment={reconcilePayment}
                        loadCardPrefill={loadCardPrefill}
                        onPaymentStarted={trackPaymentStarted}
                        successEventName="imenu:qr-table-activated"
                        onPaid={onPaid}
                    />
                </div>
            </Modal>
        );
    }

    return (
        <Modal
            height={700}
            open={open}
            onClose={close}
            className="max-w-4xl"
            showCloseButton
        >
            <div
                className={`transition-[opacity,transform] duration-150 ease-out ${
                    switching
                        ? "translate-y-1 opacity-0"
                        : "translate-y-0 opacity-100"
                }`}
            >
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
                        O cliente abre o cardápio, escolhe os produtos e envia o
                        pedido já identificado com a mesa — direto para o seu
                        painel e para a impressão.
                    </p>

                    <div className="mt-6 flex flex-wrap items-end gap-x-3 gap-y-2 rounded-xl border border-brand/20 bg-brand/5 px-4 py-4">
                        <span className="text-3xl font-bold text-gray-900">
                            R$ 5,00
                        </span>
                        <span className="pb-1 text-sm text-gray-600">/mês</span>
                        <div className="ml-auto flex flex-col items-end gap-1 pb-1">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
                                <FontAwesomeIcon icon={faCreditCard} />
                                Cartão ou Pix
                            </span>
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500">
                                <FontAwesomeIcon icon={faArrowRotateLeft} />
                                cancele quando quiser
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
                        </Link>{" "}
                        e a cobrança recorrente só é ativada se você escolher
                        cartão.
                    </p>
                )}
            </div>

            <div className="sticky bottom-0 z-20 flex shrink-0 flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:px-8 sm:py-5">
                <a
                    href={SUPPORT_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="hidden items-center justify-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700 sm:mr-auto sm:inline-flex"
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
                        onClick={() => transitionTo(true)}
                        className="w-full sm:w-auto sm:min-w-64"
                    >
                        Continuar
                    </Button>
                )}
            </div>
            </div>
        </Modal>
    );
}
