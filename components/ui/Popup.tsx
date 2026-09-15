
"use client";
import { useState, ReactNode } from "react";
import Modal from "./Modal";
import { usePanelAppearance } from "./PanelAppearance";

interface PopupProps {
    trigger?: ReactNode;          // Optional custom trigger button
    open?: boolean;               // Optional external control
    onClose?: () => void;         // Optional callback when closed
    children?: ReactNode;         // Popup content
}

export default function Popup({ trigger, open, onClose, children }: PopupProps) {
    const panel = usePanelAppearance();
    const [isOpen, setIsOpen] = useState(false);
    const visible = open ?? isOpen; // if open prop passed, override local state

    const handleClose = () => {
        if (onClose) onClose();
        setIsOpen(false);
    };

    if (panel) return <Modal height={240} open={visible} onClose={handleClose} className="max-w-sm"><div className="p-6 text-center">{children}</div></Modal>;

    return (
        <>

            {/* Popup itself */}
            {visible && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1d1d1d]/40 p-4 backdrop-blur-[3px]">
                    <div data-ui="popup" className="max-h-[calc(100dvh-32px)] w-full max-w-[20rem] overflow-y-auto rounded-[10px] border border-[#e2e5e9] bg-white p-4 text-center shadow-[0_20px_60px_#1d1d1d26] sm:p-6">
                        {children || (
                            <>
                                <h2 className="text-xl font-semibold mb-4">Popup</h2>
                                <p className="mb-4">Conteúdo padrão do popup.</p>
                            </>
                        )}
                    </div>
                </div>
            )}
        </>
    );
}
