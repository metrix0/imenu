"use client";

import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";

import { useRestauranteConfig } from "@/lib/stores/restaurant-owner/RestauranteConfiguracoesZustand";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faBullseye, faClock } from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import { supabase } from "@/lib/database/supabaseClient";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ToggleInput from "@/components/ui/ToggleInput";
import Tooltip from "@/components/ui/Tooltip";

type RadiusRule = {
    radius_km: number;
    time_minutes: number;
    fee_cents: number | null;
};

export type DeliveryRulesRef = {
    save: () => Promise<void>;
    getRulesSnapshot: () => {
        rules: RadiusRule[];
        minOrder: number;
    };
};

type DeliveryRulesProps = {
    restaurantId: string;
    isNew: boolean;
    initialRules?: unknown;
    initialMinOrder?: unknown;
};

const DEFAULT_RULES: RadiusRule[] = [
    { radius_km: 0.5, time_minutes: 40, fee_cents: 800 },
    { radius_km: 1, time_minutes: 40, fee_cents: 800 },
    { radius_km: 1.5, time_minutes: 40, fee_cents: 800 },
    { radius_km: 2, time_minutes: 40, fee_cents: 800 },
    { radius_km: 3, time_minutes: 50, fee_cents: 800 },
    { radius_km: 4, time_minutes: 50, fee_cents: 800 },
    { radius_km: 5, time_minutes: 50, fee_cents: 800 },
];

