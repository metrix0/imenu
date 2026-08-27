"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    showCloseButton?: boolean;
}

let openModalCount = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";

function lockPageScroll() {
    if (openModalCount === 0) {
        originalBodyOverflow = document.body.style.overflow;
        originalHtmlOverflow = document.documentElement.style.overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
    }

    openModalCount += 1;
}

function restorePageScroll() {
    if (openModalCount === 0) return;

    openModalCount -= 1;
    if (openModalCount === 0) {
        document.body.style.overflow = originalBodyOverflow;
        document.documentElement.style.overflow = originalHtmlOverflow;
    }
}

export default function Modal({
    open,
    onClose,
    children,
    className = "",
    showCloseButton = false,
}: ModalProps) {
    const [mounted, setMounted] = useState(open);
    const [active, setActive] = useState(false);
    const hasScrollLock = useRef(false);

    function acquireScrollLock() {
        if (hasScrollLock.current) return;
        lockPageScroll();
        hasScrollLock.current = true;
    }

    function releaseScrollLock() {
        if (!hasScrollLock.current) return;
        restorePageScroll();
        hasScrollLock.current = false;
    }

    useEffect(() => {
        if (open) {
            setMounted(true);
            setActive(false);
            acquireScrollLock();

            let secondFrame = 0;
            const firstFrame = requestAnimationFrame(() => {
                secondFrame = requestAnimationFrame(() => setActive(true));
            });

            return () => {
                cancelAnimationFrame(firstFrame);
                if (secondFrame) cancelAnimationFrame(secondFrame);
            };
        }

        setActive(false);

        const timer = window.setTimeout(() => {
            setMounted(false);
            releaseScrollLock();
        }, 200);

        return () => window.clearTimeout(timer);
    }, [open]);

    useEffect(() => {
        if (!open) return;

        const handleEsc = (event: KeyboardEvent) => {
            if (event.key === "Escape") onClose();
        };

        window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onClose]);

    useEffect(
        () => () => {
            releaseScrollLock();
        },
        []
    );

    if (!mounted) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 isolate flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto p-3 sm:p-6 2xl:p-8">
            <button
                type="button"
                aria-label="Fechar modal"
                onClick={onClose}
                className={`fixed inset-0 min-h-[100dvh] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0"
                }`}
            />

            <div
                role="dialog"
                aria-modal="true"
                onClick={(event: { stopPropagation(): void }) =>
                    event.stopPropagation()
                }
                className={`relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl bg-white shadow-2xl transition-all duration-200 sm:max-h-[90dvh] sm:rounded-2xl 2xl:max-h-[88dvh] ${
                    active
                        ? "translate-y-0 scale-100 opacity-100"
                        : "translate-y-3 scale-95 opacity-0"
                } ${className}`}
            >
                {showCloseButton && (
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Fechar"
                        className="sticky top-3 z-30 -mb-12 ml-auto mr-3 mt-3 flex h-9 w-9 shrink-0 cursor-pointer items-center justify-center text-gray-400 hover:text-gray-600"
                    >
                        <FontAwesomeIcon
                            icon={icons.faTimes}
                            className="text-xl"
                        />
                    </button>
                )}
                {children}
            </div>
        </div>,
        document.body
    );
}
