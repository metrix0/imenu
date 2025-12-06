"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Loader from "@/components/ui/Loader";
import WeeklyScheduleClick, { Availability } from "@/components/restaurante/configuracoes/WeeklyScheduleClick";

// Imports para o Tooltip
import Tooltip from "@/components/ui/Tooltip";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";

export default function DisponibilidadePage() {
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [availability, setAvailability] = useState<Availability>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);

    // 1. Carregar Dados Iniciais
    useEffect(() => {
        const loadData = async () => {
            setIsLoading(true);
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) return;

                const { data: restaurant } = await supabase
                    .from("restaurants")
                    .select("id, availability_json")
                    .eq("user_id", session.user.id)
                    .single();

                if (restaurant) {
                    setRestaurantId(restaurant.id);
                    // Garante que seja um objeto, mesmo que venha null do banco
                    setAvailability(restaurant.availability_json || {});
                }
            } catch (error) {
                console.error("Erro ao carregar horários:", error);
            } finally {
                setIsLoading(false);
            }
        };

        loadData();
    }, []);

    // 2. Handler de Atualização (Auto-Save)
    const handleScheduleChange = async (newVal: Availability) => {
        // Atualização Otimista (Visual instantâneo)
        setAvailability(newVal);
        
        if (!restaurantId) return;

        setIsSaving(true);
        try {
            const { error } = await supabase
                .from("restaurants")
                .update({ availability_json: newVal })
                .eq("id", restaurantId);

            if (error) throw error;
        } catch (error) {
            console.error("Erro ao salvar horários:", error);
            alert("Falha ao salvar alterações. Verifique sua conexão.");
        } finally {
            // Pequeno delay para o usuário ver que salvou (opcional, puramente visual)
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
        <div className="max-w-6xl mx-auto pb-20">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold text-gray-900">Horários de Funcionamento</h1>
                        
                        {/* Tooltip com a dica de uso */}
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
                
                {/* Indicador de Status de Salvamento */}
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
                {/* Componente Visual de Horários */}
                <div className="min-w-[700px]"> {/* Garante largura mínima para o grid não quebrar em mobile */}
                    <WeeklyScheduleClick 
                        value={availability} 
                        onChange={handleScheduleChange} 
                    />
                </div>
            </div>
            
            {/* Texto antigo removido conforme solicitado */}
        </div>
    );
}