const DeliveryRules = forwardRef<DeliveryRulesRef, DeliveryRulesProps>(
    ({ restaurantId, isNew }, ref) => {
        const {
            deliveryRules,
            minOrder,
            setDeliveryRules,
            setMinOrder,
        } = useRestauranteConfig();

        const [rules, setRules] = useState<RadiusRule[]>([]);
        const [pickupEnabled, setPickupEnabled] = useState(false);
        const [initialDataLoaded, setInitialDataLoaded] = useState(false);
        const [minOrderRevision, setMinOrderRevision] = useState(0);
        const [status, setStatus] = useState<
            "idle" | "saving" | "saved"
        >("idle");

        const minOrderRef = useRef<HTMLInputElement>(null);
        const tempoRefs = useRef<
            Record<number, HTMLInputElement | null>
        >({});
        const taxaRefs = useRef<
            Record<number, HTMLInputElement | null>
        >({});

        useEffect(() => {
            const handleBeforeUnload = (event: BeforeUnloadEvent) => {
                if (status === "saving") {
                    event.preventDefault();
                    event.returnValue = "";
                }
            };

            window.addEventListener(
                "beforeunload",
                handleBeforeUnload
            );

            return () =>
                window.removeEventListener(
                    "beforeunload",
                    handleBeforeUnload
                );
        }, [status]);

        const fetchFromDB = async () => {
            if (
                !restaurantId ||
                restaurantId === "undefined"
            ) {
                return;
            }

            const { data, error } = await supabase
                .from("restaurants")
                .select(
                    "delivery_fee_json, min_order_cents, pickup_enabled"
                )
                .eq("id", restaurantId)
                .single();

            if (error) {
                console.error(
                    "[TEMPO_E_TAXA] Erro ao carregar:",
                    error
                );
                setInitialDataLoaded(true);
                return;
            }

            if (
                Array.isArray(data?.delivery_fee_json) &&
                data.delivery_fee_json.length > 0
            ) {
                setRules(
                    data.delivery_fee_json.map((rule: any) => ({
                        radius_km: Number(rule.radius_km),
                        time_minutes: Number(rule.time_minutes),
                        fee_cents:
                            rule.fee_cents === null ||
                            rule.fee_cents === undefined
                                ? null
                                : Number(rule.fee_cents),
                    }))
                );
            } else if (isNew) {
                setRules(DEFAULT_RULES);
            }

            if (
                data?.min_order_cents !== null &&
                data?.min_order_cents !== undefined &&
                minOrderRef.current
            ) {
                const value =
                    data.min_order_cents === 0
                        ? 20
                        : data.min_order_cents / 100;

                minOrderRef.current.value = String(value);
            } else if (isNew && minOrderRef.current) {
                minOrderRef.current.value = "20";
            }

            setPickupEnabled(data?.pickup_enabled === true);
            setInitialDataLoaded(true);
        };

        useEffect(() => {
            if (!restaurantId) return;

            const cachedRules = deliveryRules[restaurantId];
            const cachedMinOrder = minOrder[restaurantId];

            if (
                Array.isArray(cachedRules) &&
                cachedRules.length > 0
            ) {
                setRules(cachedRules);

                if (
                    cachedMinOrder !== null &&
                    cachedMinOrder !== undefined &&
                    minOrderRef.current
                ) {
                    minOrderRef.current.value =
                        String(cachedMinOrder);
                }
            }

            void fetchFromDB();
        }, [restaurantId]);

        useEffect(() => {
            if (isNew || !restaurantId) return;

            const channel = supabase
                .channel(
                    `realtime:restaurants:${restaurantId}`
                )
                .on(
                    "postgres_changes",
                    {
                        event: "UPDATE",
                        schema: "public",
                        table: "restaurants",
                        filter: `id=eq.${restaurantId}`,
                    },
                    (payload) => {
                        const updated = payload.new as any;

                        if (
                            Array.isArray(
                                updated.delivery_fee_json
                            )
                        ) {
                            setRules(
                                updated.delivery_fee_json.map(
                                    (rule: any) => ({
                                        radius_km: Number(
                                            rule.radius_km
                                        ),
                                        time_minutes: Number(
                                            rule.time_minutes
                                        ),
                                        fee_cents:
                                            rule.fee_cents ===
                                                null ||
                                            rule.fee_cents ===
                                                undefined
                                                ? null
                                                : Number(
                                                      rule.fee_cents
                                                  ),
                                    })
                                )
                            );
                        }

                        if (
                            updated.min_order_cents !== null &&
                            updated.min_order_cents !==
                                undefined &&
                            minOrderRef.current &&
                            document.activeElement !==
                                minOrderRef.current
                        ) {
                            minOrderRef.current.value = String(
                                updated.min_order_cents / 100
                            );
                        }

                        if (
                            typeof updated.pickup_enabled ===
                            "boolean"
                        ) {
                            setPickupEnabled(
                                updated.pickup_enabled
                            );
                        }
                    }
                )
                .subscribe();

            return () => {
                void supabase.removeChannel(channel);
            };
        }, [restaurantId, isNew]);

        const handleAddRule = () => {
            setRules((currentRules) => {
                const lastRadius = currentRules.length > 0
                    ? Math.max(...currentRules.map((rule) => Number(rule.radius_km) || 0))
                    : 0;
                const nextRadius = lastRadius + 1;

                const lastRule =
                    currentRules.length > 0
                        ? currentRules[
                              currentRules.length - 1
                          ]
                        : null;

                return [
                    ...currentRules,
                    {
                        radius_km: nextRadius,
                        time_minutes:
                            lastRule?.time_minutes ?? 40,
                        fee_cents:
                            lastRule?.fee_cents ?? 800,
                    },
                ].sort(
                    (first, second) =>
                        first.radius_km -
                        second.radius_km
                );
            });
        };

        const handleDeleteRule = (index: number) => {
            setRules((currentRules) => {
                if (currentRules.length <= 1) {
                    return currentRules;
                }

                return currentRules.filter(
                    (_, currentIndex) =>
                        currentIndex !== index
                );
            });
        };

        const saveToDB = async (force = false) => {
            if (isNew && !force) return;

            if (
                !restaurantId ||
                restaurantId === "undefined"
            ) {
                throw new Error(
                    "Restaurante não identificado."
                );
            }

            setStatus("saving");

            const finalRules = rules.map((rule) => ({
                radius_km: rule.radius_km,
                time_minutes: rule.time_minutes,
                fee_cents: rule.fee_cents,
            }));

            const rawMinOrder = (
                minOrderRef.current?.value || "0"
            ).replace(",", ".");

            const parsedMinOrder =
                Number.parseFloat(rawMinOrder);
            const minOrderValue = Number.isFinite(
                parsedMinOrder
            )
                ? parsedMinOrder
                : 0;

            setDeliveryRules(
                restaurantId,
                finalRules
            );
            setMinOrder(
                restaurantId,
                minOrderValue
            );

            try {
                const response = await fetch(
                    `/api/restaurants/${restaurantId}`,
                    {
                        method: "PATCH",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            delivery_fee_json:
                                finalRules,
                            min_order_cents:
                                Math.round(
                                    minOrderValue * 100
                                ),
                            pickup_enabled:
                                pickupEnabled,
                        }),
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result?.error ||
                            "Erro ao salvar configurações."
                    );
                }

                setStatus("saved");
            } catch (error) {
                console.error(
                    "[TEMPO_E_TAXA] Erro ao salvar:",
                    error
                );
                setStatus("idle");
                throw error;
            }
        };

        useImperativeHandle(ref, () => ({
            save: async () => {
                await saveToDB(true);
            },
            getRulesSnapshot: () => {
                const rawValue =
                    minOrderRef.current?.value || "0";

                const parsedValue = Number.parseFloat(
                    rawValue.replace(",", ".")
                );

                return {
                    rules,
                    minOrder: Number.isFinite(parsedValue)
                        ? parsedValue
                        : 0,
                };
            },
        }));

        useEffect(() => {
            if (
                isNew ||
                !initialDataLoaded
            ) {
                return;
            }

            setStatus("saving");

            const timeout = window.setTimeout(() => {
                void saveToDB().catch(() => {
                    // saveToDB already handles the UI state.
                });
            }, 500);

            return () =>
                window.clearTimeout(timeout);
        }, [
            rules,
            pickupEnabled,
            minOrderRevision,
            initialDataLoaded,
            isNew,
        ]);

        return (
            <div className="max-w-2xl 2xl:max-w-3xl mx-auto">
                <div className="flex justify-end mb-2 2xl:mb-3 h-6">
                    {!isNew && (
                        <div className="text-sm 2xl:text-lg font-medium h-6 flex items-center mb-4 transition-opacity duration-300">
                            {status === "saving" ? (
                                <span className="text-brand animate-pulse">
                                    Salvando...
                                </span>
                            ) : status === "saved" ? (
                                <span className="text-green-600 flex items-center gap-1">
                                    <FontAwesomeIcon
                                        icon={icons.faCheck}
                                        className="text-xs"
                                    />
                                    Tudo salvo
                                </span>
                            ) : null}
                        </div>
                    )}
                </div>



                <div className="p-6 bg-white 2xl:p-10 border border-gray-200 rounded-lg shadow-sm mb-8">
                    <div className="flex items-center gap-4 mb-2 2xl:mb-4 px-2">
                        <span className="w-1/3 flex items-center gap-2 text-sm 2xl:text-lg font-medium text-gray-700">
                            <FontAwesomeIcon
                                icon={faBullseye}
                            />
                            Raio
                        </span>

                        <span className="w-1/3 flex items-center gap-2 text-sm 2xl:text-lg font-medium text-gray-700">
                            <FontAwesomeIcon
                                icon={faClock}
                            />
                            Tempo
                        </span>

                        <span className="w-1/3 flex items-center gap-2 text-sm 2xl:text-lg font-medium text-gray-700">
                            <FontAwesomeIcon
                                icon={
                                    icons.faDollarSign
                                }
                            />
                            Taxa
                        </span>

                        <span className="w-8" />
                    </div>

                    <div className="space-y-3 2xl:space-y-5 2xl:text-lg">
                        {rules.map((rule, index) => (
                            <div
                                key={rule.radius_km}
                                className="flex items-center gap-4 2xl:gap-7 p-2"
                            >
                                <div className="w-1/3 text-gray-700 font-medium">
                                    {rule.radius_km} km
                                </div>

                                <Input
                                    numeric
                                    icon="min"
                                    iconPosition="right"
                                    className="w-1/3"
                                    defaultValue={
                                        rule.time_minutes
                                    }
                                    ref={(element) => {
                                        tempoRefs.current[
                                            index
                                        ] = element;
                                    }}
                                    onChange={(event) => {
                                        const value =
                                            Number.parseInt(
                                                event.target
                                                    .value ||
                                                    "0",
                                                10
                                            );

                                        setRules(
                                            (
                                                currentRules
                                            ) =>
                                                currentRules.map(
                                                    (
                                                        currentRule,
                                                        currentIndex
                                                    ) =>
                                                        currentIndex ===
                                                        index
                                                            ? {
                                                                  ...currentRule,
                                                                  time_minutes:
                                                                      value,
                                                              }
                                                            : currentRule
                                                )
                                        );
                                    }}
                                />

                                <Input
                                    float
                                    icon={
                                        <FontAwesomeIcon
                                            icon={
                                                icons.faDollarSign
                                            }
                                        />
                                    }
                                    iconPosition="left"
                                    className="w-1/3"
                                    defaultValue={
                                        rule.fee_cents ===
                                        null
                                            ? "0,00"
                                            : (
                                                  rule.fee_cents /
                                                  100
                                              )
                                                  .toFixed(2)
                                                  .replace(
                                                      ".",
                                                      ","
                                                  )
                                    }
                                    ref={(element) => {
                                        taxaRefs.current[
                                            index
                                        ] = element;
                                    }}
                                    onChange={(event) => {
                                        const rawValue =
                                            event.target
                                                .value;

                                        const parsedValue =
                                            rawValue &&
                                            rawValue !==
                                                "0,00"
                                                ? Math.round(
                                                      Number.parseFloat(
                                                          rawValue.replace(
                                                              ",",
                                                              "."
                                                          )
                                                      ) *
                                                          100
                                                  )
                                                : null;

                                        setRules(
                                            (
                                                currentRules
                                            ) =>
                                                currentRules.map(
                                                    (
                                                        currentRule,
                                                        currentIndex
                                                    ) =>
                                                        currentIndex ===
                                                        index
                                                            ? {
                                                                  ...currentRule,
                                                                  fee_cents:
                                                                      Number.isFinite(
                                                                          parsedValue
                                                                      )
                                                                          ? parsedValue
                                                                          : null,
                                                              }
                                                            : currentRule
                                                )
                                        );
                                    }}
                                />

                                <button
                                    type="button"
                                    onClick={() =>
                                        handleDeleteRule(
                                            index
                                        )
                                    }
                                    className="p-1 duration-200 text-red hover:text-red-900 cursor-pointer"
                                    aria-label={`Excluir faixa de ${rule.radius_km} km`}
                                >
                                    <FontAwesomeIcon
                                        icon={icons.faTrash}
                                    />
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

                <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                    <h2 className="text-xl font-semibold mb-3">
                        Pedido Mínimo
                        <Tooltip text="O valor mínimo para alguém pedir no seu restaurante.">
                            <FontAwesomeIcon
                                icon={
                                    icons.faCircleInfo
                                }
                                className="text-gray-700 text-sm"
                            />
                        </Tooltip>
                    </h2>

                    <Input
                        numeric
                        icon={
                            <FontAwesomeIcon
                                icon={
                                    icons.faDollarSign
                                }
                            />
                        }
                        iconPosition="left"
                        defaultValue="20"
                        ref={minOrderRef}
                        onChange={() =>
                            setMinOrderRevision(
                                (currentRevision) =>
                                    currentRevision + 1
                            )
                        }
                        className="w-full"
                    />
                </div>

                <div className="p-6 bg-white border border-gray-200 rounded-lg shadow-sm mb-8">
                    <div className="flex items-center justify-between gap-6">
                        <div>
                            <h2 className="text-xl font-semibold">
                                Retirada no balcão
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Permita que o cliente escolha retirar o
                                pedido diretamente no restaurante.
                            </p>
                        </div>

                        <ToggleInput
                            checked={pickupEnabled}
                            onChange={(event) =>
                                setPickupEnabled(
                                    event.target.checked
                                )
                            }
                        />
                    </div>
                </div>
            </div>
        );
    }
);

DeliveryRules.displayName = "DeliveryRules";

export default DeliveryRules;
