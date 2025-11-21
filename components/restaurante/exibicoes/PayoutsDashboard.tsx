"use client";

import { useState, useEffect } from "react";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock } from "@fortawesome/free-solid-svg-icons";

// Design System Imports
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";

// Define the type for a payout object
interface Payout {
    start_date: string;
    end_date: string;
    amount_cents: number;
    status: "pending_payment" | "paid";
    paid_at: string | null;
    order_count: number;
}

// Helper to format date ranges
const formatWeek = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const formatDate = (date: Date) => {
        // Ajuste simples de timezone para exibição
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000 + 86400000).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
        });
    };
    return `${formatDate(startDate)} - ${formatDate(endDate)}`;
};

// Helper to format currency
const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

// Componente de Status
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

// O componente recebe o ID do restaurante/menu
export default function PayoutsDashboard({ menuId }: { menuId: string }) {
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!menuId) return;

        const fetchPayouts = async () => {
            setIsLoading(true);
            try {
                const response = await fetch(
                    `/api/restaurants/${menuId}/payouts`
                );
                if (!response.ok) {
                    throw new Error("Falha ao carregar histórico de pagamentos.");
                }
                const data = await response.json();
                setPayouts(data);
            } catch (err) {
                setError((err as Error).message);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPayouts();
    }, [menuId]);

    if (isLoading) {
        return (
            <Card>
                 <div className="mb-6">
                    <h4 className="text-lg font-bold text-gray-900">Histórico de Repasses</h4>
                </div>
                <ListLoader lines={3} />
                <p className="text-center text-gray-500 mt-4">Buscando pagamentos...</p>
            </Card>
        );
    }

    if (error) {
        return (
            <Card className="bg-red-50 border-red-200">
                <h4 className="text-red-800 font-semibold mb-2">Erro ao carregar</h4>
                <p className="text-red-600 text-sm">{error}</p>
            </Card>
        );
    }

    return (
        <Card>
            <div className="mb-6">
                <h2 className="text-lg font-bold text-gray-900">Histórico de Repasses</h2>
                <p className="text-sm text-gray-500">Acompanhe os valores transferidos semanalmente.</p>
            </div>

            <div className="space-y-3">
                {payouts.length === 0 ? (
                    <div className="text-center py-8 text-gray-400 border-2 border-dashed border-gray-100 rounded-lg">
                        Nenhum pagamento encontrado.
                    </div>
                ) : (
                    payouts.map((payout, index) => (
                        <div
                            key={`${payout.start_date}-${index}`}
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
        </Card>
    );
}