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

// Definindo o tipo de referência que o Pai vai acessar
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

        // LOCAL INPUT REFS — used only for initial fallback read
        const tempoRefs = useRef<Record<number, HTMLInputElement | null>>({});
        const taxaRefs = useRef<Record<number, HTMLInputElement | null>>({});

        // ---------------------------------------------------
        // EXPOSE FUNCTIONS TO PARENT
        // ---------------------------------------------------
        useImperativeHandle(ref, () => ({
            save: async () => {
                await saveToDB(true);
            },
            getRulesSnapshot: () => {
                const minOrderValue = minOrderRef.current
                    ? parseFloat(minOrderRef.current.value) || 0
                    : 0;
                return {
                    rules: rules,
                    minOrder: minOrderValue
                };
            }
        }));

        // ---------------------------------------------------
        // INITIAL LOAD (ZUSTAND -> DEFAULT -> SUPABASE)
        // ---------------------------------------------------
        useEffect(() => {
            if (!restaurantId) return;

            console.log("[INIT] Loading rules for restaurant:", restaurantId);

            const cachedRules = deliveryRules[restaurantId];
            const cachedMin = minOrder[restaurantId];

            // Zustand cache
            if (cachedRules && cachedRules.length > 0) {
                console.log("[INIT] Loaded from ZUSTAND cache.");
                setRules(cachedRules);

                if (cachedMin != null && minOrderRef.current) {
                    minOrderRef.current.value = String(cachedMin);
                }
                // Se não for novo, busca do banco para garantir sync
                if (!isNew) fetchFromDB();
                return;
            }

            // Defaults for NEW restaurants
            if (isNew) {
                console.log("[INIT] Using default rules for NEW restaurant.");
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
                if (minOrderRef.current) minOrderRef.current.value = "1500"; // Nota: Seu original usa 1500 (centavos?) ou valor bruto. Mantive.
                return;
            }

            // Load from DB if not cached and not new
            fetchFromDB();
        }, [restaurantId, isNew]); // MANTIDO CONFORME ORIGINAL

        const fetchFromDB = async () => {
            if (!restaurantId || restaurantId === "undefined") return;

            console.log("[INIT] Fetching from SUPABASE...");
            // Use a API unificada em vez de supabase client direto se preferir consistência, 
            // mas mantive supabase client pois é leitura e seu original usava.
            const { data, error } = await supabase
                .from("restaurants")
                .select("delivery_fee_json, min_order_cents")
                .eq("id", restaurantId)
                .single();

            if (error) {
                console.error("[INIT] Error fetching:", error);
                return;
            }

            if (data?.delivery_fee_json) {
                console.log("[INIT] Loaded rules from DB.");
                // Garantir array
                const loadedRules = Array.isArray(data.delivery_fee_json) ? data.delivery_fee_json : [];
                setRules(
                    loadedRules.map((r: any) => ({
                        radius_km: r.radius_km,
                        time_minutes: r.time_minutes,
                        fee_cents: r.fee_cents ?? null,
                    }))
                );
            }

            if (data?.min_order_cents != null && minOrderRef.current) {
                // Ajuste aqui se precisar de formatação (/100) ou valor bruto
                minOrderRef.current.value = String(data.min_order_cents / 100); 
            }
        };

        // ---------------------------------------------------
        // REALTIME SYNC
        // ---------------------------------------------------
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
                            minOrderRef.current.value = String(d.min_order_cents / 100);
                        }
                    }
                )
                .subscribe();

            return () => {
                supabase.removeChannel(channel);
            };
        }, [restaurantId, isNew]);

        // ---------------------------------------------------
        // ADD RULE (LOGIC UPDATE - FIX GAPS)
        // ---------------------------------------------------
        const handleAddRule = () => {
            setRules((prev) => {
                const last = prev[prev.length - 1];
                const nextRadius = last ? last.radius_km + 0.5 : 0.5;

                const newRule = {
                    radius_km: nextRadius,
                    time_minutes: last ? last.time_minutes : 40,
                    fee_cents: last ? last.fee_cents : 800,
                };

                return [...prev, newRule];
            });
        };


        // ---------------------------------------------------
        // DELETE RULE (LOGIC UPDATE - MIN 1)
        // ---------------------------------------------------
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

            const minOrderValue = minOrderRef.current
                ? parseFloat(minOrderRef.current.value) || 0
                : 0;

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
                        min_order_cents: minOrderValue * 100, // Ajuste se seu backend espera centavos
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
            <div className="max-w-2xl mx-auto ">

                {/* SÓ MOSTRA O STATUS SE NÃO FOR NOVO (PAINEL) */}
                <div className="flex justify-end mb-2 h-6" >
                    {!isNew && (
                        <div className="text-sm font-medium h-6 flex items-center mb-4 transition-opacity duration-300">
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
                <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                    <div className="flex items-center gap-4 mb-2 px-2">
                        <span className="w-1/3 flex items-center gap-2 text-sm font-medium text-gray-700">
                            <FontAwesomeIcon icon={faBullseye} /> Raio
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

                                {/* Taxa */}
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
                                    ref={(el) => { tempoRefs.current[index] = el; }}
                                    onChange={(e) => {
                                        const raw = e.target.value;
                                        const val =
                                            raw && raw !== "0,00"
                                                ? Math.round(
                                                    parseFloat(raw.replace(",", ".")) * 100
                                                )
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
                                    className={`p-1 duration-200 ${
                                        rules.length <= 1
                                            ? "text-gray-300 cursor-not-allowed"
                                            : "text-red hover:text-red-900 cursor-pointer"
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
                {!isNew && (
                    <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                        <h2 className="text-xl font-semibold mb-3">
                            Pedido Mínimo{" "}
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
                            defaultValue="15"
                            ref={minOrderRef}
                            className="w-full"
                            onChange={() => {
                                if (!isNew) {
                                    setRules((r) => [...r]);
                                }
                            }}
                        />
                    </div>
                )}
            </div>
        );
    }
);

DeliveryRules.displayName = "DeliveryRules";

export default DeliveryRules;