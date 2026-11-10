"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { faTrophy } from "@fortawesome/free-solid-svg-icons";

import { AUTO_POPUP_PRIORITY, useAutoPopup } from "@/components/common/AutoPopupProvider";
import { ORDER_REALTIME_EVENT } from "@/components/restaurant-owner/OrderSoundProvider";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";
import { hasQrTableAccess } from "@/lib/qr-table/types";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

const MIN_COMPLETED_ORDERS = 15;
const MAX_COMPLETED_ORDERS = 20;

export function isPlusOrderMilestoneEligible(completedOrders: number | null, hasPlus: boolean): boolean {
    return completedOrders !== null &&
        completedOrders >= MIN_COMPLETED_ORDERS &&
        completedOrders <= MAX_COMPLETED_ORDERS &&
        !hasPlus;
}

export default function OrderMilestonePlusPopup() {
    const router = useRouter();
    const restaurantId = useCreationStore(state => state.restaurantId);
    const [eligible, setEligible] = useState<{ restaurantId: string; orders: number } | null>(null);
    const shownRef = useRef<string | null>(null);

    useEffect(() => {
        setEligible(null);
        if (!restaurantId) return;

        let active = true;
        let checking = false;
        const shownKey = `imenu:plus-order-milestone-shown:v1:${restaurantId}`;

        const check = async () => {
            if (!active || checking || shownRef.current === restaurantId) return;
            checking = true;
            try {
                try {
                    if (window.localStorage.getItem(shownKey) === "true") {
                        setEligible(null);
                        return;
                    }
                } catch {
                    // The popup can still run without browser storage.
                }

                const [orders, plus] = await Promise.all([
                    supabase.from("orders").select("id", { count: "exact", head: true })
                        .eq("restaurant_id", restaurantId).eq("status", "done"),
                    supabase.from("restaurant_addons").select("status,current_period_ends_at")
                        .eq("restaurant_id", restaurantId).eq("product_key", "ia_plus").maybeSingle(),
                ]);
                if (!active || orders.error || plus.error) return;

                const count = orders.count;
                setEligible(isPlusOrderMilestoneEligible(count, hasQrTableAccess(plus.data))
                    ? { restaurantId, orders: count! }
                    : null);
            } finally {
                checking = false;
            }
        };

        const onOrdersChanged = () => { void check(); };
        const onFocus = () => {
            if (document.visibilityState === "visible") void check();
        };
        const onStorage = (event: StorageEvent) => {
            if (event.key === shownKey && event.newValue === "true") setEligible(null);
        };

        void check();
        window.addEventListener(ORDER_REALTIME_EVENT, onOrdersChanged);
        window.addEventListener("focus", onFocus);
        window.addEventListener("storage", onStorage);
        return () => {
            active = false;
            window.removeEventListener(ORDER_REALTIME_EVENT, onOrdersChanged);
            window.removeEventListener("focus", onFocus);
            window.removeEventListener("storage", onStorage);
        };
    }, [restaurantId]);

    const popup = useAutoPopup({
        id: `plus-order-milestone:${restaurantId || "none"}`,
        priority: AUTO_POPUP_PRIORITY.promotion - 1,
        enabled: Boolean(restaurantId && eligible?.restaurantId === restaurantId),
    });

    useEffect(() => {
        if (!popup.open || !restaurantId || shownRef.current === restaurantId) return;
        shownRef.current = restaurantId;
        try {
            window.localStorage.setItem(`imenu:plus-order-milestone-shown:v1:${restaurantId}`, "true");
        } catch {
            // Still only show once during this mount.
        }
    }, [popup.open, restaurantId]);

    const close = () => {
        popup.dismiss();
        setEligible(null);
    };

    return (
        <Modal height={340} open={popup.open} onClose={close} showCloseButton className="max-w-md">
            <div className="p-6 text-center sm:p-7">
                <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-brand">
                    <FontAwesomeIcon icon={faTrophy} className="text-[28px]" aria-hidden="true" />
                </div>
                <h2 className="mt-4 text-xl font-bold text-gray-900">
                    Parabéns pelos seus {eligible?.orders ?? MIN_COMPLETED_ORDERS} pedidos!
                </h2>
                <p className="mt-2 text-sm font-medium leading-6 text-gray-800">
                    Que tal testar o iMenu Plus e impulsionar suas vendas?
                </p>
                <p className="mt-2 text-sm leading-6 text-gray-600">
                    Conheça as automações de marketing, o Assistente IA e o Vendas IA para encontrar novas oportunidades.
                </p>
                <Button
                    type="button"
                    className="mt-6 w-full"
                    onClick={() => {
                        close();
                        router.push("/painel/planos");
                    }}
                >
                    Conhecer iMenu Plus
                </Button>
            </div>
        </Modal>
    );
}
