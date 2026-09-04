"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

import ApplicationPanelContent from "./ApplicationPanelContent";
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
            className="max-w-3xl"
        >
            <div className="p-5 pb-7 pt-4 sm:p-6">
                <ApplicationPanelContent />
            </div>
        </Modal>
    );
}
