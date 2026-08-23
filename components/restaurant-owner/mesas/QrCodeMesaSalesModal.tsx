"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChair,
    faCreditCard,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { icons } from "@/lib/utils/fontawesome";

type QrCodeMesaSalesModalProps = {
    open: boolean;
    onClose: () => void;
    onBuy: () => void;
    buying?: boolean;
    active?: boolean;
};

const BENEFITS = [
    {
        icon: faQrcode,
        title: "QR Code por mesa e universal",
    },
    {
        icon: faUsers,
        title: "Todos podem pedir ao mesmo tempo",
    },
    {
        icon: faChair,
        title: "Pedidos identificados por mesa",
    },
] as const;

const SUPPORT_URL =
    "https://wa.me/5519988760900?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20iMenu%20QR%20Code%20Mesa.";

export default function QrCodeMesaSalesModal({
    open,
    onClose,
    onBuy,
    buying = false,
    active = false,
}: QrCodeMesaSalesModalProps) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            className="max-w-4xl"
            showCloseButton
        >
            <div className="grid shrink-0 overflow-hidden border-b border-gray-100 md:grid-cols-[minmax(0,1fr)_230px]">
                <div className="px-6 py-6 sm:px-8 sm:py-8">
                    <div className="relative h-12 w-56 max-w-full">
                        <Image
                            src="/logos/QRCODECombinationMarkLogo_Brand.png"
                            alt="iMenu QR Code Mesa"
                            fill
                            sizes="224px"
                            className="object-contain object-left"
                        />
                    </div>

                    <h2 className="mt-7 text-2xl font-bold text-gray-900 sm:text-3xl">
                        Pedidos direto da mesa
                    </h2>
                    <p className="mt-3 max-w-xl text-sm leading-relaxed text-gray-600 sm:text-base">
                        Receba pedidos identificados pela mesa no painel e na
                        impressão.
                    </p>

                    <div className="mt-6 rounded-xl border border-brand/20 bg-brand/5 px-4 py-3 sm:flex sm:items-center">
                        <div className="flex items-baseline gap-2">
                            <span className="text-3xl font-bold text-gray-900">
                                R$ 4,90
                            </span>
                            <span className="text-sm text-gray-600">/mês</span>
                        </div>
                        <span className="mt-1 inline-flex items-center gap-2 text-xs font-medium text-gray-600 sm:ml-auto sm:mt-0">
                            <FontAwesomeIcon icon={faCreditCard} />
                            Cartão de crédito
                        </span>
                    </div>

                    <div className="mt-5 flex justify-center md:hidden">
                        <div className="relative aspect-[2/3] w-full max-w-[230px]">
                            <Image
                                src="/images/QRCodeMesa.png"
                                alt="Demonstração do iMenu QR Code Mesa"
                                fill
                                sizes="230px"
                                className="object-contain object-center"
                            />
                        </div>
                    </div>
                </div>

                <div className="hidden items-center justify-center p-5 md:flex">
                    <div className="relative aspect-[2/3] w-full max-w-[200px]">
                        <Image
                            src="/images/QRCodeMesa.png"
                            alt="Demonstração do iMenu QR Code Mesa"
                            fill
                            sizes="230px"
                            className="object-contain object-center"
                        />
                    </div>
                </div>
            </div>

            <div className="shrink-0 px-6 py-5 sm:px-8">
                <div className="grid gap-3 md:grid-cols-3">
                    {BENEFITS.map((benefit) => (
                        <div
                            key={benefit.title}
                            className="flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/40 p-3"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                                <FontAwesomeIcon icon={benefit.icon} />
                            </span>
                            <p className="text-sm font-semibold text-gray-900">
                                {benefit.title}
                            </p>
                        </div>
                    ))}
                </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 border-t border-gray-100 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
                <Button
                    type="button"
                    variant="secondary"
                    onClick={() =>
                        window.open(SUPPORT_URL, "_blank", "noopener,noreferrer")
                    }
                >
                    <FontAwesomeIcon icon={icons.faWhatsapp} className="mr-2" />
                    Está em dúvida? Fale conosco
                </Button>
                <Button
                    type="button"
                    variant={active ? "secondary" : "primary"}
                    loading={buying}
                    disabled={active}
                    onClick={onBuy}
                    className="sm:min-w-64"
                >
                    {active
                        ? "Sistema ativo"
                        : "Quero ativar pedidos por mesa"}
                </Button>
            </div>
        </Modal>
    );
}
