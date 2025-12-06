"use client";

import { useState, useEffect } from "react";
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

import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import SalesStatsCards from "./SalesStatsCards"; // Importando o novo componente

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
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
    daily_order_count: string;
}
interface ApiResponse {
    stats: SalesStats;
    graphData: GraphDataPoint[];
}

// Recebe datas do Pai
interface SalesDashboardProps {
    menuId: string;
    startDate: string;
    endDate: string;
}

export default function SalesDashboard({ menuId, startDate, endDate }: SalesDashboardProps) {
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
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchSalesData();
    }, [menuId, startDate, endDate]);

    const chartData = {
        labels: graphData.map(d => new Date(d.date).toLocaleDateString("pt-BR", { timeZone: 'UTC' })),
        datasets: [
            {
                label: "Vendas (R$)",
                data: graphData.map(d => d.daily_sales_cents / 100),
                fill: false,
                borderColor: "#f14400",
                backgroundColor: "#f14400",
                tension: 0.3,
                yAxisID: 'y',
            },
            {
                label: "Pedidos",
                data: graphData.map(d => parseInt(d.daily_order_count, 10)),
                fill: false,
                borderColor: "#1d1d1d",
                backgroundColor: "#1d1d1d",
                tension: 0.3,
                yAxisID: 'y1',
            }
        ],
    };

    const chartOptions = {
        responsive: true,
        interaction: { mode: 'index' as const, intersect: false },
        scales: {
            y: { type: 'linear' as const, display: true, position: 'left' as const, title: { display: true, text: 'Valor (R$)' } },
            y1: { type: 'linear' as const, display: true, position: 'right' as const, grid: { drawOnChartArea: false }, title: { display: true, text: 'Quantidade' } },
        },
    };

    if (isLoading) return <Card><ListLoader lines={4} /><p className="text-center text-gray-500 mt-4">Carregando métricas...</p></Card>;
    if (error) return <Card className="border-red-200 bg-red-50"><p className="text-red-600 text-center">{error}</p></Card>;

    return (
        <div className="space-y-6">
            {stats && (
                <>
                    {/* Cards Componentizados */}
                    <SalesStatsCards 
                        total_sales_cents={stats.total_sales_cents} 
                        total_orders={stats.total_orders} 
                    />
                    
                    <Card>
                        <div className="mb-6">
                            <h4 className="text-lg font-bold text-gray-900">Desempenho no Período</h4>
                            <p className="text-sm text-gray-500">Acompanhe a evolução das suas vendas e pedidos.</p>
                        </div>
                        <div className="h-[300px] w-full">
                            {graphData.length > 0 ? <Line data={chartData} options={chartOptions} /> : <div className="h-full flex items-center justify-center text-gray-400">Nenhum dado encontrado para este período.</div>}
                        </div>
                    </Card>
                </>
            )}
        </div>
    );
}