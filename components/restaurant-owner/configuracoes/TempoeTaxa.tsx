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
import { supabase } from "@/lib/database/supabaseClient";

type RadiusRule = {
    radius_km: number;
    time_minutes: number;
    fee_cents: number | null;
};

export type DeliveryRulesRef = {
    save: () => Promise<void>;
    getRulesSnapshot: () => { rules: RadiusRule[]; minOrder: number };
};

type DeliveryRulesProps = {
    restaurantId: string;
    isNew: boolean;
    initialRules?: any;
    initialMinOrder?: any;
};

const DeliveryRules = forwardRef<DeliveryRulesRef, DeliveryRulesProps>(
    ({ restaurantId, isNew }, ref) => {
        const router = useRouter();

        const {
            deliveryRules,
            minOrder,
            setDeliveryRules,
            setMinOrder,
        } = useRestauranteConfig();

        const [rules, setRules] = useState<RadiusRule[]>([]);
        const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");

        const minOrderRef = useRef<HTMLInputElement>(null);
        const tempoRefs = useRef<Record<number, HTMLInputElement | null>>({});
        const taxaRefs = useRef<Record<number, HTMLInputElement | null>>({});

        useEffect(() => {
            const handleBeforeUnload = (e: BeforeUnloadEvent) => {
                if (status === "saving") {
                    e.preventDefault();
                    e.returnValue = "";
                }
            };
            window.addEventListener("beforeunload", handleBeforeUnload);
            return () => window.removeEventListener("beforeunload", handleBeforeUnload);
        }, [status]);

        useImperativeHandle(ref, () => ({
            save: async () => {
                await saveToDB(true);
            },
            getRulesSnapshot: () => {
                const rawVal = minOrderRef.current?.value || "0";
                const minOrderValue = parseFloat(rawVal.replace(",", ".")) || 0;
                return {
                    rules: rules,
                    minOrder: minOrderValue
                };
            }
        }));

        // ---------------------------------------------------
        // INITIAL LOAD
        // ---------------------------------------------------
        useEffect(() => {
            if (!restaurantId) return;

            console.log("[INIT] Loading rules for restaurant:", restaurantId);

            const cachedRules = deliveryRules[restaurantId];
            const cachedMin = minOrder[restaurantId];

            // 1. Tenta Cache do Zustand
            if (cachedRules && cachedRules.length > 0) {
                console.log("[INIT] Loaded from ZUSTAND cache.");
                setRules(cachedRules);
                if (cachedMin != null && minOrderRef.current) {
                    minOrderRef.current.value = String(cachedMin);
                }
                // Mesmo com cache, buscamos do banco para garantir consistência (especialmente o min_order criado no registro)
                fetchFromDB(); 
                return;
            }

            // 2. Busca do Banco (Sempre, para garantir que pegamos o min_order 1500)
            fetchFromDB();
        }, [restaurantId]); // Removi isNew da dependência para simplificar

        const fetchFromDB = async () => {
            if (!restaurantId || restaurantId === "undefined") return;

            console.log("[INIT] Fetching from SUPABASE...");
            const { data, error } = await supabase
                .from("restaurants")
                .select("delivery_fee_json, min_order_cents")
                .eq("id", restaurantId)
                .single();

            if (error) {
                console.error("[INIT] Error fetching:", error);
                return;
            }

            // --- Lógica de Regras de Entrega ---
            if (data?.delivery_fee_json && Array.isArray(data.delivery_fee_json) && data.delivery_fee_json.length > 0) {
                console.log("[INIT] Loaded rules from DB.");
                setRules(
                    data.delivery_fee_json.map((r: any) => ({
                        radius_km: r.radius_km,
                        time_minutes: r.time_minutes,
                        fee_cents: r.fee_cents ?? null,
                    }))
                );
            } else if (isNew) {
                // Se não tem regras no banco e é novo, aplica defaults
                console.log("[INIT] Applying default rules for NEW restaurant.");
                const defaults: RadiusRule[] = [
                    { radius_km: 0.5, time_minutes: 40, fee_cents: 800 },
                    { radius_km: 1, time_minutes: 40, fee_cents: 800 },
                    { radius_km: 1.5, time_minutes: 40, fee_cents: 800 },
                    { radius_km: 2, time_minutes: 40, fee_cents: 800 },
                    { radius_km: 3, time_minutes: 50, fee_cents: 800 },
                    { radius_km: 4, time_minutes: 50, fee_cents: 800 },
                    { radius_km: 5, time_minutes: 50, fee_cents: 800 },
                ];
                setRules(defaults);
            }

            // --- Lógica de Pedido Mínimo (Onde estava o erro) ---
            if (data?.min_order_cents != null && minOrderRef.current) {
                // Converte centavos para reais (2000 -> 20.00)
                // Se o valor for 0 (erro antigo), forçamos 20 para corrigir visualmente
                const val = data.min_order_cents === 0 ? 20 : data.min_order_cents / 100;
                minOrderRef.current.value = String(val);
                console.log("[INIT] Set min order from DB:", val);
            } else if (isNew && minOrderRef.current) {
                // Fallback final se o banco vier nulo
                minOrderRef.current.value = "20";
            }
        };

        // ... (REALTIME SYNC MANTIDO IGUAL) ...
        useEffect(() => {
            if (isNew) return;
            if (!restaurantId) return;

            const channel = supabase
                .channel(`realtime:restaurants:${restaurantId}`)
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "restaurants",
                        filter: `id=eq.${restaurantId}`,
                    },
                    (payload) => {
                        const d = payload.new;
                        if (d.delivery_fee_json) {
                            setRules(
                                d.delivery_fee_json.map((r: any) => ({
                                    radius_km: r.radius_km,
                                    time_minutes: r.time_minutes,
                                    fee_cents: r.fee_cents ?? null,
                                }))
                            );
                        }
                        if (d.min_order_cents != null && minOrderRef.current) {
                            // Cuidado com loops infinitos aqui se o input estiver focado
                            // Idealmente só atualiza se for muito diferente
                             if (document.activeElement !== minOrderRef.current) {
                                 minOrderRef.current.value = String(d.min_order_cents / 100);
                             }
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }, [restaurantId, isNew]);


        // ... (ADD/DELETE RULE MANTIDOS IGUAIS) ...
        const handleAddRule = () => {
            setRules((prev) => {
                const existingRadii = new Set(prev.map((r) => r.radius_km));
                let nextRadius = 0.5;
                while (existingRadii.has(nextRadius)) nextRadius += 0.5;

                const lastRule = prev.length > 0 ? prev[prev.length - 1] : null;
                const defaultTime = lastRule ? lastRule.time_minutes : 40;
                const defaultFee = lastRule ? lastRule.fee_cents : 800;

                const newRules = [
                    ...prev,
                    { radius_km: nextRadius, time_minutes: defaultTime, fee_cents: defaultFee },
                ];
                return newRules.sort((a, b) => a.radius_km - b.radius_km);
            });
        };

        const handleDeleteRule = (i: number) => {
            setRules((prev) => {
                if (prev.length <= 1) return prev;
                return prev.filter((_, idx) => idx !== i);
            });
        };

        // ---------------------------------------------------
        // SAVE TO DB + ZUSTAND
        // ---------------------------------------------------
        const saveToDB = async (force = false) => {
            // Se for novo e não for save forçado (autosave), ignora
            if (isNew && !force) return;
            
            // PROTEÇÃO CONTRA ID INVÁLIDO
            if (!restaurantId || restaurantId === "undefined") {
                console.error("Tentativa de salvar sem ID válido");
                return;
            }

            setStatus("saving");

            const finalRules = rules.map((r) => ({
                radius_km: r.radius_km,
                time_minutes: r.time_minutes,
                fee_cents: r.fee_cents,
            }));

            // Parsing robusto para garantir que não envie 0 acidentalmente
            let rawMinOrder = minOrderRef.current?.value || "0";
            rawMinOrder = rawMinOrder.replace(",", "."); // Troca vírgula por ponto
            let minOrderValue = parseFloat(rawMinOrder);
            
            if (isNaN(minOrderValue)) minOrderValue = 0;

            console.log("Saving minOrder:", minOrderValue, "-> cents:", Math.round(minOrderValue * 100));

            // ZUSTAND
            setDeliveryRules(restaurantId, finalRules);
            setMinOrder(restaurantId, minOrderValue);

            try {
                // MUDANÇA PRINCIPAL: Usando a API correta
                const res = await fetch(`/api/restaurants/${restaurantId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        delivery_fee_json: finalRules,
                        min_order_cents: Math.round(minOrderValue * 100),
                    }),
                });

                if (!res.ok) {
                    const err = await res.json();
                    throw new Error(err.error || "Error saving");
                }

                setStatus("saved");
            } catch (error: any) {
                console.error("[AUTOSAVE] Error saving:", error);
                setStatus("idle");
                throw error; // Propaga o erro para o pai ver
            }
        };

        // ---------------------------------------------------
        // AUTOSAVE (only when NOT new)
        // ---------------------------------------------------
        useEffect(() => {
            if (isNew) return;

            setStatus("saving");

            const timeout = setTimeout(async () => {
                await saveToDB();
                setStatus("saved"); // saveToDB já seta, mas ok manter
            }, 500);

            return () => clearTimeout(timeout);
        }, [rules]);

        // ---------------------------------------------------
        // UI
        // ---------------------------------------------------
        return (
            <div className="max-w-2xl 2xl:max-w-3xl mx-auto ">

                {/* SÓ MOSTRA O STATUS SE NÃO FOR NOVO (PAINEL) */}
                <div className="flex justify-end mb-2 2xl:mb-3 h-6" >
                    {!isNew && (
                        <div className="text-sm 2xl:text-lg font-medium h-6 flex items-center mb-4 transition-opacity duration-300">
                            {status === "saving" ? (
                                <span className="text-brand animate-pulse">Salvando...</span>
                            ) : status === "saved" ? (
                                <span className="text-green-600 flex items-center gap-1">
                                    <FontAwesomeIcon icon={icons.faCheck} className="text-xs" /> Tudo salvo
                                </span>
                            ) : null}
                        </div>
                    )}
                </div>

                {/* DELIVERY RULES */}
                <div className="p-6 bg-white 2xl:p-10 border border-gray-200 rounded-lg shadow-sm mb-8">
                    <div className="flex items-center gap-4 mb-2 2xl:mb-4 px-2">
                        <span className="w-1/3 flex items-center gap-2 text-sm 2xl:text-lg font-medium text-gray-700">
                            <FontAwesomeIcon icon={faBullseye} /> Raio
                        </span>
                        <span className="w-1/3 flex items-center gap-2 text-sm 2xl:text-lg font-medium text-gray-700">
                            <FontAwesomeIcon icon={faClock} /> Tempo
                        </span>
                        <span className="w-1/3 flex items-center gap-2 text-sm 2xl:text-lg font-medium text-gray-700">
                            <FontAwesomeIcon icon={icons.faDollarSign} /> Taxa
                        </span>
                        <span className="w-8"></span>
                    </div>

                    <div className="space-y-3 2xl:space-y-5 2xl:text-lg">
                        {rules.map((rule, index) => (
                            <div key={index} className="flex items-center gap-4 2xl:gap-7 p-2">
                                {/* Raio */}
                                <div className="w-1/3 text-gray-700 font-medium">
                                    {rule.radius_km} km
                                </div>

                                {/* Tempo */}
                                <Input
                                    numeric
                                    icon="min"
                                    iconPosition="right"
                                    className="w-1/3"
                                    defaultValue={rule.time_minutes}
                                    ref={(el) => { tempoRefs.current[index] = el; }}
                                    onChange={(e) => {
                                        const val = parseInt(e.target.value || "0");
                                        setRules((prev) => {
                                            const next = [...prev];
                                            next[index].time_minutes = val;
                                            return next;
                                        });
                                    }}
                                />
                                <Input
                                    float
                                    icon={<FontAwesomeIcon icon={icons.faDollarSign} />}
                                    iconPosition="left"
                                    className="w-1/3"
                                    defaultValue={
                                        rule.fee_cents === null
                                            ? "0,00"
                                            : (rule.fee_cents / 100)
                                                .toFixed(2)
                                                .replace(".", ",")
                                    }
                                    ref={(el) => { taxaRefs.current[index] = el; }}
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
                                    
                                    className={"p-1 duration-200  text-red hover:text-red-900 cursor-pointer"}
                                >
                                    <FontAwesomeIcon icon={icons.faTrash} />
                                </button>

                            </div>
                        ))}
                    </div>

                    <Button
                        onClick={handleAddRule}
                        variant="secondary"
                        className="mt-6 w-full 2xl:text-base"
                    >
                        + Adicionar Faixa
                    </Button>
                </div>

                {/* Pedido mínimo */}
                
                    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                        <h2 className="text-xl font-semibold mb-3">
                            Pedido Mínimo
                            <Tooltip text="O valor mínimo para alguém pedir no seu restaurante.">
                                <FontAwesomeIcon
                                    icon={icons.faCircleInfo}
                                    className="text-gray-700 text-sm"
                                />
                            </Tooltip>
                        </h2>
                        <Input
                            numeric
                            icon={<FontAwesomeIcon icon={icons.faDollarSign} />}
                            iconPosition="left"
                            defaultValue="20"
                            ref={minOrderRef}
                            className="w-full"
                            onChange={() => {
                                // Força re-render para disparar autosave no useEffect[rules] se necessário,
                                // mas idealmente autosave deveria depender de minOrder também se quiser salvar ao digitar.
                                // Como seu useEffect[rules] só olha rules, o minOrder só salva quando muda regra ou clica em Salvar.
                            }}
                        />
                    </div>
               
            </div>
        );
    }
);

DeliveryRules.displayName = "DeliveryRules";
export default DeliveryRules;