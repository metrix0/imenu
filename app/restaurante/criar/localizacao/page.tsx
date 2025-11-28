"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import { supabase } from "@/lib/supabaseClient"; 
import AddressForm, { AddressData } from "@/components/restaurante/configuracoes/AddressForm";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";

export default function LocalizacaoPage() {
    const router = useRouter();
    const { setRestaurantId, restaurantId } = useCreationStore();
    
    const [isSaving, setIsSaving] = useState(false);
    const [initialData, setInitialData] = useState<Partial<AddressData> | undefined>(undefined);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [localRestaurantId, setLocalRestaurantId] = useState<string | null>(null);

    // ESTADO DE VALIDAÇÃO (LIFTED STATE)
    const [isFormValid, setIsFormValid] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;

                if (restaurantId) {
                    setLocalRestaurantId(restaurantId);
                }

                let query = supabase
                    .from("restaurants")
                    .select("id, address, latitude, longitude");

                if (user) {
                    query = query.eq("user_id", user.id);
                } else if (restaurantId) {
                    query = query.eq("id", restaurantId);
                } else {
                    setIsLoadingData(false);
                    return;
                }

                const { data, error } = await query.maybeSingle();

                if (error) {
                    console.warn("Não foi possível carregar dados prévios:", error.message);
                }

                if (data) {
                    setLocalRestaurantId(data.id);
                    setRestaurantId(data.id);

                    const addressJson = data.address as unknown as Partial<AddressData>;
                    
                    if (addressJson) {
                        setInitialData({
                            ...addressJson,
                            latitude: data.latitude ?? addressJson.latitude, 
                            longitude: data.longitude ?? addressJson.longitude
                        });
                    }
                }
            } catch (err) {
                console.error("Erro não bloqueante:", err);
            } finally {
                setIsLoadingData(false);
            }
        };

        loadData();
    }, [router, setRestaurantId, restaurantId]);


    const handleSave = async (data: AddressData) => {
        const targetId = localRestaurantId || restaurantId;

        if (!targetId) {
            alert("Erro: Restaurante não identificado. Tente voltar e iniciar novamente.");
            return;
        }

        setIsSaving(true);

        const payload = {
            address: data, 
            latitude: data.latitude,
            longitude: data.longitude,
        };

        try {
            const response = await fetch(`/api/restaurants/${targetId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error || "Erro ao salvar localização.");
            }

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
        // Usamos flex-col e min-h-screen para ocupar a tela toda
        <div className="flex flex-col min-h-screen bg-white">
            
            {/* O conteúdo principal cresce (flex-1) empurrando o footer para baixo */}
            
            <main className="flex-1 flex flex-col items-center justify-start pt-4 pb-8 w-full max-w-4xl mx-auto">
                
                <div className="w-full">
                    <AddressForm 
                        initialData={initialData} 
                        onSubmit={handleSave} 
                        onValidityChange={setIsFormValid} 
                    />
                </div>
                
            </main>
           

            {/* A barra de botões é "sticky" no fundo da viewport, mas dentro do fluxo do container */}
            {/* Isso faz ela flutuar sobre o conteúdo se a página for longa, mas para ao chegar no final */}
            <div className="sticky bottom-0 left-0 w-full bg-white border-t border-gray-200 px-6 py-4 mt-20 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto flex items-center justify-end">
                    <div className="w-auto">
                        <Button
                            form="address-form" 
                            type="submit"
                            variant={!isFormValid ? "secondary" : "primary"} 
                            loading={isSaving}
                            disabled={!isFormValid || isSaving} 
                            className="w-full sm:w-auto px-8 py-3 text-base disabled:pointer-events-none disabled:opacity-50"
                        >
                            Continuar
                        </Button>
                    </div>
                </div>
            </div>
        </div>
    );
}