"use client";

import { ReactNode, useEffect, useState } from "react";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}

export default function Modal({ open, onClose, children, className = "" }: ModalProps) {
    const [mounted, setMounted] = useState(open);
    const [active, setActive] = useState(false);

    useEffect(() => {
        if (open) {
            setMounted(true);
            const frame = requestAnimationFrame(() => setActive(true));
            document.body.style.overflow = "hidden";
            return () => cancelAnimationFrame(frame);
        }

        setActive(false);
        const timer = window.setTimeout(() => {
            setMounted(false);
            document.body.style.overflow = "";
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

    useEffect(() => () => {
        document.body.style.overflow = "";
    }, []);

    if (!mounted) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6">
            <button
                type="button"
                aria-label="Fechar modal"
                onClick={onClose}
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${active ? "opacity-100" : "opacity-0"}`}
            />
            <div
                role="dialog"
                aria-modal="true"
                onClick={(event) => event.stopPropagation()}
                className={`relative flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-y-auto rounded-xl bg-white shadow-2xl transition-all duration-200 sm:max-h-[90vh] sm:rounded-2xl ${active ? "translate-y-0 scale-100 opacity-100" : "translate-y-3 scale-95 opacity-0"} ${className}`}
            >
                {children}
            </div>
        </div>
    );
}
