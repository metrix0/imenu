// components/SalesDashboard.tsx
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
                    throw new Error("Failed to fetch sales data");
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
            timeZone: 'UTC' // Diz ao JS para formatar a data em UTC
        })),
        datasets: [
            {
                label: "Vendas Diárias (R$)",
                data: graphData.map(d => d.daily_sales_cents / 100),
                fill: false,
                borderColor: "rgb(245, 158, 11)",
                tension: 0.1,
            },
            {
                // Linha 2: Pedidos
                label: "Nº de Pedidos",
                data: graphData.map(d => parseInt(d.daily_order_count, 10)), 
                fill: false,
                borderColor: "rgb(59, 130, 246)", 
                tension: 0.1,
                
            }
        ],
    };

    return (
        <div className="space-y-6">
            {/* 1. Date Filters */}
            <div className="flex flex-wrap items-center gap-4 rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
                <h3 className="text-lg font-semibold">Analisar Período</h3>
                <div className="flex-1 min-w-[150px]">
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700">De</label>
                    <input
                        type="date"
                        id="startDate"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                </div>
                <div className="flex-1 min-w-[150px]">
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700">Até</label>
                    <input
                        type="date"
                        id="endDate"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm"
                    />
                </div>
            </div>

            {isLoading && <p>Carregando dados...</p>}
            {error && <p className="text-red-500">{error}</p>}
            
            {!isLoading && !error && stats && (
                <>
                    {/* 2. Stats Cards (Vendas e N° de Vendas) */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">Total de Vendas</h4>
                            <p className="mt-2 text-3xl font-semibold text-gray-900">
                                {formatPrice(stats.total_sales_cents)}
                            </p>
                        </div>
                        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                            <h4 className="text-sm font-medium text-gray-500">N° de Pedidos</h4>
                            <p className="mt-2 text-3xl font-semibold text-gray-900">
                                {stats.total_orders}
                            </p>
                        </div>
                    </div>

                    {/* 3. The Graph */}
                    <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
                        <h4 className="text-lg font-semibold mb-4">Vendas ao Longo do Tempo</h4>
                        {graphData.length > 0 ? (
                            <Line data={chartData} />
                        ) : (
                            <p>Nenhum dado de venda para exibir no gráfico.</p>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}