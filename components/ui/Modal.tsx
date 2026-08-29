"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";

let activeScrollLocks = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    showCloseButton?: boolean;
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
    const scrollLocked = useRef(false);

    function lockPageScroll() {
        if (scrollLocked.current) return;

        if (activeScrollLocks === 0) {
            originalBodyOverflow = document.body.style.overflow;
            originalHtmlOverflow = document.documentElement.style.overflow;
            document.body.style.overflow = "hidden";
            document.documentElement.style.overflow = "hidden";
        }

        activeScrollLocks += 1;
        scrollLocked.current = true;
    }

    function restorePageScroll() {
        if (!scrollLocked.current) return;

        activeScrollLocks = Math.max(0, activeScrollLocks - 1);
        scrollLocked.current = false;

        if (activeScrollLocks === 0) {
            document.body.style.overflow = originalBodyOverflow;
            document.documentElement.style.overflow = originalHtmlOverflow;
        }
    }

    useEffect(() => {
        if (open) {
            setMounted(true);
            setActive(false);
            lockPageScroll();

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
            restorePageScroll();
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
            restorePageScroll();
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
