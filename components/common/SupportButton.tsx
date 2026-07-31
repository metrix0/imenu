"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import { icons } from "@/lib/utils/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faCopy, faCheck, faXmark } from "@fortawesome/free-solid-svg-icons";

const PHONE = "5519988760900";
const DISPLAY_PHONE = "+55 19 98876-0900";
const MESSAGE = "Olá, preciso de ajuda com o iMenu!";

export interface SupportButtonRef { open: () => void; }
type SupportButtonProps = { bottomClassName?: string };

const SupportButton = forwardRef<SupportButtonRef, SupportButtonProps>(
    ({ bottomClassName = "bottom-6" }, ref) => {
        const [open, setOpen] = useState(false);
        const [copied, setCopied] = useState(false);
        const whatsappUrl = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;

        const openSupport = () => {
            const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (mobile) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
            else setOpen(true);
        };

        const copyPhone = async () => {
            await navigator.clipboard.writeText(DISPLAY_PHONE);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        };

        useImperativeHandle(ref, () => ({ open: openSupport }));

        return (
            <>
                <button
                    type="button"
                    onClick={openSupport}
                    className={`fixed right-6 z-40 flex h-16 w-16 cursor-pointer items-center justify-center rounded-full bg-green-500 text-white shadow-lg transition-transform duration-300 hover:scale-110 hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2 ${bottomClassName}`}
                    aria-label="Suporte via WhatsApp"
                >
                    <FontAwesomeIcon icon={icons.faWhatsapp} size="2x" />
                </button>

                <Modal open={open} onClose={() => setOpen(false)} className="max-w-sm">
                    <div className="relative p-6 text-center">
                        <button type="button" onClick={() => setOpen(false)} className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700" aria-label="Fechar">
                            <FontAwesomeIcon icon={faXmark} />
                        </button>
                        <h3 className="mb-5 text-lg font-semibold text-gray-800">Escaneie o QR Code</h3>
                        <div className="inline-block rounded-lg border border-gray-200 p-4">
                            <img src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(whatsappUrl)}&format=svg`} alt="QR Code para WhatsApp" width={180} height={180} />
                        </div>
                        <p className="mt-5 text-sm text-gray-600">Ou adicione no WhatsApp:</p>
                        <button type="button" onClick={copyPhone} className="mx-auto mt-2 flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 font-medium text-gray-900 transition-colors hover:bg-gray-100">
                            {DISPLAY_PHONE}
                            <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={copied ? "text-green-600" : "text-gray-500"} />
                        </button>
                        <Button onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")} className="mt-5 w-full">
                            <FontAwesomeIcon icon={icons.faWhatsapp} className="mr-2" /> Abrir WhatsApp
                        </Button>
                    </div>
                </Modal>
            </>
        );
    }
);
SupportButton.displayName = "SupportButton";
export default SupportButton;
