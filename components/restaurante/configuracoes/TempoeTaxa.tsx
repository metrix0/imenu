"use client";

import { useEffect, useState, useRef, forwardRef, useImperativeHandle } from "react";
import { useRouter } from "next/navigation";

import { useRestauranteConfig } from "@/lib/RestauranteConfiguracoesZustand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
import Tooltip from "@/components/ui/Tooltip";

import { faClock, faBullseye } from "@fortawesome/free-solid-svg-icons";

import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { supabase } from "@/lib/supabaseClient";

type RadiusRule = {
    radius_km: number;
    time_minutes: number;
    fee_cents: number | null;
};

export type DeliveryRulesRef = {
    save: () => Promise<void>;
};

type DeliveryRulesProps = {
    restaurantId: string;
    isNew: boolean;
    onStatusChange?: (status: "idle" | "saving" | "saved") => void;
};

const DeliveryRules = forwardRef<DeliveryRulesRef, DeliveryRulesProps>(
    ({ restaurantId, isNew, onStatusChange }, ref) => {
        const {
            deliveryRules,
            minOrder,
            setDeliveryRules,
            setMinOrder,
        } = useRestauranteConfig();

        const [rules, setRules] = useState<RadiusRule[]>([]);
        const minOrderRef = useRef<HTMLInputElement>(null);

        // Helper para atualizar status no pai
        const updateStatus = (newStatus: "idle" | "saving" | "saved") => {
            if (onStatusChange) onStatusChange(newStatus);
        };

        // ---------------------------------------------------
        // EXPOSE SAVE FUNCTION TO PARENT
        // ---------------------------------------------------
        useImperativeHandle(ref, () => ({
            save: async () => {
                await saveToDB(true);
            },
        }));

        // ---------------------------------------------------
        // INITIAL LOAD
        // ---------------------------------------------------
        useEffect(() => {
            if (!restaurantId) return;

            const cachedRules = deliveryRules[restaurantId];
            const cachedMin = minOrder[restaurantId];

            if (cachedRules && cachedRules.length > 0) {
                setRules(cachedRules);
                if (cachedMin != null && minOrderRef.current) {
                    minOrderRef.current.value = String(cachedMin);
                }
                if (!isNew) fetchFromDB();
                return;
            }

            if (isNew) {
                const defaults: RadiusRule[] = [
                    { radius_km: 0.5, time_minutes: 40, fee_cents: null },
                    { radius_km: 1, time_minutes: 40, fee_cents: null },
                    { radius_km: 1.5, time_minutes: 40, fee_cents: null },
                    { radius_km: 2, time_minutes: 40, fee_cents: null },
                    { radius_km: 3, time_minutes: 50, fee_cents: null },
                    { radius_km: 4, time_minutes: 50, fee_cents: null },
                ];
                setRules(defaults);
                if (minOrderRef.current) minOrderRef.current.value = "20";
                return;
            }

            fetchFromDB();
        }, [restaurantId, isNew]);

        const fetchFromDB = async () => {
            const { data, error } = await supabase
                .from("restaurants")
                .select("delivery_fee_json, min_order_cents")
                .eq("id", restaurantId)
                .single();

            if (error) return;

            if (data?.delivery_fee_json) {
                // Ordenamos ao carregar para garantir consistência
                const loadedRules = data.delivery_fee_json.map((r: any) => ({
                    radius_km: r.radius_km,
                    time_minutes: r.time_minutes,
                    fee_cents: r.fee_cents ?? null,
                })).sort((a: RadiusRule, b: RadiusRule) => a.radius_km - b.radius_km);
                
                setRules(loadedRules);
            }

            if (data?.min_order_cents != null && minOrderRef.current) {
                minOrderRef.current.value = String(data.min_order_cents / 100);
            }
        };

        // ---------------------------------------------------
        // ADD RULE (CORRIGIDA - PREENCHE BURACOS)
        // ---------------------------------------------------
        const handleAddRule = () => {
            setRules((prev) => {
                // 1. Cria um Set com todos os raios atuais para busca rápida
                const existingRadii = new Set(prev.map(r => r.radius_km));
                
                // 2. Começa de 0.5 e vai incrementando até achar um "buraco" livre
                let candidate = 0.5;
                while (existingRadii.has(candidate)) {
                    candidate += 0.5;
                    // Prevenção de loop infinito (safety break), embora improvável
                    if (candidate > 100) break;
                }

                // 3. Define o tempo padrão (copia do último ou 40min)
                const lastRule = prev[prev.length - 1];

                const newRules = [
                    ...prev,
                    {
                        radius_km: candidate,
                        time_minutes: lastRule ? lastRule.time_minutes : 40,
                        fee_cents: null,
                    },
                ];

                // 4. Ordena sempre para manter a lista visualmente correta (0.5 -> 1.0 -> 1.5 -> 4.0)
                return newRules.sort((a, b) => a.radius_km - b.radius_km);
            });
        };

        // ---------------------------------------------------
        // DELETE RULE
        // ---------------------------------------------------
        const handleDeleteRule = (i: number) => {
            // REGRA: Não permite excluir se for a última regra
            if (rules.length <= 1) return;
            setRules((prev) => prev.filter((_, idx) => idx !== i));
        };

        // ---------------------------------------------------
        // UPDATE RADIUS (Com validação de duplicidade)
        // ---------------------------------------------------
        const handleRadiusChange = (index: number, newValue: string) => {
            const val = parseFloat(newValue);
            if (isNaN(val) || val < 0) return;

            // REGRA: Não permite raios iguais
            const exists = rules.some((r, idx) => idx !== index && r.radius_km === val);
            
            if (exists) {
                return; // Bloqueia a alteração se duplicar
            }

            setRules(prev => {
                const next = [...prev];
                next[index] = { ...next[index], radius_km: val };
                // Opcional: Se quiser que ordene automaticamente ao digitar, descomente abaixo.
                // Mas geralmente é ruim UX pular a linha enquanto digita.
                // return next.sort((a, b) => a.radius_km - b.radius_km);
                return next;
            });
        };

        // ---------------------------------------------------
        // SAVE TO DB + ZUSTAND
        // ---------------------------------------------------
        const saveToDB = async (force = false) => {
            if (isNew && !force) return;

            // Garante ordenação final antes de salvar no banco
            const sortedRules = [...rules].sort((a, b) => a.radius_km - b.radius_km);

            const finalRules = sortedRules.map((r) => ({
                radius_km: r.radius_km,
                time_minutes: r.time_minutes,
                fee_cents: r.fee_cents,
            }));

            const minOrderValue = minOrderRef.current
                ? parseFloat(minOrderRef.current.value) || 15
                : 15;

            setDeliveryRules(restaurantId, finalRules);
            setMinOrder(restaurantId, minOrderValue);

            const { error } = await supabase
                .from("restaurants")
                .update({
                    delivery_fee_json: finalRules,
                    min_order_cents: minOrderValue * 100,
                })
                .eq("id", restaurantId);

            if (error) {
                console.error("[AUTOSAVE] Error saving:", error);
                updateStatus("idle");
            } else {
                updateStatus("saved");
            }
        };

        // ---------------------------------------------------
        // AUTOSAVE
        // ---------------------------------------------------
        useEffect(() => {
            if (isNew) return;
            updateStatus("saving");
            const timeout = setTimeout(async () => {
                await saveToDB();
            }, 1000);
            return () => clearTimeout(timeout);
        }, [rules]);

        return (
            <div className="max-w-2xl mx-auto ">
                {/* DELIVERY RULES */}
                <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                    <div className="flex items-center gap-4 mb-2 px-2">
                        <span className="w-1/3 flex items-center gap-2 text-sm font-medium text-gray-700">
                            <FontAwesomeIcon icon={faBullseye} /> Raio (km)
                        </span>
                        <span className="w-1/3 flex items-center gap-2 text-sm font-medium text-gray-700">
                            <FontAwesomeIcon icon={faClock} /> Tempo
                        </span>
                        <span className="w-1/3 flex items-center gap-2 text-sm font-medium text-gray-700">
                            <FontAwesomeIcon icon={icons.faDollarSign} /> Taxa
                        </span>
                        <span className="w-8"></span>
                    </div>

                    <div className="space-y-3">
                        {rules.map((rule, index) => (
                            <div key={index} className="flex items-center gap-4 p-2">
                                {/* Raio - AGORA EDITÁVEL */}
                                <Input
                                    numeric
                                    className="w-1/3"
                                    value={String(rule.radius_km)}
                                    onChange={(e) => handleRadiusChange(index, e.target.value)}
                                />

                                {/* Tempo */}
                                <Input
                                    numeric
                                    icon="min"
                                    iconPosition="right"
                                    className="w-1/3"
                                    value={String(rule.time_minutes)}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value || "0");
                                        setRules((prev) => {
                                            const next = [...prev];
                                            next[index].time_minutes = val;
                                            return next;
                                        });
                                    }}
                                />

                                {/* Taxa */}
                                <Input
                                    float
                                    icon={<FontAwesomeIcon icon={icons.faDollarSign} />}
                                    iconPosition="left"
                                    className="w-1/3"
                                    value={rule.fee_cents === null ? "" : (rule.fee_cents / 100).toFixed(2).replace(".", ",")}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        const val = raw && raw !== "0,00"
                                                ? Math.round(parseFloat(raw.replace(",", ".")) * 100)
                                                : null;

                                        setRules((prev) => {
                                            const next = [...prev];
                                            next[index].fee_cents = val;
                                            return next;
                                        });
                                    }}
                                />

                                {/* Delete */}
                                <button
                                    onClick={() => handleDeleteRule(index)}
                                    disabled={rules.length <= 1}
                                    className={`duration-200 p-1 ${
                                        rules.length <= 1 
                                        ? "text-gray-300 cursor-not-allowed" 
                                        : "text-gray-400  hover:text-red-600 cursor-pointer"
                                    }`}
                                >
                                    <FontAwesomeIcon icon={icons.faTrash} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <Button
                        onClick={handleAddRule}
                        variant="secondary"
                        className="mt-6 w-full"
                    >
                        + Adicionar Faixa
                    </Button>
                </div>

                {/* Pedido mínimo */}
                <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                    <h2 className="text-xl font-semibold mb-3 flex items-center gap-2">
                        Pedido Mínimo{" "}
                        <Tooltip text="O valor mínimo para alguém pedir no seu restaurante.">
                            <FontAwesomeIcon
                                icon={icons.faCircleInfo}
                                className="text-gray-700 text-sm cursor-help"
                            />
                        </Tooltip>
                    </h2>

                    <Input
                        numeric
                        icon={<FontAwesomeIcon icon={icons.faDollarSign} />}
                        iconPosition="left"
                        defaultValue="15"
                        ref={minOrderRef}
                        className="w-full"
                        onChange={() => {
                            if (!isNew) {
                                // Trigger autosave
                                setRules((r) => [...r]);
                            }
                        }}
                    />
                </div>
            </div>
        );
    }
);

DeliveryRules.displayName = "DeliveryRules";

export default DeliveryRules;