"use client";

import {
    ReactNode,
    useEffect,
    useLayoutEffect,
    useRef,
    useState,
} from "react";
import { createPortal } from "react-dom";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { icons } from "@/lib/utils/fontawesome";
import { usePanelAppearance } from "./PanelAppearance";
import ModalCloseButton from "./ModalCloseButton";

let activeScrollLocks = 0;
let originalBodyOverflow = "";
let originalHtmlOverflow = "";

export type ModalHeight = number | `${number}dvh`;

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
    showCloseButton?: boolean;
    /** Required per usage. Caps the modal height without stretching shorter content. */
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
    const [panelHeight, setPanelHeight] = useState<number | null>(null);
    const scrollLocked = useRef(false);
    const panelBodyRef = useRef<HTMLDivElement>(null);

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

    useLayoutEffect(() => {
        if (!panel || !open || !mounted) {
            setPanelHeight(null);
            return;
        }

        const body = panelBodyRef.current;
        if (!body) return;

        const getCapPixels = () => {
            const viewportCap = window.innerHeight * 0.92;
            if (typeof height === "number") {
                return Math.min(height, viewportCap);
            }

            const dvh = Number.parseFloat(height);
            return Math.min((window.innerHeight * dvh) / 100, viewportCap);
        };

        const measure = () => {
            const nextHeight = Math.min(body.getBoundingClientRect().height, getCapPixels());
            setPanelHeight((currentHeight) =>
                currentHeight !== null && Math.abs(currentHeight - nextHeight) < 1
                    ? currentHeight
                    : nextHeight
            );
        };

        measure();

        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(body);
        window.addEventListener("resize", measure);

        return () => {
            resizeObserver.disconnect();
            window.removeEventListener("resize", measure);
        };
    }, [height, mounted, open, panel]);

    useEffect(
        () => () => {
            restorePageScroll();
        },
        []
    );

    if (!mounted) return null;

    const resolvedMaxHeight =
        typeof height === "number"
            ? `min(${height}px, 92dvh)`
            : `min(${height}, 92dvh)`;

    return createPortal(
        <div className={`${panel ? "panel-essencial panel-modal" : ""} fixed inset-0 z-50 isolate flex min-h-[100dvh] w-full items-center justify-center overflow-y-auto p-3 sm:p-6 2xl:p-8`}>
            <button
                type="button"
                aria-label="Fechar modal pelo fundo"
                onClick={onClose}
                className={`fixed inset-0 min-h-[100dvh] bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
                    active ? "opacity-100" : "opacity-0"
                }`}
            />

            <div
                role="dialog"
                style={{
                    maxHeight: resolvedMaxHeight,
                    ...(panel && panelHeight !== null
                        ? { height: `${panelHeight}px` }
                        : {}),
                    ...(panel
                        ? {
                              transition:
                                  "height 300ms ease-in-out, transform 200ms ease, opacity 200ms ease",
                          }
                        : {}),
                }}
                aria-modal="true"
                onClick={(event: { stopPropagation(): void }) =>
                    event.stopPropagation()
                }
                className={`relative flex w-full max-w-2xl flex-col overflow-y-auto rounded-xl bg-white shadow-2xl transition-all duration-200 sm:rounded-2xl ${
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
                {panel ? (
                    <div ref={panelBodyRef} className="panel-modal-body">
                        {children}
                    </div>
                ) : (
                    children
                )}
            </div>
        </div>,
        document.body
    );
}
