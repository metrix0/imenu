// app/restaurante/criar/localizacao/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import { supabase } from "@/lib/supabaseClient"; 
import AddressForm from "@/components/restaurante/configuracoes/AddressForm";
import { AddressData } from "@/lib/types/types";

export default function LocalizacaoPage() {
    const router = useRouter();
    const { setRestaurantId, restaurantId } = useCreationStore();
    
    const [isSaving, setIsSaving] = useState(false);
    const [initialData, setInitialData] = useState<Partial<AddressData> | undefined>(undefined);
    const [isLoadingData, setIsLoadingData] = useState(true);
    const [localRestaurantId, setLocalRestaurantId] = useState<string | null>(null);

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
                    console.warn("Aviso: ", error.message);
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
        <main className="flex flex-col items-center justify-start pt-4 pb-12">
            <AddressForm 
                initialData={initialData}
                onSubmit={handleSave}
                // CORREÇÃO AQUI: Passamos isSaving para o loading
                isLoading={isSaving} 
                // CORREÇÃO AQUI: Função vazia para não quebrar o app, 
                // já que o botão está dentro do form e se auto-gerencia.
                onValidityChange={() => {}}            
            />
        </main>
    );
}