"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { faClock } from "@fortawesome/free-solid-svg-icons";

import {
    AUTO_POPUP_PRIORITY,
    useAutoPopup,
} from "@/components/common/AutoPopupProvider";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const QrCodeMesaCheckoutModal = dynamic(
    () =>
        import(
            "@/components/restaurant-owner/mesas/QrCodeMesaCheckoutModal"
        ),
    { ssr: false }
);

type ExpiringAddonNotice = {
    addonId: string;
    productKey: string;
    productName: string;
    expiresAt: string;
};

type ExpiringAddonPayload = {
    notices?: ExpiringAddonNotice[];
    error?: string;
};

function saoPauloDateKey(): string {
    const parts = new Intl.DateTimeFormat("en", {
        timeZone: "America/Sao_Paulo",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(new Date());
    const value = (type: Intl.DateTimeFormatPartTypes) =>
        parts.find((part) => part.type === type)?.value || "";
    return `${value("year")}-${value("month")}-${value("day")}`;
}

export default function AddonExpiryPopup() {
    const router = useRouter();
    const restaurantId = useCreationStore((state) => state.restaurantId);
    const [notices, setNotices] = useState<ExpiringAddonNotice[]>([]);
    const [eligible, setEligible] = useState(false);
    const [renewalOpen, setRenewalOpen] = useState(false);
    const [renewalMounted, setRenewalMounted] = useState(false);
    const markedShownRef = useRef(false);
    const dateKey = useMemo(() => saoPauloDateKey(), []);

    useEffect(() => {
        if (!restaurantId) return;

        let active = true;
        const cacheKey = `imenu:addon-expiry-check:${restaurantId}:${dateKey}`;
        const shownKey = `imenu:addon-expiry-shown:${restaurantId}:${dateKey}`;

        const useNotices = (items: ExpiringAddonNotice[]) => {
            if (!active) return;
            setNotices(items);

            let alreadyShown = false;
            try {
                alreadyShown = window.localStorage.getItem(shownKey) === "true";
            } catch {
                // Show normally when storage is unavailable.
            }
            setEligible(items.length > 0 && !alreadyShown);
        };

        try {
            const cached = window.localStorage.getItem(cacheKey);
            if (cached !== null) {
                const parsed = JSON.parse(cached) as ExpiringAddonNotice[];
                useNotices(Array.isArray(parsed) ? parsed : []);
                return () => {
                    active = false;
                };
            }
        } catch {
            // Fall through to the authenticated check.
        }

        void (async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token || !active) return;

            const response = await fetch(
                `/api/addons/expiring?restaurantId=${encodeURIComponent(
                    restaurantId
                )}`,
                {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    cache: "no-store",
                }
            );
            if (!response.ok || !active) return;

            const payload = (await response.json()) as ExpiringAddonPayload;
            const items = Array.isArray(payload.notices) ? payload.notices : [];

            try {
                window.localStorage.setItem(cacheKey, JSON.stringify(items));
            } catch {
                // The notice still works without the daily browser cache.
            }
            useNotices(items);
        })();

        return () => {
            active = false;
        };
    }, [dateKey, restaurantId]);

    const popup = useAutoPopup({
        id: `addon-expiry:${restaurantId || "unknown"}:${dateKey}`,
        priority: AUTO_POPUP_PRIORITY.addonExpiry,
        enabled: eligible && notices.length > 0,
    });

    useEffect(() => {
        if (!popup.open || !restaurantId || markedShownRef.current) return;
        markedShownRef.current = true;
        try {
            window.localStorage.setItem(
                `imenu:addon-expiry-shown:${restaurantId}:${dateKey}`,
                "true"
            );
        } catch {
            // Current display still counts even without persistence.
        }
    }, [dateKey, popup.open, restaurantId]);

    const close = () => {
        popup.dismiss();
        setEligible(false);
    };

    const single = notices.length === 1;
    const directQrRenewal =
        single && notices[0]?.productKey === "qr_code_mesa";

    const renew = () => {
        close();

        if (directQrRenewal) {
            setRenewalMounted(true);
            setRenewalOpen(true);
            return;
        }

        router.push("/painel/configuracoes");
    };

    return (
        <>
            {renewalMounted && restaurantId && (
                <QrCodeMesaCheckoutModal
                    open={renewalOpen}
                    onClose={() => setRenewalOpen(false)}
                    restaurantId={restaurantId}
                    source="settings"
                    renewal
                    onPaid={() => setRenewalOpen(false)}
                />
            )}
            <Modal
            height={single ? 330 : 390}
            open={popup.open}
            onClose={close}
            className="max-w-md"
            showCloseButton
        >
            <div className="p-6 text-center sm:p-7">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-700">
                    <FontAwesomeIcon icon={faClock} className="text-[28px]" />
                </div>
                <h2 className="mt-4 !pr-0 text-xl font-bold text-gray-900">
                    {single
                        ? `Seu ${notices[0]?.productName} vence hoje`
                        : `${notices.length} adicionais vencem hoje`}
                </h2>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                    O acesso pago via Pix termina hoje. Renove para continuar
                    usando os recursos sem interrupções.
                </p>

                {!single && (
                    <div className="mt-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-left">
                        {notices.map((notice) => (
                            <div
                                key={notice.addonId}
                                className="text-sm font-medium text-gray-800"
                            >
                                {notice.productName}
                            </div>
                        ))}
                    </div>
                )}

                <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                    <Button type="button" variant="secondary" onClick={close}>
                        Agora não
                    </Button>
                    <Button type="button" onClick={renew}>
                        {directQrRenewal ? "Renovar agora" : "Gerenciar pagamentos"}
                    </Button>
                </div>
            </div>
            </Modal>
        </>
    );
}
