"use client";

import { forwardRef, useImperativeHandle, useState } from "react";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { icons } from "@/lib/utils/fontawesome";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faCopy, faCheck } from "@fortawesome/free-solid-svg-icons";

const PHONE = "5519988760900";
const DISPLAY_PHONE = "+55 19 98876-0900";
const MESSAGE = "Olá, preciso de ajuda com o iMenu!";
const SUPPORT_BUTTON_BASE =
    "!min-h-10 !rounded-lg !border !border-[#e2e5e9] !px-[14px] !py-[9px] !text-[13px] !leading-5 !font-medium !shadow-none 2xl:!rounded-lg 2xl:!px-[14px] 2xl:!py-[9px] 2xl:!text-[13px]";
const SUPPORT_PRIMARY_BUTTON = `${SUPPORT_BUTTON_BASE} !border-[#d93d00] !bg-[#d93d00] !text-white hover:!border-[#c43700] hover:!bg-[#c43700] focus:!ring-[#d93d00]`;
const SUPPORT_SECONDARY_BUTTON = `${SUPPORT_BUTTON_BASE} !bg-white !text-[#1d1d1d] hover:!bg-[#f1f3f5] focus:!ring-[#d93d00]`;

export interface SupportButtonRef { open: () => void; }
type SupportButtonProps = { bottomClassName?: string; showFloating?: boolean };

const SupportButton = forwardRef<SupportButtonRef, SupportButtonProps>(
    ({ bottomClassName = "bottom-6", showFloating = true }, ref) => {
        const [open, setOpen] = useState(false);
        const [copied, setCopied] = useState(false);
        const [qrLoaded, setQrLoaded] = useState(false);
        const whatsappUrl = `https://wa.me/${PHONE}?text=${encodeURIComponent(MESSAGE)}`;

        const openSupport = () => {
            const mobile = /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
            if (mobile) window.open(whatsappUrl, "_blank", "noopener,noreferrer");
            else {
                setQrLoaded(false);
                setOpen(true);
            }
        };

        const copyPhone = async () => {
            await navigator.clipboard.writeText(DISPLAY_PHONE);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        };

        useImperativeHandle(ref, () => ({ open: openSupport }));

        return (
            <>
                {showFloating && !open && <button
                    type="button"
                    onClick={openSupport}
                    className={`fixed right-6 z-[60] flex h-12 w-12 cursor-pointer items-center justify-center rounded-full bg-[#00A240] text-white shadow-md transition-[filter,box-shadow] duration-200 hover:brightness-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#00A240] focus-visible:ring-offset-2 ${bottomClassName}`}
                    aria-label="Suporte via WhatsApp"
                >
                    <FontAwesomeIcon icon={icons.faWhatsapp} className="!h-6 !w-6" />
                </button>}

                <Modal height={470} open={open} onClose={() => setOpen(false)} className="max-w-sm" showCloseButton>
                    <div className="relative p-6 text-center">
                        <h3 className="mb-4 text-lg font-semibold text-gray-900">Escaneie o QR Code</h3>
                        <div className="relative mx-auto flex h-[214px] w-[214px] items-center justify-center rounded-lg border border-gray-200 bg-white p-4" aria-busy={!qrLoaded}>
                            {!qrLoaded && <Loader className="absolute" />}
                            <img
                                src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(whatsappUrl)}&format=svg`}
                                alt="QR Code para WhatsApp"
                                width={180}
                                height={180}
                                onLoad={() => setQrLoaded(true)}
                                onError={() => setQrLoaded(true)}
                                className={`h-[180px] w-[180px] transition-opacity duration-150 ${qrLoaded ? "opacity-100" : "opacity-0"}`}
                            />
                        </div>
                        <p className="mt-4 text-sm text-gray-600">Ou adicione no WhatsApp:</p>
                        <Button variant="secondary" type="button" onClick={copyPhone} className={`mx-auto mt-2 ${SUPPORT_SECONDARY_BUTTON}`}>
                            {DISPLAY_PHONE}
                            <FontAwesomeIcon icon={copied ? faCheck : faCopy} className={`ml-2 ${copied ? "text-green-600" : "text-gray-500"}`} />
                        </Button>
                        <Button variant="primary" onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")} className={`mt-4 w-full ${SUPPORT_PRIMARY_BUTTON}`}>
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
