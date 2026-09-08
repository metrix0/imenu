"use client";

import { useEffect, useState } from "react";
import {
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    Filler,
    PointElement,
    Title,
    Tooltip,
    type TooltipItem,
} from "chart.js";
import { Line } from "react-chartjs-2";

import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import SalesStatsCards from "./SalesStatsCards";
import {
    CHART_BRAND,
    CHART_CATEGORY_AXIS,
    CHART_VALUE_AXIS,
    STANDARD_CHART_TOOLTIP,
    createBrandAreaGradient,
} from "./chartStyles";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Filler,
    Title,
    Tooltip,
    Legend
);

interface SalesStats {
    total_orders: number;
    total_sales_cents: number;
}

interface GraphDataPoint {
    date: string;
    daily_sales_cents: number;
}

interface ApiResponse {
    stats: SalesStats;
    graphData: GraphDataPoint[];
}

interface SalesDashboardProps {
    menuId: string;
    startDate: string;
    endDate: string;
}

function formatCurrency(value: number): string {
    return value.toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

export default function SalesDashboard({
    menuId,
    startDate,
    endDate,
}: SalesDashboardProps) {
    const [stats, setStats] = useState<SalesStats | null>(null);
    const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!menuId || !startDate || !endDate) return;

        const fetchSalesData = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const response = await fetch(
                    `/api/restaurants/${menuId}/sales?from=${startDate}&to=${endDate}`
                );
                if (!response.ok) {
                    throw new Error("Falha ao buscar dados de vendas.");
                }

                const data: ApiResponse = await response.json();
                setStats(data.stats);
                setGraphData(data.graphData);
            } catch (caught) {
                setError((caught as Error).message);
            } finally {
                setIsLoading(false);
            }
        };

        void fetchSalesData();
    }, [menuId, startDate, endDate]);

    const chartData = {
        labels: graphData.map((point) =>
            new Date(point.date).toLocaleDateString("pt-BR", {
                timeZone: "UTC",
                day: "2-digit",
                month: "2-digit",
            })
        ),
        datasets: [
            {
                label: "Faturamento",
                data: graphData.map((point) => point.daily_sales_cents / 100),
                fill: true,
                borderColor: CHART_BRAND,
                backgroundColor: createBrandAreaGradient,
                borderWidth: 2.5,
                tension: 0.35,
                pointRadius: graphData.length === 1 ? 3 : 0,
                pointHoverRadius: 5,
                pointHitRadius: 14,
                pointHoverBackgroundColor: CHART_BRAND,
                pointHoverBorderColor: "#ffffff",
                pointHoverBorderWidth: 2,
            },
        ],
    };

    const chartOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                ...STANDARD_CHART_TOOLTIP,
                callbacks: {
                    label: (context: TooltipItem<"line">) =>
                        `Faturamento: ${formatCurrency(Number(context.raw))}`,
                },
            },
        },
        scales: {
            x: CHART_CATEGORY_AXIS,
            y: {
                ...CHART_VALUE_AXIS,
                ticks: {
                    ...CHART_VALUE_AXIS.ticks,
                    callback: (value: string | number) =>
                        formatCurrency(Number(value)),
                },
            },
        },
    };

    if (isLoading) {
        return (
            <Card>
                <ListLoader lines={4} />
                <p className="mt-4 text-center text-gray-500">
                    Carregando métricas...
                </p>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="border-red-200 bg-red-50">
                <p className="text-center text-red-600">{error}</p>
            </Card>
        );
    }

    return (
        <div className="w-full space-y-6">
            {stats && (
                <>
                    <SalesStatsCards
                        total_sales_cents={stats.total_sales_cents}
                        total_orders={stats.total_orders}
                    />

                    <Card className="w-full overflow-hidden">
                        <div className="mb-6 border-b border-gray-200 pb-4">
                            <h3>
                                Faturamento no período
                            </h3>
                            <p className="text-sm text-gray-500 2xl:text-base">
                                Evolução da receita ao longo do intervalo selecionado.
                            </p>
                        </div>
                        <div className="h-[260px] w-full sm:h-[320px]">
                            {graphData.length > 0 ? (
                                <Line data={chartData} options={chartOptions} role="img" aria-label="Evolução do faturamento no período selecionado" />
                            ) : (
                                <div className="flex h-full items-center justify-center text-gray-400">
                                    Nenhum dado encontrado para este período.
                                </div>
                            )}
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}
