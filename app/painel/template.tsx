"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import { getCreationStepPath } from "@/lib/restaurantCreation";
import Loader from "@/components/ui/Loader";

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

    return <>{children}</>;
}
