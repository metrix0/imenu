"use client";

import { useEffect } from "react";
import Loader from "@/components/ui/Loader";

const STORAGE_PREFIX = "imenu-whatsapp-redirect:";
const MESSAGE_TYPE = "IMENU_WHATSAPP_REDIRECT";
const CLOSE_SIGNAL = "__close__";

export default function WhatsappRedirectPage() {
    useEffect(() => {
        const key = new URLSearchParams(window.location.search).get("key");
        if (!key) return;

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
            window.removeEventListener("storage", handleStorage);
            window.removeEventListener("message", handleMessage);
            window.clearInterval(interval);
        };
    }, []);

    return (
        <main className="flex min-h-screen items-center justify-center bg-white px-6 text-center">
            <div>
                <Loader className="mx-auto border-t-brand" />
                <h1 className="mt-5 text-lg font-semibold text-gray-900">
                    Abrindo WhatsApp...
                </h1>
                <p className="mt-2 text-sm text-gray-500">
                    Aguarde um instante.
                </p>
            </div>
        </main>
    );
}
