"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import { faSpinner } from "@fortawesome/free-solid-svg-icons";
import DeliveryRules from "@/components/restaurante/configuracoes/TempoeTaxa";
import Loader from "@/components/ui/Loader";

export default function PainelTempoETaxaPage() {
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    // Estado levantado para controlar o feedback visual na página
    const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved">("idle");

    useEffect(() => {
        const load = async () => {
            console.log("➡️ Painel load() starting…");

            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.user) return;

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) {
                setRestaurantId(restaurant.id);
            }
        };

        load();
    }, []);

    if (!restaurantId) {
        return (
            <div className="flex justify-center items-center h-64">
                <Loader />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-20">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Configurações de Entrega</h1>
                    <p className="text-gray-500 mt-1">Defina suas configurações de entrega e o Pedido Mínimo.</p>
                </div>
                
                {/* Indicador de Status MOVIDO para cá */}
                <div className="h-6 text-sm font-medium flex items-center">
                    {saveStatus === "saving" ? (
                        <span className="text-brand animate-pulse flex items-center gap-2">
                            <FontAwesomeIcon icon={faSpinner} className="fa-spin" /> Salvando...
                        </span>
                    ) : saveStatus === "saved" ? (
                        <span className="text-green-600 flex items-center gap-1 ">
                            <FontAwesomeIcon icon={icons.faCheck} className="text-xs" /> Tudo salvo
                        </span>
                    ) : null}
                </div>
            </div>

            <DeliveryRules
                restaurantId={restaurantId}
                isNew={false}
                onStatusChange={setSaveStatus} // Passando a função para o filho
            />
        </div>
    );
}