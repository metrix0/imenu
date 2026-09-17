"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import Loader from "@/components/ui/Loader";
import SaveStatus from "@/components/ui/SaveStatus";
import WeeklyScheduleClick, { Availability } from "@/components/restaurant-owner/configuracoes/WeeklyScheduleClick";

export default function DisponibilidadePage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [availability, setAvailability] = useState<Availability>({});
    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [saveError, setSaveError] = useState(false);

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

    useEffect(() => {
        let touchStart: { x: number; y: number } | null = null;

        const handleTouchStart = (event: TouchEvent) => {
            if (!window.matchMedia("(max-width: 767px)").matches) {
                touchStart = null;
                return;
            }

            const touch = event.touches[0];
            touchStart = { x: touch.clientX, y: touch.clientY };
        };

        const handleTouchEnd = (event: TouchEvent) => {
            const start = touchStart;
            touchStart = null;
            if (!start) return;

            const touch = event.changedTouches[0];
            const horizontalDistance = touch.clientX - start.x;
            const verticalDistance = Math.abs(touch.clientY - start.y);

            if (horizontalDistance >= 70 && verticalDistance < 50) {
                event.stopImmediatePropagation();
            }
        };

        document.addEventListener("touchstart", handleTouchStart, {
            capture: true,
            passive: true,
        });
        document.addEventListener("touchend", handleTouchEnd, {
            capture: true,
            passive: true,
        });

        return () => {
            document.removeEventListener("touchstart", handleTouchStart, true);
            document.removeEventListener("touchend", handleTouchEnd, true);
        };
    }, []);

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
        setSaveError(false);
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
            setSaveError(true);
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
        <div className="max-w-6xl min-[1800px]:max-w-[100rem] min-[1800px]:w-full mx-auto pb-20 px-4 sm:px-6 pt-8">
            <div className="mb-8 flex flex-col sm:flex-row sm:items-end justify-between gap-4 px-2">
                <div>
                    <div className="flex items-center gap-2">
                        <h1 className="text-3xl font-bold text-gray-900">Horários de Funcionamento</h1>
                    </div>
                    <p className="text-gray-500 mt-1 min-[1800px]:text-lg">Defina quando sua loja estará aberta para receber pedidos.</p>
                </div>
                
                <div className="text-sm font-medium h-6 flex items-center">
                    <SaveStatus status={saveError ? "error" : isSaving ? "saving" : "saved"} />
                </div>
            </div>

            <p className="mb-3 text-xs text-gray-500 md:hidden">Deslize a grade para os lados para ver todos os dias.</p>
            <div tabIndex={0} role="region" aria-label="Grade de horários da semana" className="bg-white border border-gray-200 rounded-xl py-4 pl-3 pr-4 sm:py-6 sm:pl-5 sm:pr-6 overflow-x-auto -mx-2 sm:mx-0">
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
