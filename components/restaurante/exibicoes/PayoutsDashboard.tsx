"use client";

import { useState, useEffect } from "react";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/supabaseClient";

import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import Button from "@/components/ui/Button";

const PAGE_SIZE = 5;

interface Payout {
    id: string;
    start_date: string;
    end_date: string;
    amount_cents: number;
    status: "pending_payment" | "paid";
    paid_at: string | null;
    order_count: number;
}

interface PayoutsDashboardProps {
    menuId: string;
    startDate?: string;
    endDate?: string;
}

// Helper to format date ranges (Versão Corrigida - Baseada em String)
const formatWeek = (start: string, end: string) => {
    // Função auxiliar para formatar "YYYY-MM-DD" para "DD/MM"
    const fmt = (dateStr: string) => {
        if (!dateStr) return "";
        // Divide a string para evitar qualquer interpretação de timezone do navegador
        const parts = dateStr.split("-"); // ["2025", "11", "30"]
        if (parts.length !== 3) return dateStr;
        return `${parts[2]}/${parts[1]}`; // Retorna "30/11"
    };

    return `${fmt(start)} - ${fmt(end)}`;
};

const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

const PayoutStatus = ({ status }: { status: Payout["status"] }) => {
    if (status === "paid") {
        return (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                <FontAwesomeIcon icon={icons.faCheck} className="w-3 h-3" />
                Pago
            </span>
        );
    }
    return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
            <FontAwesomeIcon icon={faClock} className="w-3 h-3" />
            Pendente
        </span>
    );
};

export default function PayoutsDashboard({ menuId, startDate, endDate }: PayoutsDashboardProps) {
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    // Resetar página quando mudar filtros
    useEffect(() => {
        setPage(0);
    }, [startDate, endDate]);

    useEffect(() => {
        if (!menuId) return;

        const fetchPayouts = async () => {
            setIsLoading(true);
            try {
                // Query Direta no Supabase com Filtro de Data
                let query = supabase
                    .from("payouts")
                    .select("*", { count: "exact" })
                    .eq("restaurant_id", menuId)
                    .order("start_date", { ascending: false })
                    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

                // Aplica filtros nas colunas da tabela payouts
                if (startDate && endDate) {
                    query = query
                        .gte("start_date", startDate) // Maior ou igual data inicial
                        .lte("end_date", endDate);   // Menor ou igual data final
                }

                const { data, error, count } = await query;

                if (error) throw error;

                setPayouts(data as Payout[]);
                
                if (count !== null) {
                    setHasMore((page + 1) * PAGE_SIZE < count);
                } else {
                    setHasMore((data?.length || 0) === PAGE_SIZE);
                }

            } catch (err) {
                console.error(err);
                setError("Não foi possível carregar os pagamentos.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchPayouts();
    }, [menuId, page, startDate, endDate]);

    if (isLoading) return <Card><ListLoader lines={3} /><p className="text-center text-gray-500 mt-4">Buscando pagamentos...</p></Card>;
    
    if (error) return <Card className="bg-red-50 border-red-200"><p className="text-red-600 text-sm">{error}</p></Card>;

    return (
        <Card>
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900">Histórico de Repasses</h2>
                <p className="text-sm text-gray-500">Acompanhe os valores transferidos semanalmente.</p>
            </div>

            <div className="space-y-3">
                {payouts.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                        Nenhum pagamento encontrado neste período.
                    </div>
                ) : (
                    payouts.map((payout, index) => (
                        <div
                            key={payout.id || index}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors gap-4"
                        >
                            <div>
                                <h5 className="font-semibold text-gray-900">
                                    Semana {formatWeek(payout.start_date, payout.end_date)}
                                </h5>
                                <p className="text-sm text-gray-500 mt-1">
                                    {payout.order_count} {payout.order_count === 1 ? "pedido processado" : "pedidos processados"}
                                </p>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                <span className="text-lg font-bold text-gray-900">
                                    {formatPrice(payout.amount_cents)}
                                </span>
                                <PayoutStatus status={payout.status} />
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Paginação */}
            {(payouts.length > 0 || page > 0) && (
                <div className="flex justify-center gap-2 mt-6 pt-4 border-gray-100">
                    <Button 
                        variant="secondary" 
                        disabled={page === 0 || isLoading}
                        onClick={() => setPage(p => Math.max(0, p - 1))}
                        className="px-4 py-2 text-xs"
                    >
                        Anterior
                    </Button>
                    <Button 
                        variant="secondary" 
                        disabled={!hasMore || isLoading}
                        onClick={() => setPage(p => p + 1)}
                        className="px-4 py-2 text-xs"
                    >
                        Próxima
                    </Button>
                </div>
            )}
        </Card>
    );
}