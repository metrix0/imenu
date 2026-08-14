"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ArcElement,
    Chart as ChartJS,
    Legend,
    Tooltip,
    type TooltipItem,
} from "chart.js";
import { Doughnut } from "react-chartjs-2";

import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import { supabase } from "@/lib/database/supabaseClient";
import {
    CHART_BRAND,
    STANDARD_CHART_TOOLTIP,
} from "@/components/restaurant-owner/exibicoes/chartStyles";

ChartJS.register(ArcElement, Tooltip, Legend);

type CategoryOption = {
    id: string;
    name: string;
    orders: number;
};

type CategorySet = {
    categoryIds: string[];
    orders: number;
};

type Payload = {
    categories: CategoryOption[];
    categorySets: CategorySet[];
    totalOrders: number;
};

function formatPercent(value: number): string {
    return `${value.toLocaleString("pt-BR", {
        maximumFractionDigits: 1,
    })}%`;
}

export default function CategoryCombinationSelector({
    restaurantId,
    startDate,
    endDate,
}: {
    restaurantId: string;
    startDate: string;
    endDate: string;
}) {
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [groupOne, setGroupOne] = useState<string[]>([]);
    const [groupTwo, setGroupTwo] = useState<string[]>([]);

    useEffect(() => {
        const controller = new AbortController();

        const getAccessToken = async (forceRefresh = false) => {
            if (forceRefresh) {
                const {
                    data: { session },
                } = await supabase.auth.refreshSession();
                return session?.access_token || null;
            }

            const {
                data: { session },
            } = await supabase.auth.getSession();
            return session?.access_token || null;
        };

        const request = (accessToken: string) =>
            fetch(
                `/api/restaurants/${restaurantId}/analytics/category-combination?from=${encodeURIComponent(
                    startDate
                )}&to=${encodeURIComponent(endDate)}`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    cache: "no-store",
                    signal: controller.signal,
                }
            );

        const load = async () => {
            setLoading(true);
            setError("");

            try {
                let accessToken = await getAccessToken();
                if (!accessToken) {
                    throw new Error("Faça login novamente para carregar as combinações.");
                }

                let response = await request(accessToken);
                if (response.status === 401) {
                    accessToken = await getAccessToken(true);
                    if (!accessToken) {
                        throw new Error("Sua sessão expirou. Entre novamente.");
                    }
                    response = await request(accessToken);
                }

                const payload = (await response.json()) as Payload & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(
                        payload.error ||
                            "Não foi possível carregar as combinações de categorias."
                    );
                }

                setData(payload);
                const validIds = new Set(payload.categories.map((category) => category.id));

                setGroupOne((current) => {
                    const valid = current.filter((id) => validIds.has(id));
                    if (valid.length > 0) return valid;
                    return payload.categories[0]?.id ? [payload.categories[0].id] : [];
                });
                setGroupTwo((current) => {
                    const valid = current.filter((id) => validIds.has(id));
                    if (valid.length > 0) return valid;
                    return payload.categories[1]?.id ? [payload.categories[1].id] : [];
                });
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === "AbortError") {
                    return;
                }
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível carregar as combinações de categorias."
                );
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void load();
        return () => controller.abort();
    }, [restaurantId, startDate, endDate]);

    const toggleCategory = (group: 1 | 2, categoryId: string) => {
        if (group === 1) {
            setGroupOne((current) => {
                if (current.includes(categoryId)) {
                    return current.filter((id) => id !== categoryId);
                }
                return [...current, categoryId];
            });
            setGroupTwo((current) => current.filter((id) => id !== categoryId));
            return;
        }

        setGroupTwo((current) => {
            if (current.includes(categoryId)) {
                return current.filter((id) => id !== categoryId);
            }
            return [...current, categoryId];
        });
        setGroupOne((current) => current.filter((id) => id !== categoryId));
    };

    const result = useMemo(() => {
        if (!data || groupOne.length === 0 || groupTwo.length === 0) {
            return { matchedOrders: 0, rate: 0 };
        }

        const first = new Set(groupOne);
        const second = new Set(groupTwo);
        const matchedOrders = data.categorySets.reduce((sum, categorySet) => {
            const matchesFirst = categorySet.categoryIds.some((id) => first.has(id));
            const matchesSecond = categorySet.categoryIds.some((id) => second.has(id));
            return matchesFirst && matchesSecond ? sum + categorySet.orders : sum;
        }, 0);

        return {
            matchedOrders,
            rate:
                data.totalOrders > 0
                    ? (matchedOrders / data.totalOrders) * 100
                    : 0,
        };
    }, [data, groupOne, groupTwo]);

    const categoryName = (id: string) =>
        data?.categories.find((category) => category.id === id)?.name || id;

    if (loading && !data) {
        return (
            <Card className="mt-4">
                <ListLoader lines={5} />
            </Card>
        );
    }

    if (error && !data) {
        return (
            <Card className="mt-4 border-red-200 bg-red-50">
                <p className="text-center text-sm text-red-600">{error}</p>
            </Card>
        );
    }

    if (!data) return null;

    const hasSelection = groupOne.length > 0 && groupTwo.length > 0;
    const remainingOrders = Math.max(0, data.totalOrders - result.matchedOrders);
    const chartData = {
        labels: ["Combinação selecionada", "Demais pedidos"],
        datasets: [
            {
                data: [result.matchedOrders, remainingOrders],
                backgroundColor: [CHART_BRAND, "#e5e7eb"],
                borderColor: "#ffffff",
                borderWidth: 2,
                hoverOffset: 6,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: "68%",
        plugins: {
            legend: { position: "bottom" as const },
            tooltip: {
                ...STANDARD_CHART_TOOLTIP,
                callbacks: {
                    label: (context: TooltipItem<"doughnut">) => {
                        const orders = Number(context.raw);
                        const rate =
                            data.totalOrders > 0
                                ? (orders / data.totalOrders) * 100
                                : 0;
                        return `${orders.toLocaleString("pt-BR")} pedidos · ${formatPercent(rate)}`;
                    },
                },
            },
        },
    };

    return (
        <Card className="mt-4">
            <div className="mb-5">
                <h3 className="text-lg font-bold text-gray-900">
                    Taxa de combinação de categorias
                </h3>
                <p className="mt-1 text-sm text-gray-500">
                    Monte dois grupos. A taxa mostra quantos pedidos concluídos continham pelo menos uma categoria do Grupo 1 e uma do Grupo 2.
                </p>
            </div>

            {data.categories.length < 2 ? (
                <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">
                    São necessárias pelo menos duas categorias com pedidos no período.
                </p>
            ) : (
                <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_20rem]">
                    <div className="grid gap-4 lg:grid-cols-2">
                        {[1, 2].map((groupNumber) => {
                            const selected = groupNumber === 1 ? groupOne : groupTwo;
                            return (
                                <div
                                    key={groupNumber}
                                    className="rounded-2xl border border-gray-200 bg-gray-50/60 p-4"
                                >
                                    <div className="mb-3 flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-semibold text-gray-900">
                                                Grupo {groupNumber}
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {selected.length > 0
                                                    ? selected.map(categoryName).join(" + ")
                                                    : "Selecione ao menos uma categoria"}
                                            </p>
                                        </div>
                                        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-gray-500 shadow-sm">
                                            {selected.length}
                                        </span>
                                    </div>

                                    <div className="flex max-h-44 flex-wrap gap-2 overflow-y-auto pr-1">
                                        {data.categories.map((category) => {
                                            const active = selected.includes(category.id);
                                            const inOtherGroup =
                                                groupNumber === 1
                                                    ? groupTwo.includes(category.id)
                                                    : groupOne.includes(category.id);

                                            return (
                                                <button
                                                    key={`${groupNumber}-${category.id}`}
                                                    type="button"
                                                    onClick={() =>
                                                        toggleCategory(
                                                            groupNumber as 1 | 2,
                                                            category.id
                                                        )
                                                    }
                                                    className={`cursor-pointer rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                                                        active
                                                            ? groupNumber === 1
                                                                ? "border-brand bg-brand text-white"
                                                                : "border-gray-900 bg-gray-900 text-white"
                                                            : inOtherGroup
                                                              ? "border-gray-200 bg-white text-gray-400"
                                                              : "border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:text-gray-900"
                                                    }`}
                                                >
                                                    {category.name}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div>
                        <div className="mb-2 text-center">
                            <p className="text-3xl font-bold text-gray-900">
                                {hasSelection ? formatPercent(result.rate) : "—"}
                            </p>
                            <p className="mt-1 text-xs text-gray-500">
                                {hasSelection
                                    ? `${result.matchedOrders.toLocaleString("pt-BR")} de ${data.totalOrders.toLocaleString("pt-BR")} pedidos concluídos`
                                    : "Selecione categorias nos dois grupos"}
                            </p>
                        </div>
                        <div className="h-[230px]">
                            {hasSelection && data.totalOrders > 0 ? (
                                <Doughnut data={chartData} options={chartOptions} />
                            ) : (
                                <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
                                    Selecione ao menos uma categoria em cada grupo.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
        </Card>
    );
}
