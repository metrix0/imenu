"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}

const ANIMATION_DURATION_MS = 300;

export default function Modal({
    open,
    onClose,
    children,
    className = "",
}: ModalProps) {
    const [mounted, setMounted] = useState(open);
    const [active, setActive] = useState(false);
    const previousBodyOverflow = useRef("");
    const previousHtmlOverflow = useRef("");

    function lockPageScroll() {
        previousBodyOverflow.current = document.body.style.overflow;
        previousHtmlOverflow.current = document.documentElement.style.overflow;
        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
    }

    function restorePageScroll() {
        document.body.style.overflow = previousBodyOverflow.current;
        document.documentElement.style.overflow = previousHtmlOverflow.current;
    }

    useEffect(() => {
        let firstFrame = 0;
        let secondFrame = 0;
        let timer = 0;

        if (open) {
            setMounted(true);
            setActive(false);
            lockPageScroll();

            // Paint the initial state before starting the transition.
            firstFrame = requestAnimationFrame(() => {
                secondFrame = requestAnimationFrame(() => setActive(true));
            });
        } else {
            setActive(false);
            timer = window.setTimeout(() => {
                setMounted(false);
                restorePageScroll();
            }, ANIMATION_DURATION_MS);
        }

        return () => {
            cancelAnimationFrame(firstFrame);
            cancelAnimationFrame(secondFrame);
            window.clearTimeout(timer);
        };
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
        <div className="fixed inset-0 z-50 isolate flex min-h-[100svh] w-full items-center justify-center overflow-y-auto p-3 sm:min-h-[100dvh] sm:p-6">
            <button
                type="button"
                aria-label="Fechar modal"
                onClick={onClose}
                className={`fixed inset-0 min-h-[100svh] bg-black/40 backdrop-blur-sm transition-opacity duration-300 ease-out motion-reduce:transition-none sm:min-h-[100dvh] ${
                    active ? "opacity-100" : "opacity-0"
                }`}
            />

            <div
                role="dialog"
                aria-modal="true"
                onClick={(event: { stopPropagation(): void }) =>
                    event.stopPropagation()
                }
                className={`relative flex max-h-[92svh] w-full max-w-2xl transform-gpu flex-col overflow-y-auto rounded-xl bg-white shadow-2xl transition-[opacity,transform] duration-300 ease-out will-change-transform motion-reduce:transition-none sm:max-h-[90dvh] sm:rounded-2xl ${
                    active
                        ? "translate-y-0 opacity-100 sm:scale-100"
                        : "translate-y-6 opacity-0 sm:translate-y-4 sm:scale-[0.96]"
                } ${className}`}
            >
                {children}
            </div>
        </div>,
        document.body
    );
}
