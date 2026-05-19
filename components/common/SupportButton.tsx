"use client";

import { useState, useImperativeHandle, forwardRef } from "react";
import Popup from "../ui/Popup";
import { icons } from "@/lib/utils/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

const QRCodePopupContent = ({ url, phone, onClose }: { url: string; phone: string; onClose: () => void; }) => (
    <div className="relative pt-6"> {/* Adicionei padding-top para o conteúdo não subir no botão */}
        <button 
            type="button"
            onClick={onClose}
            // MUDANÇA: top-2 right-2 coloca o botão DENTRO do card
            className="absolute -top-3 -right-3 text-gray-400 hover:text-red-500 transition-colors p-2 cursor-pointer "
            title="Fechar"
        >
            <FontAwesomeIcon icon={icons.faXmark} className="text-xl" />
        </button>

        <div className="text-center">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Scaneie o QR Code</h3>
            <div className="rounded-md border border-gray-200 p-4 inline-block">
                <img
                    src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(
                        url
                    )}&format=svg`}
                    alt="QR Code para WhatsApp"
                    width={180}
                    height={180}
                />
            </div>
            <p className="mt-4 text-sm text-gray-600">Ou adicione no Whatsapp:</p>
            <p className="text-lg font-medium text-gray-900 select-all">{phone}</p>
        </div>
    </div>
);

export interface SupportButtonRef {
    open: () => void;
}

const SupportButton = forwardRef<SupportButtonRef>((props, ref) => {
    const [isOpen, setIsOpen] = useState(false);

    const phone = "5519988760900";
    const message = "Olá! Preciso de ajuda com um problema!";
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    const openSupport = () => {
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(
            navigator.userAgent
        );

        if (isMobileDevice) {
            window.open(whatsappUrl, "_blank");
        } else {
            setIsOpen(true);
        }
    };

    useImperativeHandle(ref, () => ({
        open: openSupport
    }));

    return (
        <>
            <button
                type="button"
                onClick={openSupport}
                className="fixed cursor-pointer bottom-6 right-6 z-[40] flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform duration-300 ease-in-out hover:scale-110 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label="Suporte via WhatsApp"
            >
                <FontAwesomeIcon icon={icons.faWhatsapp} size="2x" />
            </button>

            <Popup
                open={isOpen}
                onClose={() => setIsOpen(false)}
            >
                <QRCodePopupContent 
                    url={whatsappUrl} 
                    phone={phone} 
                    onClose={() => setIsOpen(false)} 
                />
            </Popup>
        </>
    );
});

SupportButton.displayName = "SupportButton";
export default SupportButton;