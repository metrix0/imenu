"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Sparkles } from "lucide-react";
import { IA_PLUS_BENEFITS, IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";
import { PLUS_FEATURE_ICONS } from "@/components/restaurant-owner/mesas/MenuProductCard";
import { usePlusExposure } from "@/lib/analytics/plusExposure";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import { faQrcode, faStore } from "@fortawesome/free-solid-svg-icons";

interface ShareMenuModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurantId: string;
    restaurantSlug?: string;
    variant?: "share" | "welcome";
    onPlus?: () => void;
}

export default function ShareMenuModal({
    isOpen,
    onClose,
    restaurantId,
    restaurantSlug,
    variant = "share",
    onPlus,
}: ShareMenuModalProps) {
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false);
    const welcomeLinkRef = useRef<HTMLInputElement>(null);
    const isWelcome = variant === "welcome";
    const exposureRef = usePlusExposure("onboarding_complete", isWelcome && isOpen && Boolean(onPlus));

    const identifier = restaurantSlug || restaurantId;
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const menuUrl = `${origin}/${identifier}`;

    useEffect(() => {
        if (!isWelcome || !isOpen) return;

        const frame = window.requestAnimationFrame(() => {
            if (welcomeLinkRef.current) {
                welcomeLinkRef.current.scrollLeft = welcomeLinkRef.current.scrollWidth;
            }
        });

        return () => window.cancelAnimationFrame(frame);
    }, [isOpen, isWelcome, menuUrl]);

    const handleCopy = () => {
        navigator.clipboard.writeText(menuUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}&format=svg`;

    const handleClose = () => {
        setShowQr(false);
        onClose();
    };

    const handleOrder = () => {
        window.open(menuUrl, "_blank", "noopener,noreferrer");
        handleClose();
    };

    if (isWelcome) {
        return (
            <Modal
                height={onPlus ? 760 : "100dvh"}
                fixedHeight={Boolean(onPlus)}
                bodyClassName={onPlus ? "flex min-h-0 flex-1 flex-col !overflow-hidden" : undefined}
                open={isOpen}
                onClose={handleClose}
                className="max-w-md"
            >
                <div className={onPlus ? "flex min-h-0 flex-1 flex-col" : ""}>
                <div className={`flex min-h-0 flex-col items-center overflow-y-auto p-6 text-center sm:p-7 ${onPlus ? "flex-1" : ""}`}>
                    <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-brand/10 text-brand">
                        <FontAwesomeIcon icon={icons.faCheck} className="text-xl" />
                    </div>

                    <h3 className="mb-2 text-2xl font-bold text-gray-900">
                        Sua loja está pronta!
                    </h3>
                    <p className="mb-4 max-w-sm text-sm leading-6 text-gray-500">
                        {onPlus ? "Seu cardápio já está no ar. Dê o próximo passo para vender mais." : "Seu cardápio já está no ar. Compartilhe o link abaixo com seus clientes para começar a receber pedidos."}
                    </p>

                    <div className="mb-4 w-full rounded-xl border border-brand/20 bg-brand/[0.04] p-4 text-left">
                        <p className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-brand">
                            Link do seu cardápio
                        </p>
                        <div className="flex w-full gap-2">
                            <div className="min-w-0 flex-1">
                                <Input
                                    ref={welcomeLinkRef}
                                    readOnly
                                    value={menuUrl}
                                    className="bg-white text-xs text-gray-700"
                                />
                            </div>
                            <Button
                                type="button"
                                onClick={handleCopy}
                                className="shrink-0 px-3"
                                variant="secondary"
                                title="Copiar link"
                            >
                                <FontAwesomeIcon
                                    icon={copied ? icons.faCheck : icons.faCopy}
                                    className="mr-2"
                                />
                                {copied ? "Copiado!" : "Copiar"}
                            </Button>
                        </div>
                        <p hidden={Boolean(onPlus)} className="mt-2 text-xs leading-5 text-gray-500">
                            Use este link no WhatsApp, Instagram, Google ou onde seus clientes encontrarem sua loja.
                        </p>
                    </div>

                    {onPlus ? (
                        <section ref={exposureRef} className="mb-5 w-full border-t border-gray-200 pt-5 text-left" aria-label="iMenu Plus">
                            <h4 className="text-xl font-bold text-gray-900">Venda mais com iMenu Plus.</h4>
                            <ul className="mt-4 space-y-4">
                                {IA_PLUS_BENEFITS.map(benefit => {
                                    const Icon = PLUS_FEATURE_ICONS[benefit.title] ?? Sparkles;
                                    return <li key={benefit.title} className="flex gap-3">
                                        <Icon size={20} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                                        <div><h5 className="text-sm font-semibold text-gray-900">{benefit.title}</h5><p className="mt-1 text-xs leading-5 text-gray-500">{benefit.description}</p></div>
                                    </li>;
                                })}
                            </ul>

                        </section>
                    ) : <div className="mb-5 w-full rounded-xl bg-gray-50 p-3 text-left">
                        <p className="text-sm leading-5 text-gray-600">
                            Quer mudar esse endereço? Altere a qualquer momento na aba{" "}
                            <span className="inline-flex items-center gap-1 font-semibold text-gray-900">
                                <FontAwesomeIcon icon={faStore} className="text-brand" />
                                Loja
                            </span>
                            .
                        </p>
                    </div>

                    }
                </div>
                <div className="shrink-0 bg-white px-6 pb-6 text-center sm:px-7 sm:pb-7">
                    {onPlus && <div className="mb-3 pt-3 text-left">
                        <p className="text-sm text-gray-600"><strong className="text-2xl text-gray-900">{IA_PLUS_PRICE_LABEL}</strong> /mês</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">Pix ou cartão · Cancele quando quiser</p>
                    </div>}
                    <Button type="button" onClick={onPlus ?? handleOrder} className="w-full" rightIcon={onPlus ? <ArrowRight size={16} aria-hidden="true" /> : undefined}>
                        {onPlus ? "Ativar iMenu Plus" : "Faça um pedido"}
                    </Button>
                    <Button
                        type="button"
                        onClick={handleClose}
                        className="mt-2 w-full"
                        variant="secondary"
                    >
                        {onPlus ? "Continuar grátis" : "Ir para o painel"}
                    </Button>
                </div>
                </div>
            </Modal>
        );
    }

    return (
        <Modal height={showQr ? 600 : 390} open={isOpen} onClose={handleClose} className="max-w-sm">
            <div className="p-6 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-4">
                    <FontAwesomeIcon icon={icons.faLink} className="text-xl" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">Compartilhar Cardápio Delivery</h3>
                <p className="text-gray-500 text-sm mb-6">
                    Envie este link para seus clientes ou peça para eles escanearem o código.
                </p>

                <div className="w-full flex gap-2 mb-4">
                    <div className="flex-1">
                        <Input
                            readOnly
                            value={menuUrl}
                            className="text-xs text-gray-600 bg-gray-50 text-center"
                        />
                    </div>
                    <Button onClick={handleCopy} className="px-3" variant="secondary" title="Copiar Link">
                        <FontAwesomeIcon icon={copied ? icons.faCheck : icons.faCopy} />
                    </Button>
                </div>

                <button
                    onClick={() => setShowQr(!showQr)}
                    className="cursor-pointer text-brand text-sm font-medium mb-6 hover:underline flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faQrcode} />
                    {showQr ? "Ocultar QR Code" : "Gerar QR Code"}
                </button>

                <div
                    className={`overflow-hidden transition-all duration-300 ease-in-out w-full flex justify-center ${
                        showQr ? "max-h-60 opacity-100 mb-6" : "max-h-0 opacity-0 mb-0"
                    }`}
                >
                    <div className="p-2 border border-gray-200 rounded-lg bg-white shadow-sm">
                        <img
                            src={qrCodeUrl}
                            alt="QR Code do Cardápio"
                            width={180}
                            height={180}
                            className="block"
                        />
                    </div>
                </div>

                <Button onClick={handleClose} className="w-full" variant="secondary">
                    Fechar
                </Button>
            </div>
        </Modal>
    );
}
