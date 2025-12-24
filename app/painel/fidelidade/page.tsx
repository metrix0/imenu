"use client";

import { useEffect, useState } from "react";
import { useLoyaltyStore } from "@/lib/stores/restaurant-owner/loyaltyStore";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import ToggleInput from "@/components/ui/ToggleInput";
import Card from "@/components/ui/Card";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faGift } from "@fortawesome/free-solid-svg-icons";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore";

export default function FidelidadePage() {
    
    const restaurantId = useCreationStore((state) => state.restaurantId);

    const { 
        program, 
        loading, 
        fetchProgram, 
        saveProgram, 
        updateField,
        setProgram // <--- 1. Importe o setProgram
    } = useLoyaltyStore();

    const [hasChanges, setHasChanges] = useState(false);

    useEffect(() => {
        if (restaurantId) {
            fetchProgram(restaurantId);
        }
    }, [restaurantId]);

    // Se carregou e é null, visualmente usamos o default
    const safeProgram = program || { active: false, goal_count: 10, reward_description: "" };

    const handleChange = (field: any, value: any) => {
        // 2. Lógica de inicialização segura
        if (!program) {
            // Se a store está vazia (null), inicializamos ela com os defaults + a alteração atual
            setProgram({
                id: "", // O backend vai gerar/ignorar isso no Upsert
                restaurant_id: restaurantId || "",
                goal_count: 10,
                reward_description: "",
                active: false,
                [field]: value // Sobrescreve o campo alterado (ex: active: true)
            });
        } else {
            // Se já existe, apenas atualiza o campo
            updateField(field, value);
        }
        setHasChanges(true);
    };

    const handleSave = async () => {
        await saveProgram();
        setHasChanges(false);
    };

    if (loading && !program) return <div className="p-8">Carregando...</div>;

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-gray-900">Programa de Fidelidade</h1>
                <p className="text-gray-500">
                    Recompense seus clientes recorrentes e aumente suas vendas.
                </p>
            </div>

            <Card className="space-y-6 p-6">
                {/* Ativar / Desativar */}
                <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                    <div>
                        <h3 className="font-semibold text-lg">Status do Programa</h3>
                        <p className="text-sm text-gray-500">
                            Se desativado, os clientes não verão a pontuação, mas o histórico é mantido.
                        </p>
                    </div>
                    <ToggleInput 
                        label={safeProgram.active ? "Ativado" : "Desativado"} 
                        checked={safeProgram.active} 
                        onChange={(e) => handleChange("active", e.target.checked)} 
                    />
                </div>

                {/* Configurações */}
                <div className={`space-y-6 transition-opacity ${!safeProgram.active ? "opacity-50 pointer-events-none" : ""}`}>
                    <div className="grid md:grid-cols-2 gap-6">
                        <Input
                            label="Meta de Pedidos"
                            type="number"
                            min={0}
                            placeholder="Ex: 10"
                            value={safeProgram.goal_count}
                            onChange={(e) => handleChange("goal_count", Number(e.target.value))}
                            icon={<FontAwesomeIcon icon={faStar} className="text-gray-400"/>}
                            className="w-full"
                        />
                        
                        <Input
                            label="Recompensa"
                            placeholder="Ex: Um Hambúrguer Clássico"
                            value={safeProgram.reward_description || ""}
                            onChange={(e) => handleChange("reward_description", e.target.value)}
                            icon={<FontAwesomeIcon icon={faGift} className="text-gray-400"/>}
                        />
                    </div>
                    
                    <div className="bg-blue-50 text-blue-800 p-4 rounded-lg text-sm">
                        <p>
                            <strong>Como funciona:</strong> O cliente ganha 1 ponto a cada pedido concluído. 
                            Ao atingir <strong>{safeProgram.goal_count} pontos</strong>, ele terá direito a: 
                            <strong> {safeProgram.reward_description || "Defina uma recompensa"}</strong>.
                        </p>
                    </div>
                </div>

                {/* Botão Salvar */}
                <div className="pt-4 flex justify-end">
                    <Button 
                        onClick={handleSave} 
                        loading={loading}
                        disabled={!hasChanges && !loading}
                        variant={hasChanges ? "primary" : "secondary"}
                    >
                        {hasChanges ? "Salvar Alterações" : "Salvo"}
                    </Button>
                </div>
            </Card>
        </div>
    );
}