"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRotateLeft,
    faChair,
    faCreditCard,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import Image from "next/image";
import Link from "next/link";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";

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
        description:
            "Crie um QR para cada mesa e outro para o cliente escolher a mesa ao abrir.",
    },
    {
        icon: faUsers,
        title: "Todos podem pedir ao mesmo tempo",
        description:
            "Vários clientes usam o mesmo QR Code sem limitar uma pessoa por mesa.",
    },
    {
        icon: faChair,
        title: "A mesa acompanha o pedido",
        description:
            "A identificação aparece no painel e na impressão, sem endereço ou pedido mínimo.",
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
            <div className="grid shrink-0 overflow-hidden border-b border-gray-100 md:grid-cols-[minmax(0,1fr)_300px]">
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
                            R$ 4,90
                        </span>
                        <span className="pb-1 text-sm text-gray-600">/mês</span>
                        <div className="ml-auto flex flex-col items-end gap-1 pb-1">
                            <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
                                <FontAwesomeIcon icon={faCreditCard} />
                                Cobrança mensal no cartão
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
                        Use QR Codes individuais ou comece com um único QR Code
                        universal.
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
                            className="font-semibold text-brand underline underline-offset-2 hover:text-dark-brand"
                        >
                            Termos do iMenu QR Code Mesa
                        </Link>{" "}
                        e autoriza a cobrança recorrente de R$ 4,90/mês até o
                        cancelamento.
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
                <Button type="button" variant="secondary" onClick={onClose}>
                    Agora não
                </Button>
                {!active && (
                    <Button
                        type="button"
                        variant="primary"
                        loading={buying}
                        onClick={onBuy}
                        className="w-full sm:w-auto sm:min-w-64"
                    >
                        Continuar
                    </Button>
                )}
            </div>
        </Modal>
    );
}
