
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
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div data-ui="popup" className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 w-full max-w-[20rem] max-h-[90dvh] overflow-y-auto text-center">
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
