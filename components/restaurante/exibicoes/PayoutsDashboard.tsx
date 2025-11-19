// components/PayoutsDashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { icons } from "@/lib/fontawesome";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

// Define the type for a payout object
interface Payout {
    start_date: string;
    end_date: string;
    amount_cents: number;
    status: "pending_payment" | "paid";
    paid_at: string | null;
    order_count: number; // <-- CAMPO ADICIONADO
}

// Helper to format date ranges
const formatWeek = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);

    const formatDate = (date: Date) => {
        return new Date(date.getTime() + date.getTimezoneOffset() * 60000 + 86400000).toLocaleDateString("pt-BR", {
            day: "2-digit",
            month: "2-digit",
        });
    };
    return `${formatDate(startDate)}-${formatDate(endDate)}`;
};

// Helper to format currency
const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

// Componente de Status (Corrigido da nossa conversa anterior)
const PayoutStatus = ({ status }: { status: Payout["status"] }) => {
    if (status === "paid") {
        return (
            <span className="flex items-center gap-2 text-green-600">
                <FontAwesomeIcon icon={icons.faCheck} className="w-4 h-4" />
                Pago
            </span>
        );
    }
    return (
        <span className="flex items-center gap-2 text-yellow-600">
            <span className="w-4 h-4 text-center">⏳</span>
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
                // Chama a API route que atualizamos
                const response = await fetch(
                    `/api/restaurants/${menuId}/payouts`
                );
                if (!response.ok) {
                    throw new Error("Failed to fetch payouts");
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

    return (
        <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Seus Pagamentos</h2>

            {isLoading && <p className="text-gray-500">Carregando pagamentos...</p>}
            {error && <p className="text-red-500">{error}</p>}

            {!isLoading && !error && (
                <div className="space-y-4">
                    {payouts.length === 0 ? (
                        <p className="text-gray-500">Nenhum pagamento encontrado.</p>
                    ) : (
                        payouts.map((payout) => (
                            <div
                                key={payout.start_date}
                                className="flex flex-wrap items-center justify-between rounded-md border border-gray-100 p-4"
                            >
                                {/* --- SEÇÃO MODIFICADA --- */}
                                <div>
                                    <span className="font-medium text-gray-700">
                                        Semana {formatWeek(payout.start_date, payout.end_date)}
                                    </span>
                                    {/* LINHA ADICIONADA para o "30 pedidos" */}
                                    <span className="block text-sm text-gray-500">
                                        {payout.order_count} {payout.order_count === 1 ? "pedido" : "pedidos"}
                                    </span>
                                </div>
                                {/* --- FIM DA MODIFICAÇÃO --- */}

                                <div className="flex items-center gap-4">
                                    <span className="text-lg font-semibold text-gray-900">
                                        {formatPrice(payout.amount_cents)}
                                    </span>
                                    <span className="text-sm font-medium">
                                        <PayoutStatus status={payout.status} />
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}