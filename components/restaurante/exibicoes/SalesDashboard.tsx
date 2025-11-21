"use client";

import { useState, useEffect } from "react";
// Chart.js import
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
} from "chart.js";
import { Line } from "react-chartjs-2";

// Design System Imports
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import ListLoader from "@/components/ui/ListLoader";

// register Chart.js components
ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend
);

// --- Data types ---
interface SalesStats {
    total_orders: number;
    total_sales_cents: number;
}
interface GraphDataPoint {
    date: string;
    daily_sales_cents: number;
    daily_order_count: string;
}
interface ApiResponse {
    stats: SalesStats;
    graphData: GraphDataPoint[];
}

// --- Helpers ---
const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

const getISODate = (date: Date) => date.toISOString().split("T")[0];

// --- Component ---
export default function SalesDashboard({ menuId }: { menuId: string }) {
    // State for date filters
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() - 7); // Default to 7 days ago
        return getISODate(d);
    });
    const [endDate, setEndDate] = useState(() => getISODate(new Date())); // Default to today

    // State for data
    const [stats, setStats] = useState<SalesStats | null>(null);
    const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Data fetching logic
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
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSalesData();
    }, [menuId, startDate, endDate]);

    // --- Graph config ---
    const chartData = {
        labels: graphData.map(d => new Date(d.date).toLocaleDateString("pt-BR", {
            timeZone: 'UTC'
        })),
        datasets: [
            {
                label: "Vendas (R$)",
                data: graphData.map(d => d.daily_sales_cents / 100),
                fill: false,
                borderColor: "#f14400", // var(--color-brand)
                backgroundColor: "#f14400",
                tension: 0.3,
                yAxisID: 'y',
            },
            {
                label: "Pedidos",
                data: graphData.map(d => parseInt(d.daily_order_count, 10)),
                fill: false,
                borderColor: "#1d1d1d", // var(--color-text)
                backgroundColor: "#1d1d1d",
                tension: 0.3,
                yAxisID: 'y1',
            }
        ],
    };

    const chartOptions = {
        responsive: true,
        interaction: {
            mode: 'index' as const,
            intersect: false,
        },
        scales: {
            y: {
                type: 'linear' as const,
                display: true,
                position: 'left' as const,
                title: { display: true, text: 'Valor (R$)' }
            },
            y1: {
                type: 'linear' as const,
                display: true,
                position: 'right' as const,
                grid: {
                    drawOnChartArea: false,
                },
                title: { display: true, text: 'Quantidade' }
            },
        },
    };

    return (
        <div className="space-y-6">
            {/* 1. Date Filters - Agora usando Card e Input */}
            <Card className="flex flex-wrap items-end gap-4 p-5">
                <div className="flex-1 min-w-[150px]">
                    <Input
                        label="Data Inicial"
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <Input
                        label="Data Final"
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                    />
                </div>
            </Card>

            {isLoading && (
                <Card>
                    <ListLoader lines={4} />
                    <p className="text-center text-gray-500 mt-4">Carregando métricas...</p>
                </Card>
            )}
            
            {error && (
                <Card className="border-red-200 bg-red-50">
                    <p className="text-red-600 text-center">{error}</p>
                </Card>
            )}
            
            {!isLoading && !error && stats && (
                <>
                    {/* 2. Stats Cards (Vendas e N° de Vendas) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <Card>
                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">Total de Vendas</h4>
                            <p className="mt-2 text-3xl font-bold text-brand">
                                {formatPrice(stats.total_sales_cents)}
                            </p>
                        </Card>
                        <Card>
                            <h4 className="text-sm font-medium text-gray-500 uppercase tracking-wide">N° de Pedidos</h4>
                            <p className="mt-2 text-3xl font-bold text-gray-900">
                                {stats.total_orders}
                            </p>
                        </Card>
                    </div>

                    {/* 3. The Graph */}
                    <Card>
                        <div className="mb-6">
                            <h4 className="text-lg font-bold text-gray-900">Desempenho no Período</h4>
                            <p className="text-sm text-gray-500">Acompanhe a evolução das suas vendas e pedidos.</p>
                        </div>
                        
                        <div className="h-[300px] w-full">
                            {graphData.length > 0 ? (
                                <Line data={chartData} options={chartOptions} />
                            ) : (
                                <div className="h-full flex items-center justify-center text-gray-400">
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