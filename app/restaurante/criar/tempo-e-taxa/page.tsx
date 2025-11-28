// app/restaurante/criar/tempo-e-taxa/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";

import DeliveryRules, { DeliveryRulesRef } from "@/components/restaurante/configuracoes/TempoeTaxa";
import Button from "@/components/ui/Button"; // Assumindo que você tem esse componente, baseado no seu código de exemplo

export default function TempoETaxaPage() {
    const router = useRouter();
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    // Referência para acessar a função save() do filho
    const rulesRef = useRef<DeliveryRulesRef>(null);

    // KEEPING THE WORKING LOGIC EXACTLY AS IT WAS
    useEffect(() => {
        const load = async () => {
            console.log("➡️ load() starting…");

            // Load session
            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            console.log("📌 session =", session);
            console.log("📌 sessionError =", sessionError);

            if (!session?.user) {
                console.log("❌ No logged user");
                return;
            }

            const user = session.user;

            // Get restaurant for this user
            const { data: restaurant, error: restError } = await supabase
                .from("restaurants")
                .select("id, user_id, delivery_fee_json")
                .eq("user_id", user.id)
                .single();

            console.log("🏪 restaurant =", restaurant);
            console.log("🔴 restError =", restError);

            if (!restaurant) {
                console.log("❌ User has no restaurant yet");
                return;
            }

            setRestaurantId(restaurant.id);

            console.log("✅ restaurantId =", restaurant.id);
        };

        load();
    }, []);

    const handleSave = async () => {
        if (!rulesRef.current) return;

        setIsLoading(true);
        try {
            // Chama a função save() que está dentro do componente DeliveryRules
            await rulesRef.current.save();
            
            // Redireciona após salvar
            router.push("/restaurante/criar/disponibilidade");
        } catch (error) {
            console.error("Erro ao salvar:", error);
        } finally {
            setIsLoading(false);
        }
    };

    // DO NOT RETURN NULL → this was giving you a blank screen
    if (!restaurantId) {
        return <div>Carregando restaurante...</div>;
    }

return (
    <div className="relative min-h-screen flex flex-col">
        
        {/* Conteúdo da página */}
        <div className="max-w-3xl mx-auto py-10 px-6 pb-32 flex-1">
            <div className="mb-8 text-center sm:text-left">
                <h1 className="text-3xl font-bold mb-3">Tempo e Taxa de Entrega</h1>
                <p className="text-gray-500 mt-1">Agora, recomendamos essa taxa e tempo de entrega</p>
            </div>

            <DeliveryRules
                ref={rulesRef}
                restaurantId={restaurantId}
                isNew={true}
            />
        </div>

        {/* Barra que deve parar antes do footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)] z-40">
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