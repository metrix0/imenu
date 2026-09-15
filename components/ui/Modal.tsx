"use client";

import { ReactNode, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePanelAppearance } from "./PanelAppearance";
import ModalCloseButton from "./ModalCloseButton";

let activeScrollLocks = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";
let originalBodyPaddingRight = "";

export type ModalHeight = number | `${number}dvh`;

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    showCloseButton?: boolean;
    /** Required per usage. Do not add a shared/default modal height. */
    height: ModalHeight;
}

export default function Modal({
    open,
    onClose,
    children,
    className = "",
    showCloseButton = false,
    height,
}: ModalProps) {
    const panel = usePanelAppearance();
    const [mounted, setMounted] = useState(open);
    const [active, setActive] = useState(false);
    const scrollLocked = useRef(false);

    function lockPageScroll() {
        if (scrollLocked.current) return;

        if (activeScrollLocks === 0) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
            const bodyPaddingRight = Number.parseFloat(window.getComputedStyle(document.body).paddingRight) || 0;

            originalBodyOverflow = document.body.style.overflow;
            originalHtmlOverflow = document.documentElement.style.overflow;
            originalBodyPaddingRight = document.body.style.paddingRight;

            if (scrollbarWidth > 0) {
                document.body.style.paddingRight = `${bodyPaddingRight + scrollbarWidth}px`;
            }

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
            document.body.style.paddingRight = originalBodyPaddingRight;
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
        <div className={`${panel ? "panel-essencial panel-modal" : ""} fixed inset-0 z-50 isolate flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto p-3 sm:p-6`}>
            <button
                type="button"
                aria-label="Fechar modal pelo fundo"
                onClick={onClose}
                className={`fixed inset-0 min-h-[100dvh] bg-[#1d1d1d]/40 backdrop-blur-[3px] transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0"
                }`}
            />

            <div
                role="dialog"
                style={{ height }}
                aria-modal="true"
                onClick={(event: { stopPropagation(): void }) =>
                    event.stopPropagation()
                }
                className={`relative flex max-h-[calc(100dvh-24px)] w-full max-w-2xl flex-col overflow-y-auto rounded-[10px] border border-[#e2e5e9] bg-white shadow-[0_20px_60px_#1d1d1d26] transition-all duration-200 sm:max-h-[calc(100dvh-48px)] ${
                    active
                        ? "translate-y-0 scale-100 opacity-100"
                        : "translate-y-3 scale-95 opacity-0"
                } ${className}`}
            >
                {(panel || showCloseButton) && <ModalCloseButton onClose={onClose} />}
                {panel ? <div className="panel-modal-body">{children}</div> : children}
            </div>
        </div>,
        document.body
    );
}
