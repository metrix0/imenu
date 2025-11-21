// components/restaurante/configuracoes/TempoeTaxa.tsx
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

// Definindo o tipo de referência que o Pai vai acessar
export type DeliveryRulesRef = {
    save: () => Promise<void>;
};

type DeliveryRulesProps = {
    restaurantId: string;
    isNew: boolean;
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
        // EXPOSE SAVE FUNCTION TO PARENT
        // ---------------------------------------------------
        useImperativeHandle(ref, () => ({
            save: async () => {
                await saveToDB();
            },
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
                return;
            }

            // Defaults for NEW restaurants
            if (isNew) {
                console.log("[INIT] Using default rules for NEW restaurant.");
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

            // Load from DB
            console.log("[INIT] Fetching from SUPABASE...");
            const load = async () => {
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
                    setRules(
                        data.delivery_fee_json.map((r: any) => ({
                            radius_km: r.radius_km,
                            time_minutes: r.time_minutes,
                            fee_cents: r.fee_cents ?? null,
                        }))
                    );
                }

                if (data?.min_order_cents != null && minOrderRef.current) {
                    minOrderRef.current.value = String(data.min_order_cents / 100);
                }
            };

            load();
        }, [restaurantId, isNew]);

        // ---------------------------------------------------
        // REALTIME SYNC (verbose)
        // ---------------------------------------------------
        useEffect(() => {
            if (isNew) return; // realtime only in painel
            if (!restaurantId) return;

            console.log("[REALTIME] Subscribing to restaurant:", restaurantId);

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
                        console.log(
                            "%c[REALTIME] UPDATE RECEIVED",
                            "color: #22c55e; font-weight: bold;"
                        );
                        console.log(payload);

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
                .subscribe((status) => {
                    console.log("[REALTIME] Subscription status:", status);
                });

            return () => {
                console.log("[REALTIME] Unsubscribing channel.");
                supabase.removeChannel(channel);
            };
        }, [restaurantId, isNew]);

        // ---------------------------------------------------
        // ADD RULE
        // ---------------------------------------------------
        const handleAddRule = () => {
            setRules((prev) => {
                const last = prev[prev.length - 1];
                return [
                    ...prev,
                    {
                        radius_km: last ? last.radius_km + 0.5 : 0.5,
                        time_minutes: last ? last.time_minutes : 40,
                        fee_cents: null,
                    },
                ];
            });
        };

        // ---------------------------------------------------
        // DELETE RULE
        // ---------------------------------------------------
        const handleDeleteRule = (i: number) => {
            setRules((prev) => prev.filter((_, idx) => idx !== i));
        };

        // ---------------------------------------------------
        // SAVE TO DB + ZUSTAND
        // ---------------------------------------------------
        const saveToDB = async () => {
            console.log("[AUTOSAVE] Saving to DB...");

            // Build final object
            const finalRules = rules.map((r) => ({
                radius_km: r.radius_km,
                time_minutes: r.time_minutes,
                fee_cents: r.fee_cents,
            }));

            const minOrderValue = minOrderRef.current
                ? parseFloat(minOrderRef.current.value) || 15
                : 15;

            // ZUSTAND
            setDeliveryRules(restaurantId, finalRules);
            setMinOrder(restaurantId, minOrderValue);

            // DB
            const { error } = await supabase
                .from("restaurants")
                .update({
                    delivery_fee_json: finalRules,
                    min_order_cents: minOrderValue * 100,
                })
                .eq("id", restaurantId);

            if (error) {
                console.error("[AUTOSAVE] Error saving:", error);
            } else {
                console.log("%c[AUTOSAVE] Saved successfully!", "color:#22c55e;");
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
                setStatus("saved");
            }, 500);

            return () => clearTimeout(timeout);
        }, [rules]);

        // ---------------------------------------------------
        // UI
        // ---------------------------------------------------
        return (
            <div className="max-w-2xl mx-auto ">
                <div className="mb-8 text-center sm:text-left">
                    <h1 className="text-3xl font-bold mb-3">Tempo e Taxa de Entrega</h1>
                    <p className="text-gray-500 mt-1">Agora, recomendamos essa taxa e tempo de entrega</p>
                </div>
                {!isNew && (
                    <p className="text-sm text-gray-500 mb-3">
                        {status === "saved" ? "Tudo salvo ✓" : "Salvando…"}
                    </p>
                )}

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
                                    ref={(el) => (tempoRefs.current[index] = el)}
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
                                            ? ""
                                            : (rule.fee_cents / 100)
                                                .toFixed(2)
                                                .replace(".", ",")
                                    }
                                    ref={(el) => (taxaRefs.current[index] = el)}
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
                                    className="text-red hover:text-red-900 cursor-pointer duration-200 p-1"
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
                                // force autosave for minOrder
                                setRules((r) => [...r]);
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