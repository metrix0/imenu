"use client";

import { ReactNode, useEffect, useState } from "react";

interface ModalProps {
    open: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string; 
}

export default function Modal({ open, onClose, children, className = "" }: ModalProps) {
    const [isVisible, setIsVisible] = useState(false); // Controla se está no DOM
    const [isAnimatingOut, setIsAnimatingOut] = useState(false); // Controla a classe de saída

    useEffect(() => {
        if (open) {
            setIsVisible(true);
            setIsAnimatingOut(false);
            document.body.style.overflow = "hidden"; 
        } else {
            // Inicia animação de saída
            setIsAnimatingOut(true);
            
            // Aguarda o tempo da animação (ex: 200ms) para remover do DOM
            const timer = setTimeout(() => {
                setIsVisible(false);
                setIsAnimatingOut(false);
                document.body.style.overflow = "unset"; 
            }, 200); // 200ms deve bater com a duração no CSS

            return () => clearTimeout(timer);
        }
    }, [open]);

    // Lógica de ESC
    useEffect(() => {
        const handleEsc = (e: KeyboardEvent) => {
            if (e.key === "Escape") onClose();
        };
        if (open) window.addEventListener("keydown", handleEsc);
        return () => window.removeEventListener("keydown", handleEsc);
    }, [open, onClose]);

    if (!isVisible) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
            {/* Backdrop com animação de fade in/out */}
            <div
                className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${
                    isAnimatingOut ? "opacity-0" : "opacity-100"
                }`}
                onClick={onClose}
            />

            {/* Conteúdo com animação de scale/fade */}
            <div
                className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden transform transition-all duration-200 ${
                    isAnimatingOut 
                        ? "scale-95 opacity-0 translate-y-4" // Estado Final (Saída)
                        : "scale-100 opacity-100 translate-y-0 animate-fadeUp" // Estado Inicial (Entrada) - ou classes padrão
                } ${className}`}
                onClick={(e) => e.stopPropagation()} 
            >
                {children}
            </div>
        </div>
    );
}