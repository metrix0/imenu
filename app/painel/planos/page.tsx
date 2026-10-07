"use client";

import { useEffect, useState } from "react";

import QrCodeMesaSettingsSection from "@/components/restaurant-owner/configuracoes/QrCodeMesaSettingsSection";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import "./planos.css";

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
        <div className="plans-page min-h-screen pb-20">
            <div className="plans-content mx-auto max-w-6xl">
                <header className="plans-heading panel-page-heading">
                    <p className="plans-eyebrow">FEITO PARA O SEU RESTAURANTE</p>
                    <h1 className="text-3xl font-bold text-gray-900">
                        Planos iMenu
                    </h1>
                    <p className="mt-2 text-gray-500">
                        Escolha os sistemas que fazem sentido para o seu restaurante.
                    </p>
                </header>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader />
                    </div>
                ) : restaurantId ? (
                    <QrCodeMesaSettingsSection restaurantId={restaurantId} showHeader={false} presentation="plans" />
                ) : null}
            </div>
        </div>
    );
}
