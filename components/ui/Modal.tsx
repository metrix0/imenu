"use client";

import { ReactNode, isValidElement, useEffect, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import { usePanelAppearance } from "./PanelAppearance";
import ModalCloseButton from "./ModalCloseButton";

let activeScrollLocks = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";
let originalBodyWidth = "";

export type ModalHeight = number | `${number}dvh`;

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    showCloseButton?: boolean;
    fixedHeight?: boolean;
    /** Required per usage. Do not add a shared/default modal height. */
    height: ModalHeight;
}

export default function Modal({
    open,
    onClose,
    children,
    className = "",
    showCloseButton = false,
    fixedHeight = false,
    height,
}: ModalProps) {
    const panel = usePanelAppearance();
    const [mounted, setMounted] = useState(open);
    const [active, setActive] = useState(false);
    const scrollLocked = useRef(false);
    const requestedHeight = typeof height === "number" ? `${height}px` : height;
    const childUsesFixedPanelLayout =
        panel &&
        isValidElement<{ className?: string }>(children) &&
        typeof children.props.className === "string" &&
        children.props.className.split(/\s+/).includes("panel-complements");
    const useFixedHeight = fixedHeight || childUsesFixedPanelLayout;

    function lockPageScroll() {
        if (scrollLocked.current) return;

        if (activeScrollLocks === 0) {
            const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;

            originalBodyOverflow = document.body.style.overflow;
            originalHtmlOverflow = document.documentElement.style.overflow;
            originalBodyWidth = document.body.style.width;

            if (scrollbarWidth > 0) {
                document.body.style.width = `calc(100% - ${scrollbarWidth}px)`;
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
            document.body.style.width = originalBodyWidth;
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
        <div className={`${panel ? "panel-essencial panel-modal" : ""} fixed inset-0 z-50 isolate flex min-h-[100dvh] w-screen items-center justify-center overflow-y-auto p-3 sm:p-6 ${panel ? "" : "2xl:p-8"}`}>
            <button
                type="button"
                aria-label="Fechar modal pelo fundo"
                onClick={onClose}
                className={`fixed inset-0 min-h-[100dvh] w-screen ${
                    panel
                        ? "bg-[#1d1d1d]/40 backdrop-blur-[3px]"
                        : "bg-black/40 backdrop-blur-sm"
                } transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0"
                }`}
            />

            <div
                role="dialog"
                style={
                    panel
                        ? ({
                              "--modal-requested-height": requestedHeight,
                              ...(useFixedHeight ? { height: requestedHeight } : {}),
                          } as CSSProperties)
                        : { height }
                }
                aria-modal="true"
                onClick={(event: { stopPropagation(): void }) =>
                    event.stopPropagation()
                }
                className={`relative flex w-full max-w-2xl flex-col overflow-y-auto bg-white transition-all duration-200 ${
                    panel
                        ? "rounded-[10px] border border-[#e2e5e9] shadow-[0_20px_60px_#1d1d1d26] [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1 max-h-[min(var(--modal-requested-height),calc(100dvh-24px))] sm:max-h-[min(var(--modal-requested-height),calc(100dvh-48px))]"
                        : "max-h-[92dvh] rounded-xl shadow-2xl sm:max-h-[90dvh] sm:rounded-2xl 2xl:max-h-[88dvh]"
                } ${
                    active
                        ? "translate-y-0 scale-100 opacity-100"
                        : "translate-y-3 scale-95 opacity-0"
                } ${className}`}
            >
                {panel && <ModalCloseButton onClose={onClose} />}
                {!panel && showCloseButton && (
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
                {panel ? <div className="panel-modal-body [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1">{children}</div> : children}
            </div>
        </div>,
        document.body
    );
}
