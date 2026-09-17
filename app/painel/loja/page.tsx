"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Loader from "@/components/ui/Loader";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";
import StoreSettings from "@/components/restaurant-owner/loja/StoreSettings";
import PreparationTimeCard from "@/components/restaurant-owner/loja/PreparationTimeCard";

export default function LojaPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const [restaurant, setRestaurant] = useState<any>(null);
    const [storeStatus, setStoreStatus] = useState<SaveState>("saved");
    const [preparationStatus, setPreparationStatus] = useState<SaveState>("saved");
    const statuses = [storeStatus, preparationStatus];
    const saveStatus = statuses.includes("error")
        ? "error"
        : statuses.includes("saving")
          ? "saving"
          : statuses.includes("idle")
            ? "idle"
            : "saved";

    useEffect(() => {
        const load = async () => {
            let targetId = restaurantId;

            if (!targetId) {
                const {
                    data: { session },
                } = await supabase.auth.getSession();
                if (!session) {
                    setIsLoading(false);
                    return;
                }

                const { data: rest } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();
                if (!rest) {
                    setIsLoading(false);
                    return;
                }
                targetId = rest.id;
                setRestaurantId(rest.id);
            }

            const { data, error } = await supabase
                .from("restaurants")
                .select(
                    "id, name, description, logo_url, banner_url, payment_method, payment_info, payment_info_type, allowed_payment_methods, url_slug, custom_domain, store_whatsapp, prep_time_min_minutes, prep_time_max_minutes"
                )
                .eq("id", targetId)
                .single();

            if (!error && data) setRestaurant(data);
            setIsLoading(false);
        };

        void load();
    }, [restaurantId, setRestaurantId]);

    if (isLoading) {
        return (
            <div className="flex justify-center p-10">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    if (!restaurant) {
        return (
            <div className="p-10 text-center text-red-500">
                Restaurante não encontrado.
            </div>
        );
    }

    return (
        <div
            className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-20 pt-8 sm:px-6"
            onTouchStart={(event) => {
                if (window.matchMedia("(max-width: 767px)").matches) event.stopPropagation();
            }}
            onTouchEnd={(event) => {
                if (window.matchMedia("(max-width: 767px)").matches) event.stopPropagation();
            }}
        >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1>Perfil da Loja</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Como seu restaurante aparece para os clientes.
                    </p>
                </div>
                <SaveStatus
                    status={saveStatus}
                    className="self-start sm:self-auto"
                />
            </div>

            <StoreSettings
                restaurant={restaurant}
                onSaveStatusChange={setStoreStatus}
            />

            <PreparationTimeCard
                restaurantId={restaurant.id}
                initialMin={restaurant.prep_time_min_minutes}
                initialMax={restaurant.prep_time_max_minutes}
                onSaveStatusChange={setPreparationStatus}
            />
        </div>
    );
}
