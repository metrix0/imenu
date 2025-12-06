    "use client";

    import { ReactNode, useEffect } from "react";

    interface ModalProps {
        open: boolean;
        onClose: () => void;
        children: ReactNode;
        className?: string; // Para customizar largura se necessário
    }

    export default function Modal({ open, onClose, children, className = "" }: ModalProps) {

        // Fecha ao apertar ESC
        useEffect(() => {
            const handleEsc = (e: KeyboardEvent) => {
                if (e.key === "Escape") onClose();
            };
            if (open) {
                document.body.style.overflow = "hidden"; // Trava o scroll da página de fundo
                window.addEventListener("keydown", handleEsc);
            }
            return () => {
                document.body.style.overflow = "unset"; // Destrava scroll
                window.removeEventListener("keydown", handleEsc);
            };
        }, [open, onClose]);

        if (!open) return null;

        return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 ">
                {/* Backdrop (Fundo escuro) - Clicar aqui fecha o modal */}
                <div
                    className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                    onClick={onClose}
                />

                {/* Conteúdo do Modal */}
                <div
                    className={`relative bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col animate-fadeUp overflow-hidden ${className}`}
                    onClick={(e) => e.stopPropagation()} // Evita fechar ao clicar dentro
                >
                    {children}
                </div>
            </div>
        );
    }