"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowRight,
    faCheck,
    faCircleInfo,
    faLock,
} from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";

import Tooltip from "@/components/ui/Tooltip";

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
    const selected = qrSelected || qrActive;

    const handleQrAction = () => {
        if (qrActive) return;
        if (onQrToggle) {
            onQrToggle();
            return;
        }
        onLearnMore();
    };

    const stopAndLearnMore = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        onLearnMore();
    };

    const stopAndHandleQrAction = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        handleQrAction();
    };

    return (
        <div className="grid gap-5 md:grid-cols-2">
            <div className="relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-brand bg-gradient-to-br from-white via-white to-brand/[0.08] p-6 shadow-sm ring-2 ring-brand/10">
                <div className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-brand px-2.5 py-1 text-xs font-semibold text-white">
                    <FontAwesomeIcon icon={faLock} />
                    Obrigatório Grátis
                </div>

                <div className="relative h-12 w-40">
                    <Image
                        src="/logos/CombinationMarkLogo_Brand.png"
                        alt="iMenu Cardápio Digital"
                        fill
                        sizes="160px"
                        className="object-contain object-left"
                    />
                </div>

                <h3 className="mt-6 text-xl font-bold text-gray-900">
                    iMenu Cardápio Digital
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-600">
                    Seu cardápio delivery com produtos, pedidos e gestão pelo
                    painel.
                </p>

                <p className="mt-5 text-sm font-bold text-brand">
                    Grátis para sempre, sem limites
                </p>
                <ul className="mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700">
                    {["Robô WhatsApp", "Pedidos delivery", "Gestão de pedidos"].map(
                        (feature) => (
                            <li key={feature} className="flex items-center gap-2">
                                <FontAwesomeIcon
                                    icon={faCheck}
                                    className="text-xs text-brand"
                                />
                                {feature}
                            </li>
                        ),
                    )}
                </ul>

                <div className="mt-auto flex flex-col gap-4 pt-7">
                    <div className="flex items-center gap-2 text-sm font-semibold text-brand">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] text-white">
                            <FontAwesomeIcon icon={faCheck} />
                        </span>
                        Incluído na sua conta
                    </div>

                    <Link
                        href="/#recursos"
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-gray-700 transition-colors hover:text-brand"
                    >
                        Conhecer o Cardápio Digital
                        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                    </Link>
                </div>
            </div>

            <div
                onClick={handleQrAction}
                className={`relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-200 ${
                    selected
                        ? "border-brand bg-gradient-to-br from-brand/[0.09] via-white to-orange-50 ring-2 ring-brand/10"
                        : "cursor-pointer border-orange-200 bg-gradient-to-br from-white via-orange-50/30 to-amber-50/70 hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
                } ${!qrActive && selected ? "cursor-pointer" : ""}`}
            >
                <button
                    type="button"
                    aria-label={
                        qrActive
                            ? "iMenu QR Code Mesa ativo"
                            : !onQrToggle
                              ? "Conhecer iMenu QR Code Mesa"
                            : selected
                              ? "Remover iMenu QR Code Mesa"
                              : "Selecionar iMenu QR Code Mesa"
                    }
                    aria-pressed={onQrToggle ? selected : undefined}
                    disabled={qrActive}
                    onClick={stopAndHandleQrAction}
                    className={`absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                        selected
                            ? "border-brand bg-brand text-white shadow-sm"
                            : "cursor-pointer border-brand/30 bg-white text-transparent hover:border-brand"
                    } ${qrActive ? "cursor-default" : "cursor-pointer"}`}
                >
                    <FontAwesomeIcon icon={faCheck} className="text-xs" />
                </button>

                <div className="relative h-12 w-40 max-w-[75%]">
                    <Image
                        src="/logos/QRCODECombinationMarkLogo_Brand.png"
                        alt="iMenu QR Code Mesa"
                        fill
                        sizes="160px"
                        className="object-contain object-left"
                    />
                </div>

                <h3 className="mt-6 text-xl font-bold text-gray-900">
                    iMenu QR Code Mesa
                </h3>
                <div className="mt-2 text-sm leading-relaxed text-gray-600">
                    <span>
                        Cardápio digital na mesa através de QR Code e link para seus
                        clientes, receba pedidos e imprima automaticamente.
                    </span>
                    <div
                        className="ml-2 inline-block align-middle"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <Tooltip
                            text="Durante sua assinatura, funcionalidades e melhorias que você pedir e que fizerem sentido serão implementadas em 1 semana."
                            size="medium"
                            showOnClick
                        >
                            <span className="inline-flex cursor-help items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold leading-none text-brand">
                                BÔNUS: Atendimento Exclusivo
                                <FontAwesomeIcon
                                    icon={faCircleInfo}
                                    className="text-[10px]"
                                />
                            </span>
                        </Tooltip>
                    </div>
                </div>

                <div className="mt-5 flex items-end gap-1 text-gray-900">
                    <span className="text-2xl font-bold">R$ 5,00</span>
                    <span className="pb-0.5 text-xs text-gray-500">
                        /mês
                    </span>
                </div>

                <div className="mt-auto flex flex-col gap-4 pt-7">
                    {qrActive && (
                        <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] text-white">
                                <FontAwesomeIcon icon={faCheck} />
                            </span>
                            Sistema ativo
                        </div>
                    )}

                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button
                            type="button"
                            onClick={stopAndLearnMore}
                            className="w-fit cursor-pointer text-left text-sm font-semibold text-gray-700 transition-colors hover:text-brand xl:whitespace-nowrap"
                        >
                            Ver tudo que o sistema faz
                        </button>

                        {!qrActive && (
                            <button
                                type="button"
                                onClick={stopAndHandleQrAction}
                                className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dark-brand xl:whitespace-nowrap"
                            >
                                {selected
                                    ? "Selecionado"
                                    : onQrToggle
                                      ? "Adicionar ao meu iMenu"
                                      : "Saiba mais"}
                                <FontAwesomeIcon
                                    icon={selected ? faCheck : faArrowRight}
                                    className="text-xs"
                                />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
