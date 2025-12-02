"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faEye } from "@fortawesome/free-solid-svg-icons";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";

// Definição do Tipo Order (pode ser movido para types.ts futuramente)
export type Order = {
    id: string;
    display_id: number;
    created_at: string;
    customer_name: string;
    status: "pending" | "preparing" | "delivering" | "finished" | "cancelled";
    total_cents: number;
};

interface OrdersTableProps {
    orders: Order[];
    isLoading: boolean;
}

export default function OrdersTable({ orders, isLoading }: OrdersTableProps) {
    
    // Helpers de Formatação (locais para exibição)
    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    const getStatusBadge = (status: string) => {
        const map: Record<string, string> = {
            pending: "bg-yellow-100 text-yellow-800 border-yellow-200",
            preparing: "bg-blue-100 text-blue-800 border-blue-200",
            delivering: "bg-orange-100 text-orange-800 border-orange-200",
            finished: "bg-green-100 text-green-800 border-green-200",
            cancelled: "bg-red-100 text-red-800 border-red-200",
        };
        const label: Record<string, string> = {
            pending: "Pendente",
            preparing: "Preparando",
            delivering: "Em Rota",
            finished: "Concluído",
            cancelled: "Cancelado",
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs font-medium border ${map[status] || "bg-gray-100"}`}>
                {label[status] || status}
            </span>
        );
    };

    return (
        <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm">
            {/* Header da Tabela */}
            <div className="bg-gray-100/50 border-b border-gray-200 grid grid-cols-12 px-6 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">
                <div className="col-span-2">Número</div>
                <div className="col-span-3">Cliente</div>
                <div className="col-span-2">Data</div>
                <div className="col-span-2">Valor</div>
                <div className="col-span-2">Situação</div>
                <div className="col-span-1 text-right">Ações</div>
            </div>

            {/* Conteúdo */}
            {isLoading ? (
                <div className="p-6">
                    <ListLoader lines={6} />
                </div>
            ) : (
                <div className="divide-y divide-gray-100">
                    {orders.length === 0 ? (
                        <div className="p-10 text-center text-gray-500">
                            Nenhum pedido encontrado com estes filtros.
                        </div>
                    ) : (
                        orders.map((order) => (
                            <div 
                                key={order.id} 
                                className="grid grid-cols-12 px-6 py-4 items-center hover:bg-gray-50 transition-colors text-sm text-gray-700"
                            >
                                <div className="col-span-2 font-bold text-gray-900">
                                    #{order.display_id || order.id.slice(0, 4)}
                                </div>
                                <div className="col-span-3 font-medium truncate pr-4">
                                    {order.customer_name}
                                </div>
                                <div className="col-span-2 text-gray-500">
                                    {fmtDate(order.created_at)}
                                </div>
                                <div className="col-span-2 font-medium">
                                    {fmtMoney(order.total_cents)}
                                </div>
                                <div className="col-span-2">
                                    {getStatusBadge(order.status)}
                                </div>
                                <div className="col-span-1 text-right">
                                    <button className="text-gray-400 hover:text-brand transition-colors p-2" title="Ver Detalhes">
                                        <FontAwesomeIcon icon={faEye} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </Card>
    );
}