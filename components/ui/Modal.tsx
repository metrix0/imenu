"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}

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
        previousHtmlOverflow.current =
            document.documentElement.style.overflow;

        document.body.style.overflow = "hidden";
        document.documentElement.style.overflow = "hidden";
    }

    function restorePageScroll() {
        document.body.style.overflow = previousBodyOverflow.current;
        document.documentElement.style.overflow =
            previousHtmlOverflow.current;
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
        <div className="fixed inset-0 z-50 isolate flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto p-3 sm:p-6">
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
                className={`relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl bg-white shadow-2xl transition-all duration-200 sm:max-h-[90dvh] sm:rounded-2xl ${
                    active
                        ? "translate-y-0 scale-100 opacity-100"
                        : "translate-y-3 scale-95 opacity-0"
                } ${className}`}
            >
                {children}
            </div>
        </div>,
        document.body
    );
}
