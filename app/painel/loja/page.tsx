"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import Loader from "@/components/ui/Loader";
import SaveStatus, { type SaveState } from "@/components/ui/SaveStatus";
import StoreProfileManager from "@/components/restaurant-owner/loja/StoreProfileManager";
import PreparationTimeCard from "@/components/restaurant-owner/loja/PreparationTimeCard";
import AllowedPaymentMethods, {
    DEFAULT_ALLOWED_PAYMENT_METHODS,
} from "@/components/restaurant-owner/configuracoes/AllowedPaymentMethods";

export default function LojaPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const [restaurant, setRestaurant] = useState<any>(null);
    const [profileStatus, setProfileStatus] = useState<SaveState>("saved");
    const [preparationStatus, setPreparationStatus] = useState<SaveState>("saved");
    const [paymentStatus, setPaymentStatus] = useState<SaveState>("saved");
    const statuses = [profileStatus, preparationStatus, paymentStatus];
    const saveStatus = statuses.includes("error") ? "error" : statuses.includes("saving") ? "saving" : statuses.includes("idle") ? "idle" : "saved";
    const [allowedPaymentMethods, setAllowedPaymentMethods] = useState<string[]>(
        DEFAULT_ALLOWED_PAYMENT_METHODS
    );

    useEffect(() => {
        if (!restaurant) return;
        setAllowedPaymentMethods(
            Array.isArray(restaurant.allowed_payment_methods) &&
                restaurant.allowed_payment_methods.length > 0
                ? restaurant.allowed_payment_methods
                : DEFAULT_ALLOWED_PAYMENT_METHODS
        );
    }, [restaurant]);

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

    const handleAllowedPaymentMethodsChange = async (methods: string[]) => {
        if (!restaurant?.id) return;
        setAllowedPaymentMethods(methods);
        setPaymentStatus("saving");
        try {
            const response = await fetch(`/api/restaurants/${restaurant.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ allowed_payment_methods: methods }),
            });
            setPaymentStatus(response.ok ? "saved" : "error");
        } catch {
            setPaymentStatus("error");
        }
    };

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
        <div className="mx-auto w-full max-w-6xl space-y-8 px-4 pb-20 pt-8 sm:px-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h1>Perfil da Loja</h1>
                    <p className="mt-1 text-sm text-gray-500">Como seu restaurante aparece para os clientes.</p>
                </div>
                <SaveStatus status={saveStatus} className="self-start sm:self-auto" />
            </div>
            <StoreProfileManager restaurant={restaurant} onSaveStatusChange={setProfileStatus} />

            <AllowedPaymentMethods
                value={allowedPaymentMethods}
                onChange={handleAllowedPaymentMethodsChange}
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
