// app/restaurante/criar/tempo-e-taxa/page.tsx
"use client";

import { useEffect, useState, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCreationStore } from "@/lib/creationStore";
import posthog from "posthog-js";

import DeliveryRules, { DeliveryRulesRef } from "@/components/restaurante/configuracoes/TempoeTaxa";
import Button from "@/components/ui/Button"; // Assumindo que você tem esse componente, baseado no seu código de exemplo

export default function TempoETaxaPage() {
    const router = useRouter();
    const router = useRouter();
    const { restaurantId } = useCreationStore();

    useEffect(() => {
        posthog.capture("admin_access_create_restaurant_delivery_fee_page", {
            page: "/restaurante/criar/tempo-e-taxa",
            timestamp: new Date().toISOString(),
        });
    }, []);

    // RADIUS RULES
    const [rules, setRules] = useState<RadiusRule[]>([
        // STARTS WITH EXAMPLE RULES
        { radius_km: 1, time_minutes: 40, fee_cents: 300 },
        { radius_km: 3, time_minutes: 55, fee_cents: 600 },
        { radius_km: 5, time_minutes: 75, fee_cents: 800 },
    ]);

    // UPDATE LIST
    const handleRuleChange = (
        index: number,
        field: 'radius_km' | 'time_minutes' | 'fee_cents',
        value: string
    ) => {
        const newValue = parseFloat(value) || 0; // CONVERTS TO NUMBER
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

    // ADD BLANK RULE
    const handleAddRule = () => {
        const lastRule = rules.length > 0 ? rules[rules.length - 1] : { radius_km: 0, time_minutes: 40 };

        setRules([
            ...rules,
            {
                radius_km: lastRule.radius_km + 1,
                time_minutes: lastRule.time_minutes,
                fee_cents: 0
            }

            setRestaurantId(restaurant.id);

    // REORDER LIST
    const sortAndSave = async () => {
        const sortedRules = [...rules].sort((a, b) => a.radius_km - b.radius_km);
        setRules(sortedRules);

        if (sortedRules.length === 0) {
            alert("Você deve adicionar pelo menos uma regra de taxa.");
            return;
        }

        if (!restaurantId) {
            alert("Erro: ID do restaurante não encontrado. Volte para a etapa de localização.");
            return;
        }


        const dataToSave = {
            delivery_fee_json: sortedRules,
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

            if (!response.ok) {
                throw new Error("Falha ao salvar.");
            }

            router.push(`/restaurante/criar/disponibilidade`);
    // DO NOT RETURN NULL → this was giving you a blank screen
    if (!restaurantId) {
        return <div>Carregando restaurante...</div>;
    }


    return (
        <div className="max-w-3xl mx-auto py-10 px-6 pb-32"> {/* pb-32 adicionado para o conteúdo não ficar atrás do footer */}

            {/* Passamos a ref para controlar o componente filho */}
            {/* --- FEE SECTION --- */}
            <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">

                {/* LIST HEADER */}
                <div className="flex items-center gap-4 mb-2 px-2">
                    <span className="w-1/3 text-sm font-medium text-gray-500">Raio (km)</span>
                    <span className="w-1/3 text-sm font-medium text-gray-500">Tempo (min)</span>
                    <span className="w-1/3 text-sm font-medium text-gray-500">Taxa (R$)</span>
                    <span className="w-8"></span> {/* SPACE FOR DELETE BUTTON */}
                </div>

                {/* RULES LIST */}
                <div className="space-y-3">
                    {rules.map((rule, index) => (
                        <div key={index} className="flex items-center gap-4 p-2">
                            {/* RADIUS */}
                            <div className="w-1/3">
                                <input
                                    type="number"
                                    step="0.5"
                                    value={rule.radius_km}
                                    onChange={(e) => handleRuleChange(index, 'radius_km', e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm"
                                    aria-label="Raio em km"
                                />
                            </div>
                            {/* TIME */}
                            <div className="w-1/3">
                                <input
                                    type="number"
                                    step="5"
                                    value={rule.time_minutes}
                                    onChange={(e) => handleRuleChange(index, 'time_minutes', e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm"
                                    aria-label="Tempo em minutos"
                                />
                            </div>
                            {/* FEE */}
                            <div className="w-1/3">
                                <input
                                    type="number"
                                    step="0.5"
                                    value={rule.fee_cents / 100}
                                    onChange={(e) => handleRuleChange(index, 'fee_cents', e.target.value)}
                                    className="block w-full rounded-md border-gray-300 shadow-sm"
                                    aria-label="Taxa em R$"
                                />
                            </div>
                            {/* DELETE */}
                            <button onClick={() => handleDeleteRule(index)} className="text-red-500 hover:text-red-700 p-1">
                                <FontAwesomeIcon icon={icons.faTrash} className="w-5 h-5" />
                            </button>
                        </div>
                    ))}
                </div>

                {/* ADD BUTTON */}
                <button
                    onClick={handleAddRule}
                    className="mt-6 w-full bg-indigo-50 text-indigo-700 py-2 px-4 rounded-md font-medium hover:bg-indigo-100 border border-indigo-200"
                >
                    + Adicionar Faixa
                </button>
            </div>

            {/* --- SAVE BUTTON --- */}
            <button
                onClick={sortAndSave}
                className="w-full bg-green-600 text-white py-3 px-6 rounded-lg text-lg font-medium hover:bg-green-700"
            >
                Salvar e Continuar
            </button>
            <DeliveryRules
                ref={rulesRef}
                restaurantId={restaurantId}
                isNew={true}
            />

            {/* Footer Bar */}
            <div className="fixed bottom-0 left-0 w-full bg-white border-t border-gray-200 p-4 z-40 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
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