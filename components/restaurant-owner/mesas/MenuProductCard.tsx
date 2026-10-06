"use client";

import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faArrowRight, faCheck, faCircleInfo, faLock } from "@fortawesome/free-solid-svg-icons";
import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";
import Tooltip from "@/components/ui/Tooltip";

type ProductCardContent = {
    name: string;
    logo: string;
    description: string;
    priceLabel: string;
    features: readonly string[];
};
type MenuProductCardProps = ProductCardContent & (
    | { variant: "included"; learnMoreLink: { href: string; label: string } }
    | { variant: "addon"; selected?: boolean; active?: boolean; onToggle?: () => void; onLearnMore: () => void; exclusiveSupport?: boolean; cardClickable?: boolean }
);

export default function MenuProductCard(props: MenuProductCardProps) {
    const included = props.variant === "included";
    const active = props.variant === "addon" && props.active === true;
    const selected = props.variant === "addon" && (props.selected === true || active);
    const cardClickable = props.variant === "addon" && props.cardClickable !== false;
    const handleAction = () => {
        if (props.variant !== "addon" || active) return;
        if (props.onToggle) props.onToggle();
        else props.onLearnMore();
    };
    const stopAndHandleAction = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        handleAction();
    };
    const stopAndLearnMore = (event: MouseEvent<HTMLButtonElement>) => {
        event.stopPropagation();
        if (props.variant === "addon") props.onLearnMore();
    };

    return (
        <div
            onClick={cardClickable ? handleAction : undefined}
            data-selected={included ? undefined : selected}
            className={included
                ? "relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border border-brand bg-white p-6 shadow-sm ring-2 ring-brand/10"
                : `relative flex min-h-[320px] flex-col overflow-hidden rounded-2xl border p-6 shadow-sm transition-all duration-200 ${
                    selected
                        ? "border-brand bg-[#fff1ea] ring-2 ring-brand/10"
                        : cardClickable
                            ? "cursor-pointer border-orange-200 bg-white hover:-translate-y-0.5 hover:border-brand/50 hover:shadow-md"
                            : "border-orange-200 bg-white"
                } ${cardClickable && !active && selected ? "cursor-pointer" : ""}`}
        >
            {props.variant === "included" ? (
                <span className="absolute right-4 top-4 inline-flex items-center gap-1.5 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                    <FontAwesomeIcon icon={faLock} />
                    <span className="sm:hidden">Grátis</span>
                    <span className="hidden sm:inline">Obrigatório Grátis</span>
                </span>
            ) : (
                <button
                    type="button"
                    aria-label={active ? `${props.name} ativo` : !props.onToggle ? `Conhecer ${props.name}` : selected ? `Remover ${props.name}` : `Selecionar ${props.name}`}
                    aria-pressed={props.onToggle ? selected : undefined}
                    disabled={active}
                    onClick={stopAndHandleAction}
                    className={`absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-lg border transition-all ${
                        selected ? "border-brand bg-brand text-white shadow-sm" : "cursor-pointer border-brand/30 bg-white text-transparent hover:border-brand"
                    } ${active ? "cursor-default" : "cursor-pointer"}`}
                >
                    <FontAwesomeIcon icon={faCheck} className="text-xs" />
                </button>
            )}

            <div className={included ? "relative h-12 w-40" : "relative h-12 w-40 max-w-[75%]"}>
                <Image src={props.logo} alt={props.name} fill sizes="160px" className="object-contain object-left" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-gray-900">{props.name}</h3>
            {included ? (
                <p className="mt-2 text-sm leading-relaxed text-gray-600">{props.description}</p>
            ) : (
                <div className="mt-2 flex min-w-0 items-center gap-2 text-sm leading-relaxed text-gray-600">
                    <span className="min-w-0">{props.description}</span>
                    {props.variant === "addon" && props.exclusiveSupport && (
                        <div className="shrink-0" onClick={(event) => event.stopPropagation()}>
                            <Tooltip text="Durante sua assinatura, funcionalidades e melhorias que você pedir e que fizerem sentido serão implementadas em 1 semana." size="medium" showOnClick>
                                <span className="inline-flex cursor-help items-center gap-1.5 whitespace-nowrap rounded-full bg-brand/10 px-2.5 py-1 text-[11px] font-bold leading-none text-brand">
                                    Atendimento Exclusivo
                                    <FontAwesomeIcon icon={faCircleInfo} className="text-[10px]" />
                                </span>
                            </Tooltip>
                        </div>
                    )}
                </div>
            )}

            {included ? (
                <p className="mt-5 text-sm font-bold text-brand">{props.priceLabel}</p>
            ) : (
                <div className="mt-5 flex items-end gap-1 text-gray-900">
                    <span className="text-2xl font-bold">{props.priceLabel}</span>
                    <span className="pb-0.5 text-xs text-gray-500">/mês</span>
                </div>
            )}
            <ul className={included ? "mt-3 flex flex-wrap gap-x-4 gap-y-2 text-sm text-gray-700" : "mt-4 grid min-w-0 grid-cols-3 gap-2 text-sm text-gray-700"}>
                {props.features.map((feature) => (
                    <li key={feature} className={included ? "flex items-center gap-2" : "flex min-w-0 items-center gap-1.5"}>
                        <FontAwesomeIcon icon={faCheck} className={included ? "text-xs text-brand" : "shrink-0 text-xs text-brand"} />
                        {included ? feature : <span title={feature}>{feature}</span>}
                    </li>
                ))}
            </ul>

            <div className="mt-auto flex flex-col gap-4 pt-7">
                {props.variant === "included" ? <>
                    <div className="flex items-center gap-2 text-sm font-semibold text-brand">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] text-white"><FontAwesomeIcon icon={faCheck} /></span>
                        Incluído na sua conta
                    </div>
                    <Link href={props.learnMoreLink.href} target="_blank" rel="noreferrer" className="inline-flex w-fit cursor-pointer items-center gap-2 text-sm font-semibold text-gray-700 transition-colors hover:text-brand">
                        {props.learnMoreLink.label}
                        <FontAwesomeIcon icon={faArrowRight} className="text-xs" />
                    </Link>
                </> : <>
                    {active && <div className="flex items-center gap-2 text-sm font-semibold text-green-700">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-green-600 text-[10px] text-white"><FontAwesomeIcon icon={faCheck} /></span>
                        Sistema ativo
                    </div>}
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <button type="button" onClick={stopAndLearnMore} className="w-fit cursor-pointer text-left text-sm font-semibold text-gray-700 transition-colors hover:text-brand xl:whitespace-nowrap">
                            Ver tudo que o sistema faz
                        </button>
                        {!active && <button type="button" onClick={stopAndHandleAction} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-dark-brand xl:whitespace-nowrap">
                            {selected ? "Selecionado" : props.onToggle ? "Adicionar ao meu iMenu" : "Saiba mais"}
                            <FontAwesomeIcon icon={selected ? faCheck : faArrowRight} className="text-xs" />
                        </button>}
                    </div>
                </>}
            </div>
        </div>
    );
}
