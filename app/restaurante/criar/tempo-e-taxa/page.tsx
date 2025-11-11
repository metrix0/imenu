// app/restaurante/criar/tempo-e-taxa/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { useCreationStore } from "@/lib/creationStore";

// JSON STRUCTURE 
type RadiusRule = {
    radius_km: number;
    time_minutes: number;
    fee_cents: number;
};

export default function TempoETaxaPage() {
    const router = useRouter();
    const { restaurantId } = useCreationStore();
    

    
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

        const updatedRules = rules.map((rule, i) => {
            if (i === index) {
                if (field === 'radius_km') {
                    return { ...rule, radius_km: newValue };
                }
                if (field === 'time_minutes') {
                    return { ...rule, time_minutes: Math.round(newValue) }; // TIME IS AN INTEGER NUMBER
                }
                if (field === 'fee_cents') {
                    // R$ TO CENTS
                    return { ...rule, fee_cents: newValue * 100 };
                }
            }
            return rule;
        });

        setRules(updatedRules);
    };

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
        ]);
    };

    // DELETE RULE
    const handleDeleteRule = (index: number) => {
        setRules(prev => prev.filter((_, i) => i !== index));
    };

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

        try {
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(dataToSave),
            });

            if (!response.ok) {
                throw new Error("Falha ao salvar.");
            }
            
            router.push(`/restaurante/criar/disponibilidade`);

        } catch (error) {
            console.error(error);
            alert((error as Error).message);
        }
    };

    // --- JSX ---
    return (
        <div className="max-w-2xl mx-auto p-8">
            <h1 className="text-3xl font-bold mb-4">Tempo e Taxa de Entrega</h1>
            <p className="text-gray-600 mb-8">
                Defina as faixas de entrega por raio, o tempo e a taxa para cada uma.
            </p>

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
        </div>
    );
}