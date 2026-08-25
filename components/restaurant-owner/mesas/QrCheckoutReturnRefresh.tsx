"use client";

import { useLayoutEffect, useState } from "react";
import Image from "next/image";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCheck,
    faGift,
    faPrint,
    faQrcode,
    faUsers,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const CHECKOUT_RETURN_PATHS = new Set([
    "/painel/mesas",
    "/painel/configuracoes",
    "/restaurante/criar/localizacao",
]);

const BENEFITS = [
    {
        icon: faQrcode,
        text: "QR Code exclusivo por mesa e QR Code universal",
    },
    {
        icon: faUsers,
        text: "Vários clientes podem pedir ao mesmo tempo pela mesma mesa",
    },
    {
        icon: faPrint,
        text: "Pedidos identificados pela mesa no painel e na impressão",
    },
] as const;

function launchPartyPoppers(): () => void {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        return () => {};
    }

    const colors = [
        "#f14400",
        "#f59e0b",
        "#22c55e",
        "#3b82f6",
        "#8b5cf6",
        "#ec4899",
    ];
    const pieces: HTMLSpanElement[] = [];

    [0.08, 0.92].forEach((origin, originIndex) => {
        const direction = originIndex === 0 ? 1 : -1;

        for (let index = 0; index < 34; index += 1) {
            const piece = document.createElement("span");
            const width = 7 + Math.random() * 7;
            const height = 12 + Math.random() * 12;
            const travelX =
                direction * (120 + Math.random() * window.innerWidth * 0.34);
            const rise = -(180 + Math.random() * window.innerHeight * 0.44);
            const fall = 260 + Math.random() * 360;
            const rotation = direction * (360 + Math.random() * 900);
            const duration = 1500 + Math.random() * 900;

            piece.style.position = "fixed";
            piece.style.left = `${window.innerWidth * origin}px`;
            piece.style.top = `${window.innerHeight * 0.78}px`;
            piece.style.width = `${width}px`;
            piece.style.height = `${height}px`;
            piece.style.borderRadius = "2px";
            piece.style.backgroundColor =
                colors[Math.floor(Math.random() * colors.length)];
            piece.style.pointerEvents = "none";
            piece.style.zIndex = "70";
            piece.style.willChange = "transform, opacity";
            document.body.appendChild(piece);
            pieces.push(piece);

            const animation = piece.animate(
                [
                    {
                        transform: "translate3d(0, 0, 0) rotate(0deg)",
                        opacity: 1,
                    },
                    {
                        transform: `translate3d(${travelX * 0.72}px, ${rise}px, 0) rotate(${rotation * 0.7}deg)`,
                        opacity: 1,
                        offset: 0.55,
                    },
                    {
                        transform: `translate3d(${travelX}px, ${rise + fall}px, 0) rotate(${rotation}deg)`,
                        opacity: 0,
                    },
                ],
                {
                    duration,
                    easing: "cubic-bezier(0.18, 0.7, 0.28, 1)",
                    fill: "forwards",
                }
            );

            animation.onfinish = () => piece.remove();
        }
    });

    return () => pieces.forEach((piece) => piece.remove());
}

export default function QrCheckoutReturnRefresh() {
    const [open, setOpen] = useState(false);
    const setProductSelectionCompleted = useCreationStore(
        (state) => state.setProductSelectionCompleted
    );

    useLayoutEffect(() => {
        if (!CHECKOUT_RETURN_PATHS.has(window.location.pathname)) return;

        const checkoutState = new URLSearchParams(window.location.search).get(
            "checkout"
        );
        if (checkoutState !== "success") return;

        const url = new URL(window.location.href);
        url.searchParams.delete("checkout");
        window.history.replaceState(
            {},
            "",
            `${url.pathname}${url.search}${url.hash}`
        );

        if (window.location.pathname === "/restaurante/criar/localizacao") {
            setProductSelectionCompleted(true);
        }

        setOpen(true);
        return launchPartyPoppers();
    }, [setProductSelectionCompleted]);

    return (
        <Modal
            open={open}
            onClose={() => setOpen(false)}
            className="max-w-xl"
            showCloseButton
        >
            <div className="px-6 pb-6 pt-7 text-center sm:px-8 sm:pb-8 sm:pt-8">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 p-2">
                    <Image
                        src="/images/party_popper_emoji.png"
                        alt="Comemoração"
                        width={48}
                        height={48}
                        className="h-12 w-12 object-contain"
                    />
                </div>

                <h2 className="mt-5 text-2xl font-bold text-gray-900 sm:text-3xl">
                    Obrigado pela compra!
                </h2>
                <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-gray-600 sm:text-base">
                    Seu iMenu QR Code Mesa está sendo ativado. Agora você tem
                    novos recursos para atender seus clientes direto pela mesa.
                </p>

                <div className="mt-6 space-y-3 text-left">
                    {BENEFITS.map((benefit) => (
                        <div
                            key={benefit.text}
                            className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                        >
                            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
                                <FontAwesomeIcon icon={benefit.icon} />
                            </span>
                            <span className="text-sm font-medium text-gray-800">
                                {benefit.text}
                            </span>
                            <FontAwesomeIcon
                                icon={faCheck}
                                className="ml-auto text-sm text-green-600"
                            />
                        </div>
                    ))}
                </div>

                <div className="mt-5 rounded-xl border border-brand/20 bg-brand/5 p-4 text-left">
                    <div className="flex items-start gap-3">
                        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
                            <FontAwesomeIcon icon={faGift} />
                        </span>
                        <div>
                            <p className="text-sm font-bold text-gray-900">
                                BÔNUS: Atendimento Exclusivo
                            </p>
                            <p className="mt-1 text-sm leading-relaxed text-gray-600">
                                Funcionalidades e melhorias que você pedir e que
                                fizerem sentido serão implementadas em 1 semana.
                            </p>
                        </div>
                    </div>
                </div>

                <Button
                    type="button"
                    className="mt-6 w-full"
                    onClick={() => setOpen(false)}
                >
                    Começar a usar
                </Button>
            </div>
        </Modal>
    );
}
