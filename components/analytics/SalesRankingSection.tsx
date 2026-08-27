"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/database/supabaseClient";

type RangeKey = "7d" | "this_week" | "last_week" | "30d" | "90d";

type SalesRankingPayload = {
    summary: {
        totalGmvCents: number;
        totalOrders: number;
        restaurantCount: number;
        averageGmvPerRestaurantCents: number;
    };
    restaurants: Array<{
        id: string;
        name: string;
        gmvCents: number;
        orders: number;
        averageTicketCents: number;
        sharePercent: number;
    }>;
};

function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    }).format(value / 100);
}

function formatCount(value: number): string {
    return value.toLocaleString("pt-BR");
}

function formatPercent(value: number): string {
    return `${value.toLocaleString("pt-BR", {
        minimumFractionDigits: value % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
    })}%`;
}

export default function SalesRankingSection({ range }: { range: RangeKey }) {
    const [data, setData] = useState<SalesRankingPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [visibleCount, setVisibleCount] = useState(10);

    useEffect(() => {
        const controller = new AbortController();
        setVisibleCount(10);

        const loadRanking = async () => {
            setLoading(true);
            setError("");

            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    throw new Error("Sessão não encontrada.");
                }

                const response = await fetch(
                    `/api/dev/sales-ranking?range=${range}`,
                    {
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );
                const payload = (await response.json()) as SalesRankingPayload & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(
                        payload.error || "Erro ao carregar o ranking de vendas."
                    );
                }

                setData(payload);
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === "AbortError") {
                    return;
                }

                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Erro ao carregar o ranking de vendas."
                );
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void loadRanking();
        return () => controller.abort();
    }, [range]);

    return (
        <section>
            <div className="mb-4">
                <h2 className="text-xl font-bold text-gray-900">
                    Ranking de vendas
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                    Restaurantes ordenados pelo GMV válido no período selecionado.
                </p>
            </div>

            {loading && !data ? (
                <div className="h-64 animate-pulse rounded-2xl border border-gray-200 bg-white" />
            ) : error ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                    {error}
                </div>
            ) : data ? (
                <>
                    <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryCard
                            label="GMV total"
                            value={formatCurrencyFromCents(
                                data.summary.totalGmvCents
                            )}
                        />
                        <SummaryCard
                            label="Restaurantes com vendas"
                            value={formatCount(data.summary.restaurantCount)}
                        />
                        <SummaryCard
                            label="GMV médio por restaurante"
                            value={formatCurrencyFromCents(
                                data.summary.averageGmvPerRestaurantCents
                            )}
                        />
                        <SummaryCard
                            label="Pedidos"
                            value={formatCount(data.summary.totalOrders)}
                        />
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                        <div className="overflow-x-auto">
                            <table className="w-full min-w-[760px] text-left text-sm">
                                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                    <tr>
                                        <th className="w-16 px-5 py-4 text-center font-semibold">
                                            #
                                        </th>
                                        <th className="px-5 py-4 font-semibold">
                                            Restaurante
                                        </th>
                                        <th className="px-5 py-4 text-right font-semibold">
                                            GMV
                                        </th>
                                        <th className="px-5 py-4 text-right font-semibold">
                                            Pedidos
                                        </th>
                                        <th className="px-5 py-4 text-right font-semibold">
                                            Ticket médio
                                        </th>
                                        <th className="px-5 py-4 text-right font-semibold">
                                            % do GMV
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {data.restaurants
                                        .slice(0, visibleCount)
                                        .map((restaurant, index) => (
                                            <tr
                                                key={restaurant.id}
                                                className="hover:bg-gray-50/70"
                                            >
                                                <td className="px-5 py-4 text-center font-semibold tabular-nums text-gray-500">
                                                    {index + 1}
                                                </td>
                                                <td className="px-5 py-4 font-medium text-gray-900">
                                                    {restaurant.name}
                                                </td>
                                                <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900">
                                                    {formatCurrencyFromCents(
                                                        restaurant.gmvCents
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                    {formatCount(restaurant.orders)}
                                                </td>
                                                <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                    {formatCurrencyFromCents(
                                                        restaurant.averageTicketCents
                                                    )}
                                                </td>
                                                <td className="px-5 py-4 text-right">
                                                    <span className="inline-flex min-w-16 justify-center rounded-full bg-brand/10 px-3 py-1 font-semibold tabular-nums text-brand">
                                                        {formatPercent(
                                                            restaurant.sharePercent
                                                        )}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>

                        {!data.restaurants.length && (
                            <div className="p-8 text-center text-sm text-gray-400">
                                Nenhuma venda válida no período.
                            </div>
                        )}

                        {visibleCount < data.restaurants.length && (
                            <div className="border-t border-gray-200 bg-gray-50 p-4 text-center">
                                <button
                                    type="button"
                                    onClick={() =>
                                        setVisibleCount((current) => current + 10)
                                    }
                                    className="rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm transition hover:border-brand/30 hover:text-brand"
                                >
                                    Mostrar +10
                                </button>
                            </div>
                        )}
                    </div>
                </>
            ) : null}
        </section>
    );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
            <p className="text-sm font-medium text-gray-600">{label}</p>
            <p className="mt-2 text-2xl font-bold tracking-tight text-gray-950">
                {value}
            </p>
        </div>
    );
}
