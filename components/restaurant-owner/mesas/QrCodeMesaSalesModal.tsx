"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChair,
    faCheck,
    faCreditCard,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import Image from "next/image";

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
                        <span className="ml-auto inline-flex items-center gap-2 pb-1 text-xs font-medium text-gray-600">
                            <FontAwesomeIcon icon={faCreditCard} />
                            Cobrança mensal no cartão
                        </span>
                    </div>

                    <div className="mt-5 flex justify-center md:hidden">
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

                <div className="hidden items-center justify-center p-5 md:flex">
                    <div className="relative aspect-[2/3] w-full max-w-[260px]">
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

            <div className="shrink-0 space-y-6 px-6 py-6 sm:px-8">
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

                <div className="rounded-xl bg-green-50 px-4 py-3 text-sm text-green-800">
                    <FontAwesomeIcon icon={faCheck} className="mr-2" />
                    Ativação simples e cancelamento disponível nas
                    Configurações.
                </div>

                <div className="flex justify-center">
                    <a
                        href={SUPPORT_URL}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700"
                    >
                        <FontAwesomeIcon
                            icon={faWhatsapp}
                            className="text-lg text-green-600"
                        />
                        <span>Está em dúvida? Fale conosco</span>
                    </a>
                </div>
            </div>

            <div className="flex shrink-0 flex-col-reverse gap-3 border-t border-gray-100 px-6 py-5 sm:flex-row sm:items-center sm:justify-end sm:px-8">
                <Button type="button" variant="secondary" onClick={onClose}>
                    Agora não
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
