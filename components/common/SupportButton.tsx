// components/SupportButton.tsx
"use client";

import Popup from "../ui/Popup";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Componente de conteúdo (mantido igual)
const QRCodePopupContent = ({ 
    url, 
    phone, 
    onClose 
}: { 
    url: string; 
    phone: string; 
    onClose: () => void;
}) => (
    <div className="relative pt-2">
        <button 
            onClick={onClose}
            className="absolute -top-3 -right-3 text-gray-400 hover:text-red-500 transition-colors p-2 cursor-pointer"
            title="Fechar"
        >
            <FontAwesomeIcon icon={icons.faXmark} className="cursor-pointer text-xl" />
        </button>

        <div className="text-center">
            <h3 className="mb-4 text-lg font-semibold text-gray-800">Suporte via WhatsApp</h3>
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
            <p className="mt-4 text-sm text-gray-600">Ou adicione manualmente:</p>
            <p className="text-lg font-medium text-gray-900">{phone}</p>
        </div>
    </div>
);

// MUDANÇA: Agora aceita props para ser controlado externamente
interface SupportButtonProps {
    open: boolean;
    onToggle: (val: boolean) => void;
}

export default function SupportButton({ open, onToggle }: SupportButtonProps) {
    const phone = "5519997235394"; 
    const message = "Olá! Preciso de ajuda com um problema!";
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    const handleClick = () => {
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(
            navigator.userAgent
        );

        if (isMobileDevice) {
            window.open(whatsappUrl, "_blank");
        } else {
            // Abre o popup através da prop do pai
            onToggle(true);
        }
    };

    return (
        <>
            {/* Botão Flutuante (FAB) */}
            <button
                onClick={handleClick}
                className="fixed cursor-pointer bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform duration-300 ease-in-out hover:scale-110 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label="Suporte via WhatsApp"
            >
                <FontAwesomeIcon icon={icons.faWhatsapp} size="2x" />
            </button>

            {/* Popup Controlado pelo Pai */}
            <Popup
                open={open}
                onClose={() => onToggle(false)}
            >
                <QRCodePopupContent 
                    url={whatsappUrl} 
                    phone={phone} 
                    onClose={() => onToggle(false)} 
                />
            </Popup>
        </>
    );
}