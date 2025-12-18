"use client";

import { useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { faQrcode } from "@fortawesome/free-solid-svg-icons"; // Importando ícone de QR Code

interface ShareMenuModalProps {
    isOpen: boolean;
    onClose: () => void;
    restaurantId: string;
    restaurantSlug?: string;
}

export default function ShareMenuModal({ isOpen, onClose, restaurantId, restaurantSlug }: ShareMenuModalProps) {
    const [copied, setCopied] = useState(false);
    const [showQr, setShowQr] = useState(false); // Estado para controlar a gaveta do QR Code

    const identifier = restaurantSlug || restaurantId;
    // Evita erro de 'window is not defined' no SSR
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    const menuUrl = `${origin}/${identifier}`;

    const handleCopy = () => {
        navigator.clipboard.writeText(menuUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // URL da API de QR Code
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(menuUrl)}&format=svg`;

    // Resetar estado ao fechar
    const handleClose = () => {
        setShowQr(false);
        onClose();
    };

    return (
        <Modal open={isOpen} onClose={handleClose} className="max-w-sm">
            <div className="p-6 text-center flex flex-col items-center">
                <div className="w-12 h-12 bg-brand/10 text-brand rounded-full flex items-center justify-center mb-4">
                    <FontAwesomeIcon icon={icons.faLink} className="text-xl" />
                </div>

                <h3 className="text-xl font-bold text-gray-900 mb-2">Compartilhar Cardápio</h3>
                <p className="text-gray-500 text-sm mb-6">
                    Envie este link para seus clientes ou peça para eles escanearem o código.
                </p>

                {/* Link e Copy */}
                <div className="w-full flex gap-2 mb-4">
                    <div className="flex-1">
                        <Input 
                            readOnly 
                            value={menuUrl} 
                            className="text-xs text-gray-600 bg-gray-50 text-center"
                        />
                    </div>
                    <Button onClick={handleCopy} className="px-3" variant="secondary" title="Copiar Link">
                        <FontAwesomeIcon icon={copied ? icons.faCheck : icons.faCopy} />
                    </Button>
                </div>

                {/* Botão Toggle QR Code */}
                <button 
                    onClick={() => setShowQr(!showQr)}
                    className="cursor-pointer text-brand text-sm font-medium mb-6 hover:underline flex items-center gap-2"
                >
                    <FontAwesomeIcon icon={faQrcode} />
                    {showQr ? "Ocultar QR Code" : "Gerar QR Code"}
                </button>

                {/* Gaveta do QR Code (Animação de altura/opacidade) */}
                <div 
                    className={`overflow-hidden transition-all duration-300 ease-in-out w-full flex justify-center ${
                        showQr ? "max-h-60 opacity-100 mb-6" : "max-h-0 opacity-0 mb-0"
                    }`}
                >
                    <div className="p-2 border border-gray-200 rounded-lg bg-white shadow-sm">
                        {/* Renderiza a imagem apenas se o modal estiver aberto para economizar request, ou sempre se preferir */}
                        <img 
                            src={qrCodeUrl} 
                            alt="QR Code do Cardápio" 
                            width={180} 
                            height={180}
                            className="block"
                        />
                    </div>
                </div>

                <Button onClick={handleClose} className="w-full" variant="secondary">
                    Fechar
                </Button>
            </div>
        </Modal>
    );
}