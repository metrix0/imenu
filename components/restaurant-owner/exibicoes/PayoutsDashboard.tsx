"use client";

import { useState, useEffect } from "react";
import { icons } from "@/lib/utils/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";
import { supabase } from "@/lib/database/supabaseClient";

import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import Button from "@/components/ui/Button";

const PAGE_SIZE = 5;

interface Payout {
    id: string;
    restaurant_id: string;
    amount_cents: number;
    created_at: string;
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
                    .order("created_at", { ascending: false })
                    .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

                // Aplica filtros nas colunas da tabela payouts

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
                <h2 className="text-lg font-bold text-gray-900 2xl:text-xl">Histórico de Repasses</h2>
                <p className="text-sm text-gray-500 2xl:text-lg">Acompanhe os valores transferidos semanalmente, <b>todo domingo no Pix cadastrado</b>.</p>
            </div>

            <div className="space-y-3">
                {payouts.length === 0 ? (
                    <div className="text-center 2xl:text-lg 2xl:py-15 py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                        Nenhum pagamento encontrado neste período.
                    </div>
                ) : (
                    payouts.map((payout, index) => (
                        <div
                            key={payout.id || index}
                            className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-lg border border-gray-100 hover:border-gray-200 hover:bg-gray-50 transition-colors gap-4"
                        >
                            <div>
                                <h5 className="font-semibold text-gray-600 flex items-center gap-2">
                                    <div className={"w-3 h-3 bg-green rounded-full"}></div>{new Date(payout.created_at).toLocaleDateString("pt-BR")}
                                </h5>
                            </div>

                            <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                                <span className="text-lg font-bold text-gray-900">
                                    {formatPrice(payout.amount_cents)}
                                </span>
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