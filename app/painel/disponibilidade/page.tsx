"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import Loader from "@/components/ui/Loader";
import WeeklyScheduleClick, { Availability } from "@/components/restaurant-owner/configuracoes/WeeklyScheduleClick";
import Tooltip from "@/components/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";

export default function DisponibilidadePage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [availability, setAvailability] = useState<Availability>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
        // Verifique aqui sua variável de estado (ex: isSaving, status === 'saving')
        if (isSaving) { 
            e.preventDefault();
            e.returnValue = ""; 
        }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
}, [isSaving]); // Adicione a variável de estado nas dependências

    // 1. Carregar Dados Iniciais
    useEffect(() => {
        const loadData = async () => {
            // Se já tem ID no store, podemos otimizar, mas ainda precisamos dos dados do banco (availability)
            // Diferente das outras que só precisavam do ID, aqui precisamos do JSON de disponibilidade.
            
            // Lógica unificada de busca
            let targetId = restaurantId;

            if (!targetId) {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    setIsLoading(false);
                    return;
                }
                // Busca ID via user se não tiver no store
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

            // Agora busca os dados específicos desta página
            if (targetId) {
                const { data: restaurant } = await supabase
                    .from("restaurants")
                    .select("availability_json")
                    .eq("id", targetId)
                    .single();

                if (restaurant) {
                    setAvailability(restaurant.availability_json || {});
                }
            }
            setIsLoading(false);
        };

        loadData();
    }, [restaurantId, setRestaurantId]);

    // 2. Handler de Atualização (Auto-Save via API)
    const handleScheduleChange = async (newVal: Availability) => {
        // Atualização Otimista
        setAvailability(newVal);
        
        if (!restaurantId) return;

        setIsSaving(true);
        try {
            // CORREÇÃO: Usando API Unificada
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availability_json: newVal }),
            });

            if (!response.ok) {
                throw new Error("Erro na API");
            }
        } catch (error) {
            console.error("Erro ao salvar horários:", error);
            alert("Falha ao salvar alterações. Verifique sua conexão.");
        } finally {
            setTimeout(() => setIsSaving(false), 500);
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-64">
                <Loader />
                <p className="text-gray-400 mt-4 text-sm">Buscando horários...</p>
            </div>
        );
    }

    if (!restaurantId) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500">Restaurante não encontrado.</p>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto pb-20 px-4 sm:px-6 pt-8">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold text-gray-900">Horários de Funcionamento</h1>
                        <Tooltip 
                            text="Clique nos espaços vazios para criar um turno. Clique em um turno existente para editar ou excluir."
                            position="right"
                            size="line"
                        >
                            <FontAwesomeIcon 
                                icon={icons.faCircleInfo} 
                                className="text-gray-400 text-lg hover:text-brand cursor-help mt-1 transition-colors" 
                            />
                        </Tooltip>
                    </div>
                    <p className="text-gray-500 mt-1">Defina quando sua loja estará aberta para receber pedidos.</p>
                </div>
                
                <div className="text-sm font-medium h-6 flex items-center">
                    {isSaving ? (
                        <span className="text-brand animate-pulse">Salvando...</span>
                    ) : (
                        <span className="text-green-600 flex items-center gap-1">
                            <FontAwesomeIcon icon={icons.faCheck} className="text-xs" /> Tudo salvo
                        </span>
                    )}
                </div>
            </div>

            <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-sm overflow-x-auto">
                <div className="min-w-[700px]">
                    <WeeklyScheduleClick 
                        value={availability} 
                        onChange={handleScheduleChange} 
                    />
                </div>
            </div>
        </div>
    );
}