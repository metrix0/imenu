"use client";

import { useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";

import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";

const STORAGE_PREFIX = "imenu-whatsapp-redirect:";
const MESSAGE_TYPE = "IMENU_WHATSAPP_REDIRECT";
const CLOSE_SIGNAL = "__close__";

function getStoreWhatsappFromUrl(value: string) {
    try {
        const url = new URL(value);
        if (url.protocol !== "https:" || url.hostname !== "wa.me") return null;

        const rawDigits = url.pathname.replace(/\D/g, "");
        const localDigits =
            rawDigits.startsWith("55") &&
            (rawDigits.length === 12 || rawDigits.length === 13)
                ? rawDigits.slice(2)
                : rawDigits;

        if (localDigits.length !== 10 && localDigits.length !== 11) return null;

        const formatted =
            localDigits.length === 11
                ? `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 7)}-${localDigits.slice(7)}`
                : `(${localDigits.slice(0, 2)}) ${localDigits.slice(2, 6)}-${localDigits.slice(6)}`;

        return {
            href: `https://wa.me/55${localDigits}`,
            formatted,
        };
    } catch {
        return null;
    }
}

export default function WhatsappRedirectPage() {
    const [whatsappOpened, setWhatsappOpened] = useState(false);
    const [showTrackingButton, setShowTrackingButton] = useState(false);
    const [storeWhatsapp, setStoreWhatsapp] = useState<{
        href: string;
        formatted: string;
    } | null>(null);

    useEffect(() => {
        const trackingButtonTimer = window.setTimeout(() => {
            setShowTrackingButton(true);
        }, 2000);

        const key = new URLSearchParams(window.location.search).get("key");
        if (!key) {
            return () => window.clearTimeout(trackingButtonTimer);
        }

        const storageKey = `${STORAGE_PREFIX}${key}`;

        const handleValue = (value: unknown) => {
            if (typeof value !== "string") return;

            if (value === CLOSE_SIGNAL) {
                try {
                    localStorage.removeItem(storageKey);
                } catch {}
                window.close();
                return;
            }

            if (!value.startsWith("https://wa.me/")) return;

            setStoreWhatsapp(getStoreWhatsappFromUrl(value));
            setWhatsappOpened(true);

            try {
                localStorage.removeItem(storageKey);
            } catch {}
            window.location.replace(value);
        };

        const checkStorage = () => {
            try {
                handleValue(localStorage.getItem(storageKey));
            } catch {}
        };

        const handleStorage = (event: StorageEvent) => {
            if (event.key === storageKey) handleValue(event.newValue);
        };

        const handleMessage = (event: MessageEvent) => {
            if (event.origin !== window.location.origin) return;

            const data = event.data;
            if (
                !data ||
                data.type !== MESSAGE_TYPE ||
                data.key !== key
            ) {
                return;
            }

            handleValue(data.value);
        };

        checkStorage();
        window.addEventListener("storage", handleStorage);
        window.addEventListener("message", handleMessage);
        const interval = window.setInterval(checkStorage, 250);

        return () => {
            window.clearTimeout(trackingButtonTimer);
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("message", handleMessage);
            window.clearInterval(interval);
        };
    }, []);

    const returnToOrder = () => {
        try {
            if (window.opener && !window.opener.closed) {
                window.opener.focus();
            }
        } catch {}
        window.close();
    };

    return (
        <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
            <div className="flex w-full max-w-md flex-col items-center">
                {!whatsappOpened ? (
                    <>
                        <Loader className="border-t-brand" />
                        <h1 className="mt-5 text-lg font-semibold text-gray-900">
                            Abrindo WhatsApp...
                        </h1>
                        <p className="mt-2 text-sm text-gray-500">
                            Aguarde um instante.
                        </p>
                    </>
                ) : (
                    <>
                        <h1 className="text-lg font-semibold text-gray-900">
                            WhatsApp aberto
                        </h1>
                        <p className="mt-2 text-sm text-gray-500">
                            Envie a mensagem para confirmar seu pedido.
                        </p>
                    </>
                )}

                {showTrackingButton && (
                    <Button
                        type="button"
                        variant="primary"
                        onClick={returnToOrder}
                        className="mt-6 w-full !min-h-10 !rounded-lg !border !border-[#d93d00] !bg-[#d93d00] !px-[14px] !py-[9px] !text-[13px] !leading-5 !font-medium !text-white !shadow-none hover:!border-[#c43700] hover:!bg-[#c43700] focus:!ring-[#d93d00]"
                    >
                        Clique aqui para acompanhar seu pedido
                    </Button>
                )}

                {storeWhatsapp && (
                    <a
                        href={storeWhatsapp.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir WhatsApp da loja no número ${storeWhatsapp.formatted}`}
                        className="mt-8 inline-flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-4 pr-4 text-sm font-medium text-gray-700 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700"
                    >
                        <FontAwesomeIcon
                            icon={faWhatsapp}
                            className="text-lg text-green-600"
                        />
                        <span>{storeWhatsapp.formatted}</span>
                    </a>
                )}
            </div>
        </main>
    );
}
