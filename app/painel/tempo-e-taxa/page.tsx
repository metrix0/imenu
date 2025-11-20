"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import DeliveryRules from "@/components/restaurante/configuracoes/TempoeTaxa";

export default function PainelTempoETaxaPage() {
    const [restaurantId, setRestaurantId] = useState<string | null>(null);

    useEffect(() => {
        const load = async () => {
            console.log("➡️ Painel load() starting…");

            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            console.log("📌 session =", session);
            console.log("📌 sessionError =", sessionError);

            if (!session?.user) {
                console.log("❌ No logged user");
                return;
            }

            const user = session.user;

            const { data: restaurant, error: restError } = await supabase
                .from("restaurants")
                .select("id, user_id, delivery_fee_json")
                .eq("user_id", user.id)
                .single();

            console.log("🏪 restaurant =", restaurant);
            console.log("🔴 restError =", restError);

            if (!restaurant) {
                console.log("❌ User has no restaurant in painel");
                return;
            }

            setRestaurantId(restaurant.id);

            console.log("✅ PAINEL restaurantId =", restaurant.id);
        };

        load();
    }, []);

    if (!restaurantId) {
        return <div>Carregando configurações...</div>;
    }

    return (
        <div className="max-w-3xl mx-auto py-10 px-6">
            <h1 className="text-2xl font-bold mb-6">Configurações de Entrega</h1>

            <DeliveryRules
                restaurantId={restaurantId}
                isNew={false}
            />
        </div>
    );
}