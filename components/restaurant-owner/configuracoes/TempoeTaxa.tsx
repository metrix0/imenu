"use client";
import SaveStatus from "@/components/ui/SaveStatus";

import {
    forwardRef,
    useEffect,
    useImperativeHandle,
    useRef,
    useState,
} from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faLocationDot,
    faRoute,
    faTrash,
    faTriangleExclamation,
} from "@fortawesome/free-solid-svg-icons";

import RadiusDeliveryRules, {
    type DeliveryRulesRef as RadiusDeliveryRulesRef,
} from "./TempoeTaxaRadiusBase";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import WarningBox from "@/components/ui/WarningBox";
import { supabase } from "@/lib/database/supabaseClient";
import {
    parseNeighborhoodDeliveryRules,
    type DeliveryFeeMode,
    type NeighborhoodDeliveryRule,
} from "@/lib/delivery/neighborhood";

export type DeliveryRulesRef = RadiusDeliveryRulesRef;

type DeliveryRulesProps = {
    restaurantId: string;
    isNew: boolean;
    initialRules?: unknown;
    initialMinOrder?: unknown;
};

type EditableNeighborhoodRule = NeighborhoodDeliveryRule & {
    id: string;
};

function createRule(
    city = "",
    state = "",
    source?: Partial<NeighborhoodDeliveryRule>
): EditableNeighborhoodRule {
    return {
        id:
            typeof crypto !== "undefined" && "randomUUID" in crypto
                ? crypto.randomUUID()
                : `${Date.now()}-${Math.random()}`,
        neighborhood: source?.neighborhood || "",
        city: source?.city || city,
        state: source?.state || state,
        time_minutes: Number(source?.time_minutes ?? 40),
        fee_cents: Number(source?.fee_cents ?? 800),
        aliases: Array.isArray(source?.aliases) ? source.aliases : [],
    };
}

function moneyInput(cents: number) {
    return (Math.max(0, Number(cents) || 0) / 100)
        .toFixed(2)
        .replace(".", ",");
}

