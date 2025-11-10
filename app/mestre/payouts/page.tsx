// app/mestre/payouts/page.tsx
"use client";

import { useState, useEffect } from "react";
// Adicionamos o 'useTransition' para um loading mais suave, mas 'useState' simples é bom
// Vou usar um 'useState' para loading para simplificar.

// --- Tipos de Dados ---
interface PendingPayout {
    payout_id: string;
    start_date: string;
    end_date: string;
    amount_cents: number;
    order_count: number;
    restaurant_name: string;
}

// --- Helpers (sem mudanças) ---
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
const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

export default function MestrePayoutsPage() {
    const [payouts, setPayouts] = useState<PendingPayout[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // State para saber qual botão está carregando
    const [loadingPayoutId, setLoadingPayoutId] = useState<string | null>(null);

    // Função para buscar os dados (sem mudanças)
    const fetchPendingPayouts = async () => {
        setIsLoading(true);
        try {
            const response = await fetch("/api/mestre/pending-payouts");
            if (!response.ok) {
                throw new Error("Falha ao buscar pagamentos pendentes");
            }
            const data = await response.json();
            setPayouts(data);
        } catch (err) {
            setError((err as Error).message);
        } finally {
            setIsLoading(false);
        }
    };

    // Buscar dados no carregamento inicial
    useEffect(() => {
        fetchPendingPayouts();
    }, []);

    // --- FUNÇÃO ADICIONADA ---
    // Chamada quando o botão "Marcar como Pago" é clicado
    const handleMarkAsPaid = async (payoutId: string) => {
        setLoadingPayoutId(payoutId); // Desabilita este botão específico
        
        try {
            const response = await fetch("/api/mestre/mark-payout-paid", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ payoutId }),
            });

            if (!response.ok) {
                throw new Error("Falha ao marcar como pago");
            }

            // Sucesso! Remove o item da lista (para o admin não clicar de novo)
            setPayouts(currentPayouts => 
                currentPayouts.filter(p => p.payout_id !== payoutId)
            );

        } catch (err) {
            alert("Erro: " + (err as Error).message); // Alerta simples para o admin
        } finally {
            setLoadingPayoutId(null); // Re-abilita os botões
        }
    };

    return (
        <div className="p-8 max-w-7xl mx-auto">
            <h1 className="text-3xl font-bold mb-6">Pagamentos Pendentes (Mestre)</h1>

            {isLoading && <p>Carregando pagamentos...</p>}
            {error && <p className="text-red-500">{error}</p>}

            {!isLoading && !error && (
                <div className="rounded-lg border border-gray-200 bg-white shadow-sm">
                    <table className="w-full min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            {/* ... (cabeçalho da tabela sem mudanças) ... */}
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Semana</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Restaurante</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Pedidos</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Valor</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {payouts.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-4 text-center text-gray-500">
                                        Nenhum pagamento pendente.
                                    </td>
                                </tr>
                            ) : (
                                payouts.map((payout) => (
                                    <tr key={payout.payout_id}>
                                        {/* ... (outras colunas 'td' sem mudanças) ... */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {formatWeek(payout.start_date, payout.end_date)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {payout.restaurant_name}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">
                                            {payout.order_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                                            {formatPrice(payout.amount_cents)}
                                        </td>
                                        
                                        {/* --- CÉLULA DO BOTÃO ATUALIZADA --- */}
                                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                                            <button
                                                onClick={() => handleMarkAsPaid(payout.payout_id)}
                                                disabled={loadingPayoutId === payout.payout_id} // Desabilita só este botão
                                                className="px-4 py-2 bg-green-600 text-white rounded-md text-xs font-medium hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                                            >
                                                {loadingPayoutId === payout.payout_id ? "Pagando..." : "Marcar como Pago"}
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}