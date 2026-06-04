"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import Loader from "@/components/ui/Loader";
import StoreProfileManager from "@/components/restaurant-owner/loja/StoreProfileManager";
import AllowedPaymentMethods, {
    DEFAULT_ALLOWED_PAYMENT_METHODS,
} from "@/components/restaurant-owner/configuracoes/AllowedPaymentMethods";

export default function LojaPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const [restaurant, setRestaurant] = useState<any>(null);
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

    const handleAllowedPaymentMethodsChange = async (methods: string[]) => {
        if (!restaurant?.id) return;

        setAllowedPaymentMethods(methods);

        await fetch(`/api/restaurants/${restaurant.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                allowed_payment_methods: methods,
            }),
        });
    };

    useEffect(() => {
        const load = async () => {
            // Lógica unificada de busca de ID
            let targetId = restaurantId;

            if (!targetId) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setIsLoading(false);
                    return;
                }
                const { data: rest } = await supabase
                    .from("restaurants")
                    .select("id")
                    .eq("user_id", session.user.id)
                    .single();
                
                if (rest) {
                    targetId = rest.id;
                    setRestaurantId(rest.id);
                } else {
                    setIsLoading(false);
                    return;
                }
            }

            // Busca dados detalhados para o form
            if (targetId) {
                const { data } = await supabase
                    .from("restaurants")
                    .select("id, name, description, logo_url, banner_url, payment_method, payment_info, allowed_payment_methods")
                    .eq("id", targetId)
                    .single();

                if (data) setRestaurant(data);
            }
            setIsLoading(false);
        };

        load();
    }, [restaurantId, setRestaurantId]);

    if (isLoading) return <div className="flex justify-center p-10"><Loader /></div>;
    
    if (!restaurant) return (
        <div className="p-10 text-center text-red-500">
            Restaurante não encontrado.
        </div>
    );

    return (
        <div>
            <StoreProfileManager restaurant={restaurant} />
            <div className={"w-full flex justify-center"}>
            <AllowedPaymentMethods
                value={allowedPaymentMethods}
                onChange={handleAllowedPaymentMethodsChange}
                className="mt-6 w-[90%]"
            />
            </div>
        </div>
    );

}
