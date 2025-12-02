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
        <div className="max-w-6xl mx-auto pb-20">
            <div className="mb-8 flex flex-col  gap-1 px-2">
                <h1 className="text-3xl font-bold text-gray-900">Configurações de Entrega</h1>
                <p className="text-gray-500 mb-8 mt-1">Defina suas configurações de entrega e o Pedido Mínimo.</p>
            </div>
            <DeliveryRules
                restaurantId={restaurantId}
                isNew={false}
            />
        </div>
    );
}