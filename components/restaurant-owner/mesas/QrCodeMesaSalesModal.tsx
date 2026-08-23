"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faChair,
    faCheck,
    faCreditCard,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";
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
        title: "Sem limitar pessoas por mesa",
        description:
            "Vários clientes podem usar o mesmo QR Code e fazer pedidos ao mesmo tempo.",
    },
    {
        icon: faChair,
        title: "Pedido identificado no painel",
        description:
            "A mesa aparece no pedido e também na impressão, sem endereço ou pedido mínimo.",
    },
] as const;

export default function QrCodeMesaSalesModal({
    open,
    onClose,
    onBuy,
    buying = false,
    active = false,
}: QrCodeMesaSalesModalProps) {
    return (
        <Modal open={open} onClose={onClose} className="max-w-xl">
            <div className="border-b border-gray-100 px-6 py-5 sm:px-8">
                <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-brand/10 text-brand">
                    <FontAwesomeIcon icon={faQrcode} className="text-xl" />
                </div>
                <h2 className="text-2xl font-bold text-gray-900">
                    iMenu QR Code Mesa
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    Transforme cada mesa em um ponto de pedido direto para o
                    seu cardápio digital.
                </p>
            </div>

            <div className="space-y-5 px-6 py-6 sm:px-8">
                <div className="flex items-end gap-2 rounded-xl border border-brand/20 bg-brand/5 p-4">
                    <span className="text-3xl font-bold text-gray-900">
                        R$ 4,90
                    </span>
                    <span className="pb-1 text-sm text-gray-600">/mês</span>
                    <span className="ml-auto inline-flex items-center gap-2 pb-1 text-xs font-medium text-gray-600">
                        <FontAwesomeIcon icon={faCreditCard} />
                        Cartão de crédito
                    </span>
                </div>

                <div className="space-y-4">
                    {BENEFITS.map((benefit) => (
                        <div key={benefit.title} className="flex gap-3">
                            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-brand">
                                <FontAwesomeIcon icon={benefit.icon} />
                            </span>
                            <div>
                                <p className="font-semibold text-gray-900">
                                    {benefit.title}
                                </p>
                                <p className="mt-0.5 text-sm leading-relaxed text-gray-500">
                                    {benefit.description}
                                </p>
                            </div>
                        </div>
                    ))}
                </div>

                <div className="rounded-lg bg-green-50 px-4 py-3 text-sm text-green-800">
                    <FontAwesomeIcon icon={faCheck} className="mr-2" />
                    Cancele quando quiser nas Configurações.
                </div>
            </div>

            <div className="flex flex-col-reverse gap-3 border-t border-gray-100 px-6 py-5 sm:flex-row sm:justify-end sm:px-8">
                <Button type="button" variant="secondary" onClick={onClose}>
                    Agora não
                </Button>
                <Button
                    type="button"
                    variant={active ? "secondary" : "primary"}
                    loading={buying}
                    disabled={active}
                    onClick={onBuy}
                >
                    {active ? "Plano ativo" : "Ativar por R$ 4,90/mês"}
                </Button>
            </div>
        </Modal>
    );
}
