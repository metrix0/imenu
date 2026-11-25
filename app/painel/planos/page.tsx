"use client";

import { useEffect, useState } from "react";

import QrCodeMesaSettingsSection from "@/components/restaurant-owner/configuracoes/QrCodeMesaSettingsSection";
import { PageLoader } from "@/components/ui/Loader";
import { PageHeader } from "@/components/ui/SaveStatus";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";
import "./planos.css";

export default function PlanosPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [loading, setLoading] = useState(!restaurantId);
    const [coupon, setCoupon] = useState<string | undefined>();

    useEffect(() => {
        setCoupon(new URLSearchParams(window.location.search).get("cupom") || undefined);
    }, []);

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
                <PageHeader className="panel-page-heading" title="Planos iMenu" description="Escolha os sistemas que fazem sentido para o seu restaurante." />

                {loading ? (
                    <PageLoader />
                ) : restaurantId ? (
                    <QrCodeMesaSettingsSection restaurantId={restaurantId} showHeader={false} presentation="plans" coupon={coupon} />
                ) : null}
            </div>
        </div>
    );
}
