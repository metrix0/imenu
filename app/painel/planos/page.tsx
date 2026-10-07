"use client";

import { useEffect, useState } from "react";

import QrCodeMesaSettingsSection from "@/components/restaurant-owner/configuracoes/QrCodeMesaSettingsSection";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

export default function PlanosPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [loading, setLoading] = useState(!restaurantId);

    useEffect(() => {
        if (restaurantId) {
            setLoading(false);
            return;
        }

        let canceled = false;

        const loadRestaurant = async () => {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.user) {
                if (!canceled) setLoading(false);
                return;
            }

            const { data } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .maybeSingle();

            if (canceled) return;

            if (data?.id) setRestaurantId(String(data.id));
            setLoading(false);
        };

        void loadRestaurant();

        return () => {
            canceled = true;
        };
    }, [restaurantId, setRestaurantId]);

    return (
        <div className="min-h-screen bg-gray-50 px-4 pb-20 pt-8 sm:px-6">
            <div className="mx-auto max-w-6xl space-y-8">
                <div className="panel-page-heading">
                    <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">
                        Sistemas iMenu
                    </h1>
                    <p className="mt-1 text-gray-500 2xl:text-lg">
                        Gerencie os produtos disponíveis na sua conta.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader />
                    </div>
                ) : restaurantId ? (
                    <QrCodeMesaSettingsSection restaurantId={restaurantId} showHeader={false} />
                ) : null}
            </div>
        </div>
    );
}
