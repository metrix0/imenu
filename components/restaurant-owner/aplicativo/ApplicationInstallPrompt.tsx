"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBell } from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const DISMISSED_AT_KEY = "imenu:application-promo-dismissed-at:v1";
const DISMISS_FOR_MS = 30 * 24 * 60 * 60 * 1000;
const OPEN_DELAY_MS = 1200;

function isStandaloneMode() {
    return (
        window.matchMedia("(display-mode: standalone)").matches ||
        Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
    );
}

function wasRecentlyDismissed() {
    try {
        const dismissedAt = Number(window.localStorage.getItem(DISMISSED_AT_KEY));
        return (
            Number.isFinite(dismissedAt) &&
            dismissedAt > 0 &&
            Date.now() - dismissedAt < DISMISS_FOR_MS
        );
    } catch {
        return false;
    }
}

function rememberDismissal() {
    try {
        window.localStorage.setItem(DISMISSED_AT_KEY, String(Date.now()));
    } catch {
        // The popup can still be closed if storage is unavailable.
    }
}

export default function ApplicationInstallPrompt() {
    const pathname = usePathname();
    const router = useRouter();
    const [open, setOpen] = useState(false);

    useEffect(() => {
        if (
            pathname === "/painel/aplicativo" ||
            pathname?.startsWith("/painel/configuracoes/nova-senha")
        ) {
            setOpen(false);
            return;
        }

        const mediaQuery = window.matchMedia(MOBILE_MEDIA_QUERY);
        if (
            !mediaQuery.matches ||
            isStandaloneMode() ||
            wasRecentlyDismissed()
        ) {
            setOpen(false);
            return;
        }

        let active = true;
        let timer = 0;

        void supabase.auth.getSession().then(({ data }) => {
            if (!active || !data.session) return;
            timer = window.setTimeout(() => {
                if (
                    active &&
                    mediaQuery.matches &&
                    !isStandaloneMode() &&
                    !wasRecentlyDismissed()
                ) {
                    setOpen(true);
                }
            }, OPEN_DELAY_MS);
        });

        const handleInstalled = () => {
            rememberDismissal();
            setOpen(false);
        };
        const handleViewportChange = () => {
            if (!mediaQuery.matches || isStandaloneMode()) setOpen(false);
        };

        window.addEventListener("appinstalled", handleInstalled);
        mediaQuery.addEventListener("change", handleViewportChange);

        return () => {
            active = false;
            if (timer) window.clearTimeout(timer);
            window.removeEventListener("appinstalled", handleInstalled);
            mediaQuery.removeEventListener("change", handleViewportChange);
        };
    }, [pathname]);

    const close = () => {
        rememberDismissal();
        setOpen(false);
    };

    return (
        <Modal
            open={open}
            onClose={close}
            showCloseButton
            className="max-w-sm"
        >
            <div className="p-6 pt-10 text-center">
                <video
                    src="/images/CellphoneVideo.webm"
                    autoPlay
                    loop
                    muted
                    playsInline
                    aria-hidden="true"
                    className="mx-auto h-[26dvh] max-h-56 w-full object-contain"
                />
                <h2 className="mt-4 text-2xl font-bold text-gray-900">
                    Tenha o app do iMenu!
                </h2>
                <p className="mt-3 text-sm leading-6 text-gray-600">
                    Acesse seu painel direto da tela inicial do celular.
                </p>
                <div className="mt-4 inline-flex items-center justify-center gap-2 rounded-full bg-brand/10 px-4 py-2 text-sm font-semibold text-brand">
                    <FontAwesomeIcon
                        icon={faBell}
                        className="shrink-0"
                        aria-hidden="true"
                    />
                    <span>Notificações de novos pedidos</span>
                </div>
                <Button
                    type="button"
                    className="mt-6 w-full"
                    onClick={() => {
                        close();
                        router.push("/painel/aplicativo");
                    }}
                >
                    Ir para Aplicativo
                </Button>
            </div>
        </Modal>
    );
}
