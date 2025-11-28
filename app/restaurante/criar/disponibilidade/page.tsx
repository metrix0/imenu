"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import { supabase } from "@/lib/supabaseClient";
import Button from "@/components/ui/Button";
import posthog from "posthog-js";

import WeeklyScheduleClick, { Availability, TimeSlot } from "@/components/restaurante/configuracoes/WeeklyScheduleClick";

export default function DisponibilidadePage() {
    const router = useRouter();
    const { setRestaurantId } = useCreationStore();

    useEffect(() => {
        posthog.capture("admin_access_create_restaurant_availability_page", {
            page: "/restaurante/criar/disponibilidade",
            timestamp: new Date().toISOString(),
        });
    }, []);

    const [availability, setAvailability] = useState<Availability>({});
    const [isLoading, setIsLoading] = useState(false);
    const [isFetchingData, setIsFetchingData] = useState(true);
    const [localRestaurantId, setLocalRestaurantId] = useState<string | null>(null);

    // Load Data
    useEffect(() => {
        const loadData = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();
                
                const { data, error } = await supabase
                    .from("restaurants")
                    .select("id, availability_json")
                    .eq("user_id", session?.user?.id)
                    .single();

                if (error) {
                    console.error("Erro ao carregar:", error);
                    return;
                }

                if (data) {
                    setLocalRestaurantId(data.id);
                    setRestaurantId(data.id);
                    
                    if (data.availability_json) {
                        setAvailability(data.availability_json as Availability);
                    } else {
                        setAvailability({});
                    }
                }
            } catch (err) {
                console.error(err);
            } finally {
                setIsFetchingData(false);
            }
        };

        loadData();
    }, [router, setRestaurantId]);

    const handleUseRecommended = () => {
        const recommendedSlots: TimeSlot[] = [
            { open: "11:00", close: "15:00" },
            { open: "18:00", close: "23:00" }
        ];

        const newAvailability: Availability = {};
        ["0", "1", "2", "3", "4", "5", "6"].forEach(dayKey => {
            newAvailability[dayKey] = [...recommendedSlots];
        });

        setAvailability(newAvailability);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!localRestaurantId) return;

        setIsLoading(true);
        try {
            const response = await fetch(`/api/restaurants/${localRestaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ availability_json: availability }),
            });

            if (!response.ok) throw new Error("Erro ao salvar.");

            router.push("/restaurante/criar/cardapio");
        } catch (err) {
            console.error(err);
            alert("Erro ao salvar disponibilidade.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isFetchingData) {
         return (
            <main className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </main>
        );
    }

    return (
        // Flex Column + Min-H-Screen garantem que o footer fique no final
        <div className="flex flex-col min-h-screen bg-white">
            
            {/* Conteúdo Principal (Cresce para ocupar espaço) */}
            <div className="flex-1 w-full max-w-6xl mx-auto px-6 pt-8 pb-16">
                <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-900 mb-2">Horário de Funcionamento</h1>
                        <p className="text-gray-500">
                            Clique nos espaços vazios para adicionar horários ou nos blocos para editar.
                        </p>
                    </div>
                    
                    <button
                        type="button"
                        onClick={handleUseRecommended}
                        className="text-brand font-medium hover:bg-red-50 px-4 py-2 rounded-md border border-brand transition-colors text-sm cursor-pointer"
                    >
                        Usar horários recomendados
                    </button>
                </div>

                <WeeklyScheduleClick 
                    value={availability} 
                    onChange={setAvailability} 
                />
            </div>

            {/* Barra Sticky no fundo do container principal */}
            {/* Ela gruda na tela enquanto tem scroll, mas para antes do footer global */}
            <div className="sticky bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <button
                        onClick={() => router.back()}
                        className="text-brand font-medium text-base hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer"
                    >
                        Voltar
                    </button>
                    <Button
                        variant="primary"
                        loading={isLoading}
                        onClick={handleSave}
                        className="px-8"
                    >
                        Salvar e Continuar
                    </Button>
                </div>
            </div>
        </div>
    );
}