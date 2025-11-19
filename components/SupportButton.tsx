// components/SupportButton.tsx
"use client";

import { useState } from "react";
import Popup from "./ui/Popup"; // Import the Popup component
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// This is the content that will be passed as `children` to the Popup
const QRCodePopupContent = ({ url, phone }: { url: string; phone: string }) => (
    <>
        <h3 className="mb-4 text-lg font-semibold text-gray-800">Suporte via WhatsApp</h3>
        <div className="rounded-md border border-gray-200 p-4 inline-block">
            {/* Using the external API as decided before */}
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
    </>
);

export default function SupportButton() {
    // This component now manages its own state, ignoring popupStore.ts
    const [isPopupOpen, setIsPopupOpen] = useState(false);

    const phone = "5519997235394"; // Example phone
    const message = "Olá! Preciso de ajuda com um problema!";
    const whatsappUrl = `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;

    const handleClick = () => {
        const isMobileDevice = /Mobi|Android|iPhone|iPad|iPod/i.test(
            navigator.userAgent
        );

        if (isMobileDevice) {
            // On mobile, just redirect
            window.open(whatsappUrl, "_blank");
        } else {
            // On desktop, open the local popup
            setIsPopupOpen(true);
        }
    };

    return (
        <>
            {/* 1. The floating button */}
            <button
                onClick={handleClick}
                className="fixed cursor-pointer bottom-6 right-6 z-50 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform duration-300 ease-in-out hover:scale-110 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                aria-label="Suporte via WhatsApp"
            >
                <FontAwesomeIcon icon={icons.faWhatsapp} size="2x" />
            </button>

            {/* 2. The Popup component, controlled by this component's local state */}
            <Popup
                open={isPopupOpen}
                onClose={() => setIsPopupOpen(false)}
            >
                <QRCodePopupContent url={whatsappUrl} phone={phone} />
            </Popup>
        </>
    );
}