function parseMoneyInput(value: string) {
    const parsed = Number.parseFloat(value.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(parsed) ? Math.max(0, Math.round(parsed * 100)) : 0;
}

const DeliveryRules = forwardRef<DeliveryRulesRef, DeliveryRulesProps>(
    ({ restaurantId, isNew, initialRules, initialMinOrder }, ref) => {
        const radiusRef = useRef<RadiusDeliveryRulesRef>(null);
        const [mode, setMode] = useState<DeliveryFeeMode>("radius");
        const [rules, setRules] = useState<EditableNeighborhoodRule[]>([]);
        const [defaultCity, setDefaultCity] = useState("");
        const [defaultState, setDefaultState] = useState("");
        const [loaded, setLoaded] = useState(false);
        const [status, setStatus] = useState<"idle" | "saving" | "saved">(
            "idle"
        );
        const [error, setError] = useState<string | null>(null);

        useEffect(() => {
            if (!restaurantId) return;

            let active = true;

            const load = async () => {
                const { data, error: loadError } = await supabase
                    .from("restaurants")
                    .select(
                        "delivery_fee_mode, delivery_neighborhood_fee_json, address"
                    )
                    .eq("id", restaurantId)
                    .single();

                if (!active) return;
                if (loadError || !data) {
                    setLoaded(true);
                    return;
                }

                let address: any = data.address || {};
                if (typeof address === "string") {
                    try {
                        address = JSON.parse(address);
                    } catch {
                        address = {};
                    }
                }

                const city = String(address?.city || "").trim();
                const state = String(address?.state || "").trim().toUpperCase();
                const storedRules = parseNeighborhoodDeliveryRules(
                    data.delivery_neighborhood_fee_json
                );
                const storedMode: DeliveryFeeMode =
                    data.delivery_fee_mode === "neighborhood"
                        ? "neighborhood"
                        : "radius";

                setDefaultCity(city);
                setDefaultState(state);
                setMode(storedMode);
                setRules(
                    storedRules.length > 0
                        ? storedRules.map((rule) => createRule(city, state, rule))
                        : storedMode === "neighborhood"
                          ? [createRule(city, state)]
                          : []
                );
                setLoaded(true);
            };

            void load();

            return () => {
                active = false;
            };
        }, [restaurantId]);

        const validRules = () =>
            rules
                .filter(
                    (rule) =>
                        rule.neighborhood.trim() &&
                        Number.isFinite(rule.time_minutes) &&
                        rule.time_minutes >= 0 &&
                        Number.isFinite(rule.fee_cents) &&
                        rule.fee_cents >= 0
                )
                .map((rule) => ({
                    neighborhood: rule.neighborhood.trim(),
                    city: String(rule.city || "").trim() || null,
                    state: String(rule.state || "").trim().toUpperCase() || null,
                    time_minutes: Math.round(rule.time_minutes),
                    fee_cents: Math.round(rule.fee_cents),
                    aliases: rule.aliases || [],
                }));

        const saveNeighborhoodConfig = async (force = false) => {
            if (!restaurantId) {
                throw new Error("Restaurante não identificado.");
            }

            const normalizedRules = validRules();
            if (mode === "neighborhood" && normalizedRules.length === 0) {
                const message = "Adicione pelo menos um bairro para usar a entrega por bairro.";
                setError(message);
                if (force) throw new Error(message);
                return;
            }

            setError(null);
            setStatus("saving");

            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    delivery_fee_mode: mode,
                    delivery_neighborhood_fee_json: normalizedRules,
                }),
            });
            const result = await response.json();

            if (!response.ok) {
                setStatus("idle");
                const message =
                    result?.error || "Não foi possível salvar as regras por bairro.";
                setError(message);
                throw new Error(message);
            }

            setStatus("saved");
        };

        useEffect(() => {
            if (isNew || !loaded) return;

            if (mode === "neighborhood" && validRules().length === 0) {
                setStatus("idle");
                return;
            }

            setStatus("saving");
            const timeout = window.setTimeout(() => {
                void saveNeighborhoodConfig().catch(() => undefined);
            }, 600);

            return () => window.clearTimeout(timeout);
        }, [mode, rules, loaded, isNew]);

        useImperativeHandle(ref, () => ({
            save: async () => {
                await radiusRef.current?.save();
                await saveNeighborhoodConfig(true);
            },
            getRulesSnapshot: () =>
                radiusRef.current?.getRulesSnapshot() || {
                    rules: [],
                    minOrder: 0,
                },
        }));

        const changeMode = (nextMode: DeliveryFeeMode) => {
            setError(null);
            setMode(nextMode);

            if (nextMode === "neighborhood" && rules.length === 0) {
                setRules([createRule(defaultCity, defaultState)]);
            }
        };

        const updateRule = (
            id: string,
            changes: Partial<NeighborhoodDeliveryRule>
        ) => {
            setRules((current) =>
                current.map((rule) =>
                    rule.id === id ? { ...rule, ...changes } : rule
                )
            );
        };

        const addRule = () => {
            const previous = rules[rules.length - 1];
            setRules((current) => [
                ...current,
                createRule(
                    String(previous?.city || defaultCity),
                    String(previous?.state || defaultState),
                    {
                        time_minutes: previous?.time_minutes ?? 40,
                        fee_cents: previous?.fee_cents ?? 800,
                    }
                ),
            ]);
        };

        const deleteRule = (id: string) => {
            setRules((current) => {
                const next = current.filter((rule) => rule.id !== id);
                return next.length > 0
                    ? next
                    : [createRule(defaultCity, defaultState)];
            });
        };

        return (
            <div className="mx-auto max-w-2xl 2xl:max-w-3xl">
                <div className="mb-5 rounded-xl border border-gray-200 bg-white p-1 shadow-sm">
                    <div className="grid grid-cols-2 gap-1" role="group" aria-label="Tipo de entrega">
                        <button
                            type="button"
                            data-ui="choice" aria-pressed={mode === "radius"}
                            onClick={() => changeMode("radius")}
                            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 2xl:text-base ${
                                mode === "radius"
                                    ? "bg-brand text-white shadow-sm"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                        >
                            <FontAwesomeIcon icon={faRoute} />
                            <span className="flex flex-col items-center gap-0.5 sm:flex-row sm:gap-2">
                                <span>Entrega por KM</span>
                                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide text-brand ring-1 ring-brand/20">
                                    ★ Recomendado
                                </span>
                            </span>
                        </button>
                        <button
                            type="button"
                            data-ui="choice" aria-pressed={mode === "neighborhood"}
                            onClick={() => changeMode("neighborhood")}
                            className={`flex min-h-11 cursor-pointer items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition-all duration-200 2xl:text-base ${
                                mode === "neighborhood"
                                    ? "bg-brand text-white shadow-sm"
                                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                            }`}
                        >
                            <FontAwesomeIcon icon={faLocationDot} />
                            Entrega por Bairro
                        </button>
                    </div>
                </div>

                <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                        mode === "neighborhood" && !isNew
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0"
                    }`}
                >
                    <div className="overflow-hidden">
                        <div className="mb-3 flex h-6 justify-end text-sm font-medium">
                            {!isNew && (
                                <SaveStatus status={error ? "error" : status} />
                            )}
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                        {error}
                    </div>
                )}

                <div
                    className={`grid transition-[grid-template-rows,opacity] duration-300 ease-in-out ${
                        mode === "neighborhood"
                            ? "grid-rows-[1fr] opacity-100"
                            : "grid-rows-[0fr] opacity-0 pointer-events-none"
                    }`}
                >
                    <div className="min-h-0 overflow-hidden">
                        <WarningBox
                            icon={faTriangleExclamation}
                            className="mb-4"
                        >
                            <strong>Cadastre os bairros com a grafia correta.</strong>{" "}
                            Nomes com erros de digitação podem não ser reconhecidos no checkout.
                        </WarningBox>

                        <div className="mb-8 rounded-lg border border-gray-200 bg-white p-4 shadow-sm sm:p-6 2xl:p-8">
                            <div className="space-y-4">
                                {rules.map((rule) => (
                                    <div
                                        key={rule.id}
                                        className="rounded-xl border border-gray-200 bg-gray-50/60 p-4"
                                    >
                                        <div className="panel-neighborhood-fields grid items-end gap-3">
                                            <Input
                                                label="Bairro"
                                                placeholder="Ex: Jardim Paulista"
                                                value={rule.neighborhood}
                                                onChange={(event) =>
                                                    updateRule(rule.id, {
                                                        neighborhood: event.target.value,
                                                    })
                                                }
                                            />
                                            <Input
                                                label="Cidade"
                                                placeholder="Cidade"
                                                value={String(rule.city || "")}
                                                onChange={(event) =>
                                                    updateRule(rule.id, {
                                                        city: event.target.value,
                                                    })
                                                }
                                            />
                                            <Input
                                                label="UF"
                                                placeholder="SP"
                                                maxLength={2}
                                                value={String(rule.state || "")}
                                                onChange={(event) =>
                                                    updateRule(rule.id, {
                                                        state: event.target.value.toUpperCase(),
                                                    })
                                                }
                                            />
                                            <Input
                                                label="Tempo"
                                                numeric
                                                icon="min"
                                                iconPosition="right"
                                                value={String(rule.time_minutes)}
                                                onChange={(event) =>
                                                    updateRule(rule.id, {
                                                        time_minutes: Number.parseInt(
                                                            event.target.value || "0",
                                                            10
                                                        ),
                                                    })
                                                }
                                            />
                                            <Input
                                                label="Taxa"
                                                float
                                                icon="R$"
                                                value={moneyInput(rule.fee_cents)}
                                                onChange={(event) =>
                                                    updateRule(rule.id, {
                                                        fee_cents: parseMoneyInput(
                                                            event.target.value
                                                        ),
                                                    })
                                                }
                                            />
                                            <button
                                                type="button"
                                                onClick={() => deleteRule(rule.id)}
                                                className="flex h-11 w-full cursor-pointer items-center justify-center rounded-md text-red-600 transition-colors hover:bg-red-50 hover:text-red-800 sm:w-9"
                                                aria-label={`Excluir bairro ${rule.neighborhood || "sem nome"}`}
                                            >
                                                <FontAwesomeIcon icon={faTrash} />
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <Button
                                type="button"
                                variant="secondary"
                                onClick={addRule}
                                className="mt-5 w-full"
                            >
                                + Adicionar bairro
                            </Button>
                        </div>
                    </div>
                </div>

                <div
                    className={`[interpolate-size:allow-keywords] [&>div>div:first-child]:overflow-hidden [&>div>div:first-child]:transition-[height,opacity,margin] [&>div>div:first-child]:duration-300 [&>div>div:first-child]:ease-in-out [&>div>div:nth-child(2)]:overflow-hidden [&>div>div:nth-child(2)]:transition-[height,opacity,margin,padding,border-color] [&>div>div:nth-child(2)]:duration-300 [&>div>div:nth-child(2)]:ease-in-out ${
                        mode === "neighborhood"
                            ? "[&>div>div:first-child]:!h-0 [&>div>div:first-child]:!mb-0 [&>div>div:first-child]:opacity-0 [&>div>div:first-child]:pointer-events-none [&>div>div:nth-child(2)]:!h-0 [&>div>div:nth-child(2)]:!mb-0 [&>div>div:nth-child(2)]:!p-0 [&>div>div:nth-child(2)]:border-transparent [&>div>div:nth-child(2)]:opacity-0 [&>div>div:nth-child(2)]:pointer-events-none"
                            : "[&>div>div:first-child]:!h-auto [&>div>div:first-child]:opacity-100 [&>div>div:nth-child(2)]:!h-auto [&>div>div:nth-child(2)]:opacity-100"
                    }`}
                >
                    <RadiusDeliveryRules
                        ref={radiusRef}
                        restaurantId={restaurantId}
                        isNew={isNew}
                        initialRules={initialRules}
                        initialMinOrder={initialMinOrder}
                    />
                </div>
            </div>
        );
    }
);

DeliveryRules.displayName = "DeliveryRules";

export default DeliveryRules;