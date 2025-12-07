"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import DeliveryRules from "@/components/restaurant-owner/configuracoes/TempoeTaxa";
import Loader from "@/components/ui/Loader";

export default function PainelTempoETaxaPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(!restaurantId);

    useEffect(() => {
        const load = async () => {
            // Se já temos ID no Zustand, não precisa buscar
            if (restaurantId) {
                setIsLoading(false);
                return;
            }

            console.log("➡️ Painel Tempo e Taxa: Buscando restaurante...");
            const { data: { session } } = await supabase.auth.getSession();

            if (!session?.user) {
                console.log("❌ Sem usuário logado");
                setIsLoading(false);
                return;
            }

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) {
                console.log("✅ Restaurante encontrado:", restaurant.id);
                setRestaurantId(restaurant.id);
            } else {
                console.log("❌ Restaurante não encontrado.");
            }
            setIsLoading(false);
        };

        load();
    }, [restaurantId, setRestaurantId]);

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><Loader /></div>;
    }

    if (!restaurantId) {
        return <div className="p-8 text-center text-gray-500">Restaurante não encontrado.</div>;
    }

    return (
        <div className="max-w-6xl mx-auto pb-20 px-4 sm:px-6 pt-8">
            <div className="mb-8 flex flex-col gap-1">
                <h1 className="text-3xl font-bold text-gray-900">Configurações de Entrega</h1>
                <p className="text-gray-500 mt-1">Defina suas faixas de entrega e o valor mínimo de pedido.</p>
            </div>
            
            <DeliveryRules
                restaurantId={restaurantId}
                isNew={false} // Modo Edição (Autosave ativado)
            />
        </div>
    );
}