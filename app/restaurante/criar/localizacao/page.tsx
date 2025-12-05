"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import { supabase } from "@/lib/supabaseClient"; 
import AddressForm from "@/components/restaurante/configuracoes/AddressForm";
import { AddressData } from "@/lib/types/types"; // Certifique-se que o caminho está certo

export default function LocalizacaoPage() {
    const router = useRouter();
    const { setRestaurantId, restaurantId } = useCreationStore();
    
    const [isSaving, setIsSaving] = useState(false);
    const [initialData, setInitialData] = useState<Partial<AddressData> | undefined>(undefined);
    const [isLoadingData, setIsLoadingData] = useState(true);
    // Armazena ID localmente para garantir consistência durante a renderização
    const [activeRestId, setActiveRestId] = useState<string | null>(restaurantId);

    useEffect(() => {
        const loadData = async () => {
            try {
                // 1. Verificar Sessão
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;

                // Se não tem user e nem restaurantId no store, talvez redirecionar para login?
                // Por enquanto mantemos o fluxo de tentar carregar.

                let query = supabase
                    .from("restaurants")
                    .select("id, address, latitude, longitude, user_id");

                // Prioridade: User Logado -> RestaurantId do Store
                if (user) {
                    query = query.eq("user_id", user.id);
                } else if (restaurantId) {
                    query = query.eq("id", restaurantId);
                } else {
                    // Sem ID para buscar
                    setIsLoadingData(false);
                    return;
                }

                const { data, error } = await query.maybeSingle();

                if (error) {
                    console.warn("Erro ao buscar dados iniciais:", error.message);
                }

                if (data) {
                    // Atualiza o store global para garantir sincronia
                    setRestaurantId(data.id);
                    setActiveRestId(data.id);

                    // Verifica se o campo address existe e faz o cast
                    const addressJson = data.address ? (data.address as unknown as Partial<AddressData>) : {};
                    
                    setInitialData({
                        ...addressJson,
                        latitude: data.latitude ?? addressJson.latitude, 
                        longitude: data.longitude ?? addressJson.longitude
                    });
                }
            } catch (err) {
                console.error("Erro no loadData:", err);
            } finally {
                setIsLoadingData(false);
            }
        };

        loadData();
    }, [router, setRestaurantId, restaurantId]);


    const handleSave = async (data: AddressData) => {
        if (!activeRestId) {
            alert("Erro: Restaurante não identificado. Faça login novamente.");
            return;
        }

        setIsSaving(true);

        // Prepara o payload conforme esperado pela API
        const payload = {
            address: data, // Vai ser stringify no backend
            latitude: data.latitude,
            longitude: data.longitude,
        };

        try {
            const response = await fetch(`/api/restaurants/${activeRestId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Erro ao salvar localização.");
            }

            // Sucesso: Próximo passo
            router.push("/restaurante/criar/tempo-e-taxa");
            
        } catch (error) {
            console.error(error);
            alert("Não foi possível salvar. Tente novamente.");
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoadingData) {
        return (
            <main className="flex items-center justify-center min-h-[50vh]">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </main>
        );
    }

    return (
        <main className="flex flex-col items-center justify-start pt-4 pb-30 w-full">
            <div className="w-full max-w-4xl px-4">
                <AddressForm 
                    initialData={initialData}
                    onSubmit={handleSave}
                    isLoading={isSaving} 
                    onValidityChange={() => {}}            
                />
            </div>
        </main>
    );
}