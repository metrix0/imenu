"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { getCreationStepPath } from "@/lib/restaurantCreation";
import Loader from "@/components/ui/Loader";
import WhatsAppConnectionPopup from "@/components/restaurant-owner/WhatsAppConnectionPopup";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const DEV_RESTAURANT_STORAGE_KEY = "imenu-dev-current-restaurant";

type DevRestaurantSelection = {
    id: string;
    urlSlug: string | null;
};

function getDevRestaurantSelection(): DevRestaurantSelection | null {
    try {
        const raw = window.localStorage.getItem(DEV_RESTAURANT_STORAGE_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as {
            id?: unknown;
            urlSlug?: unknown;
        };
        const id = typeof parsed.id === "string" ? parsed.id.trim() : "";

        if (!id) return null;

        return {
            id,
            urlSlug:
                typeof parsed.urlSlug === "string" && parsed.urlSlug.trim()
                    ? parsed.urlSlug.trim()
                    : null,
        };
    } catch {
        return null;
    }
}

export default function PanelTemplate({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const { setRestaurantId, setEmail, setRestaurantSlug } = useCreationStore();
    const [ready, setReady] = useState(false);

    useEffect(() => {
        const checkCreation = async () => {
            const isRecoveryCallback =
                pathname === "/painel/configuracoes/nova-senha" &&
                (new URLSearchParams(window.location.search).has("code") ||
                    window.location.hash.includes("type=recovery"));

            if (isRecoveryCallback) {
                setReady(true);
                return;
            }

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.user) {
                router.replace("/restaurante/login");
                return;
            }

            const isAllowedDev =
                session.user.email?.trim().toLowerCase() === ALLOWED_DEV_EMAIL;
            const devRestaurant = isAllowedDev
                ? getDevRestaurantSelection()
                : null;

            if (devRestaurant) {
                setRestaurantId(devRestaurant.id);
                setEmail(session.user.email || "");
                setRestaurantSlug(devRestaurant.urlSlug);
                setReady(true);
                return;
            }

            const cacheKey = `imenu-creation-complete:${session.user.id}`;
            if (sessionStorage.getItem(cacheKey) === "true") {
                setReady(true);
                return;
            }

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id, url_slug, first_time, creation_step")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (!restaurant) {
                router.replace("/restaurante/registrar");
                return;
            }

            setRestaurantId(restaurant.id);
            setEmail(session.user.email || "");
            setRestaurantSlug(restaurant.url_slug);

            if (restaurant.first_time !== false) {
                router.replace(getCreationStepPath(restaurant.creation_step));
                return;
            }

            sessionStorage.setItem(cacheKey, "true");
            setReady(true);
        };

        void checkCreation();
    }, [pathname, router, setEmail, setRestaurantId, setRestaurantSlug]);

    if (!ready) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    return (
        <>
            {children}
            <WhatsAppConnectionPopup />
        </>
    );
}
