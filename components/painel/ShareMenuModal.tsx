"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { faCopy, faQrcode } from "@fortawesome/free-solid-svg-icons";

interface ShareMenuModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurantId: string;
    restaurantSlug?: string; // Idealmente usar um slug legível, senão usa o ID
}

export default function ShareMenuModal({ isOpen, onClose, restaurantId, restaurantSlug }: ShareMenuModalProps) {
    const [copied, setCopied] = useState(false);

    // Define a URL pública do cardápio
    // Se tiver slug, usa slug, senão usa o ID
    const identifier = restaurantSlug || restaurantId;
    const menuUrl = `${window.location.origin}/${identifier}`; // Ex: https://imenu.com/hamburgueria-do-joao

    const handleCopy = () => {
        navigator.clipboard.writeText(menuUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // API simples para gerar QR Code visualmente sem instalar libs pesadas
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}`;

    return (
        <Modal open={isOpen} onClose={onClose} className="max-w-sm">
            <div className="p-6 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-4">
                    <FontAwesomeIcon icon={faQrcode} className="text-xl" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">Compartilhar Cardápio</h3>
                <p className="text-gray-500 text-sm mb-6">
                    Envie este link para seus clientes ou peça para eles escanearem o código.
                </p>

                {/* QR Code */}
                <div className="bg-white p-2 border border-gray-200 rounded-lg mb-6 shadow-sm">
                    <img src={qrCodeUrl} alt="QR Code do Cardápio" width={180} height={180} />
                </div>

                {/* Link e Copy */}
                <div className="w-full flex gap-2 mb-4">
                    <Input 
                        readOnly 
                        value={menuUrl} 
                        className="text-xs text-gray-600 bg-gray-50"
                    />
                    <Button onClick={handleCopy} className="px-3" variant="secondary">
                        <FontAwesomeIcon icon={copied ? icons.faCheck : faCopy} />
                    </Button>
                </div>

                <Button onClick={onClose} className="w-full">Fechar</Button>
            </div>
        </Modal>
    );
}