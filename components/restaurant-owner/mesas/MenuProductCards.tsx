"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCheck,
    faLock,
    faQrcode,
    faUtensils,
} from "@fortawesome/free-solid-svg-icons";

type MenuProductCardsProps = {
    qrSelected: boolean;
    qrActive?: boolean;
    onQrToggle?: () => void;
    onLearnMore: () => void;
};

export default function MenuProductCards({
    qrSelected,
    qrActive = false,
    onQrToggle,
    onLearnMore,
}: MenuProductCardsProps) {
    return (
        <div className="grid gap-4 md:grid-cols-2">
            <div className="relative rounded-2xl border-2 border-brand bg-brand/5 p-5 shadow-sm">
                <div className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                    <FontAwesomeIcon icon={faLock} />
                    Obrigatório
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand text-white">
                    <FontAwesomeIcon icon={faUtensils} />
                </div>
                <h3 className="mt-5 text-lg font-bold text-gray-900">
                    iMenu Cardápio Digital
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    Seu cardápio delivery com produtos, pedidos e gestão pelo
                    painel.
                </p>
                <div className="mt-5 flex items-center gap-2 text-sm font-semibold text-brand">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                        <FontAwesomeIcon icon={faCheck} />
                    </span>
                    Incluído na sua conta
                </div>
            </div>

            <div
                className={`relative rounded-2xl border-2 p-5 shadow-sm transition-colors ${
                    qrSelected || qrActive
                        ? "border-brand bg-brand/5"
                        : "border-gray-200 bg-white"
                }`}
            >
                <button
                    type="button"
                    aria-pressed={qrSelected || qrActive}
                    disabled={!onQrToggle || qrActive}
                    onClick={onQrToggle}
                    className={`absolute right-4 top-4 flex h-6 w-6 items-center justify-center rounded-md border transition-colors ${
                        qrSelected || qrActive
                            ? "border-brand bg-brand text-white"
                            : "border-gray-300 bg-white text-transparent"
                    } ${onQrToggle && !qrActive ? "cursor-pointer" : "cursor-default"}`}
                    aria-label="Selecionar iMenu QR Code Mesa"
                >
                    <FontAwesomeIcon icon={faCheck} className="text-xs" />
                </button>
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 text-white">
                    <FontAwesomeIcon icon={faQrcode} />
                </div>
                <h3 className="mt-5 text-lg font-bold text-gray-900">
                    iMenu QR Code Mesa
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    Receba pedidos de várias pessoas na mesa, identificados no
                    painel e na impressão.
                </p>
                <div className="mt-4 flex items-end gap-1 text-gray-900">
                    {qrActive ? (
                        <span className="inline-flex items-center gap-2 text-sm font-semibold text-green-700">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] text-white">
                                <FontAwesomeIcon icon={faCheck} />
                            </span>
                            Ativo
                        </span>
                    ) : (
                        <>
                            <span className="text-xl font-bold">R$ 4,90</span>
                            <span className="pb-0.5 text-xs text-gray-500">
                                /mês
                            </span>
                        </>
                    )}
                </div>
                <button
                    type="button"
                    onClick={onLearnMore}
                    className="mt-4 cursor-pointer text-sm font-semibold text-brand hover:underline"
                >
                    Saiba mais
                </button>
            </div>
        </div>
    );
}
