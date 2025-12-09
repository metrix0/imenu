"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useRouter } from "next/navigation";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Importar a store

import DeliveryRules, { DeliveryRulesRef } from "@/components/restaurant-owner/configuracoes/TempoeTaxa";
import Button from "@/components/ui/Button";

export default function TempoETaxaPage() {
    const router = useRouter();
    // Tenta pegar direto da store (mais rápido)
    const { restaurantId: storedId, setRestaurantId: setStoreId } = useCreationStore();
    
    const [restaurantId, setRestaurantId] = useState<string | null>(storedId);
    const [isLoading, setIsLoading] = useState(false);
    const [isPageLoading, setIsPageLoading] = useState(!storedId); // Se já tem ID, não carrega

    const rulesRef = useRef<DeliveryRulesRef>(null);

    useEffect(() => {
        const init = async () => {
            if (restaurantId) return; // Já temos ID, não precisa buscar

            console.log("🔄 Buscando restaurante...");
            
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.user) {
                console.log("❌ Sem usuário logado");
                // router.push("/restaurante"); // Opcional: Redirecionar se perder sessão
                return;
            }

            // Busca o restaurante do usuário logado
            const { data: restaurant, error } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (error || !restaurant) {
                console.error("❌ Erro ao buscar restaurante:", error);
                return;
            }

            console.log("✅ Restaurante encontrado:", restaurant.id);
            setRestaurantId(restaurant.id);
            setStoreId(restaurant.id); // Sincroniza store
            setIsPageLoading(false);
        };

        init();
    }, [restaurantId, setStoreId]);

    const handleSave = async () => {
        if (!rulesRef.current) return;

        setIsLoading(true);
        try {
            await rulesRef.current.save();
            router.push("/restaurante/criar/disponibilidade");
        } catch (error) {
            console.error("Erro ao salvar:", error);
            alert("Não foi possível salvar as configurações.");
        } finally {
            setIsLoading(false);
        }
    };

    if (isPageLoading || !restaurantId) {
        return (
            <div className="flex items-center justify-center min-h-screen">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand"></div>
            </div>
        );
    }

    return (
        <div className="max-w-3xl mx-auto py-10 px-6 pb-32">
            <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">Tempo e Taxa de Entrega</h1>
                <p className="text-gray-500 mt-1 2xl:text-lg">Defina as regras de entrega para o seu restaurante.</p>
            </div>
            
            <DeliveryRules
                ref={rulesRef}
                restaurantId={restaurantId}
                isNew={true} // Força defaults se estiver vazio
            />

            {/* Footer Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 2xl:p-5 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
                <div className="max-w-4xl mx-auto flex items-center justify-between 2xl:text-lg ">
                    <button
                        onClick={() => router.back()}
                        className="text-brand font-medium text-base hover:opacity-80 transition-opacity flex items-center gap-1 cursor-pointer 2xl:text-lg"
                    >
                        Voltar
                    </button>
                    <Button
                        variant="primary"
                        loading={isLoading}
                        onClick={handleSave}
                        className="px-8 2xl:px-10 2xl:py-4"
                    >
                        Salvar e Continuar
                    </Button>
                </div>
            </div>
        </div>
    );
}