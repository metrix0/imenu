// app/restaurante/criar/localizacao/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/creationStore";
import { supabase } from "@/lib/supabaseClient"; 
import AddressForm from "@/components/restaurante/configuracoes/AddressForm";
import Button from "@/components/ui/Button";
import { AddressData } from "@/lib/types";
import Card from "@/components/ui/Card";

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
                // 1. Tenta pegar a sessão, mas não bloqueia se não existir
                const { data: { session } } = await supabase.auth.getSession();
                const user = session?.user;

                // Se já temos o ID na memória (Zustand), garantimos que ele seja o localRestaurantId
                // Isso previne o erro caso a busca no banco falhe.
                if (restaurantId) {
                    setLocalRestaurantId(restaurantId);
                }

                let query = supabase
                    .from("restaurants")
                    .select("id, address, latitude, longitude");

                // Lógica de busca:
                if (user) {
                    query = query.eq("user_id", user.id);
                } else if (restaurantId) {
                    query = query.eq("id", restaurantId);
                } else {
                    // Sem user e sem ID no store -> Não tem o que fazer, apenas libera o loading
                    setIsLoadingData(false);
                    return;
                }

                // ALTERAÇÃO IMPORTANTE: .maybeSingle() em vez de .single()
                // .single() estoura erro se não achar nada ou se der erro de permissão.
                // .maybeSingle() retorna null data sem estourar erro de "0 rows".
                const { data, error } = await query.maybeSingle();

                if (error) {
                    // Apenas logamos como warn, pois já definimos o ID ali em cima via store
                    console.warn("Não foi possível carregar dados prévios (normal se for cadastro novo):", error.message);
                }

                if (data) {
                    // Se achou dados no banco, atualiza o estado
                    setLocalRestaurantId(data.id);
                    setRestaurantId(data.id); // Sincroniza store

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
        // Usa o ID local ou o do store como fallback
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
                isLoading={isSaving} onValidityChange={function (isValid: boolean): void {
                    throw new Error("Function not implemented.");
                } }            />
        </main>
    );
}