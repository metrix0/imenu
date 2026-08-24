"use client";

import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChair, faEye } from "@fortawesome/free-solid-svg-icons";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";

export type Order = {
    payment_method: "dinheiro" | "cartao" | "pix" | "trazer-maquininha";
    id: string;
    display_id: number;
    created_at: string;
    customer_name: string;
    status: "pending_online_payment" | "pending_physical_payment" | "paid" | "preparing" | "delivering" | "done" | "canceled";
    total_cents: number;
    is_delivery?: string | null;
    table_name_snapshot?: string | null;
};

interface OrdersTableProps {
    orders: Order[];
    isLoading: boolean;
    onViewOrder?: (order: Order) => void; // Nova prop para ação
}

export default function OrdersTable({ orders, isLoading, onViewOrder }: OrdersTableProps) {

    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    const getStatusBadge = (status: string, isPickup: boolean) => {
        const map: Record<string, string> = {
            pending_online_payment: "bg-yellow-500 text-yellow-950",
            pending_physical_payment: "bg-yellow-500 text-yellow-950",
            paid: "bg-yellow-500 text-yellow-950",
            preparing: "bg-blue-100 text-blue-800 border-blue-200",
            delivering: isPickup ? "bg-green-100 text-green-800 border-green-200" : "bg-purple-100 text-purple-800 border-purple-800",
            done: "bg-green-100 text-green-800 border-green-200",
            canceled: "bg-red-100 text-red-800 border-red-200",
        };
        const label: Record<string, string> = {
            pending_online_payment: "Pendente",
            pending_physical_payment: "Pendente",
            paid: "Pendente",
            preparing: "Preparando",
            delivering: isPickup ? "Pronto" : "Em Rota",
            done: "Concluído",
            canceled: "Cancelado",
        };
        return (
            <span className={`px-3 py-1 rounded-full text-xs 2xl:text-base font-medium ${map[status] || "bg-gray-100"}`}>
                {label[status] || status}
            </span>
        );
    };

    return (
        <Card className="p-0 overflow-hidden border border-gray-200 shadow-sm">
            <div className="md:hidden">
                {isLoading ? (
                    <div className="p-6">
                        <ListLoader lines={6} />
                    </div>
                ) : orders.length === 0 ? (
                    <div className="p-10 text-center text-gray-500">
                        Nenhum pedido encontrado com estes filtros.
                    </div>
                ) : (
                    <div className="divide-y divide-gray-100">
                        {orders.map((order) => (
                            <div
                                key={`mobile-${order.id}`}
                                role={onViewOrder ? "button" : undefined}
                                tabIndex={onViewOrder ? 0 : undefined}
                                onClick={() => onViewOrder?.(order)}
                                onKeyDown={(event) => {
                                    if (onViewOrder && (event.key === "Enter" || event.key === " ")) {
                                        event.preventDefault();
                                        onViewOrder(order);
                                    }
                                }}
                                className={`space-y-3 p-4 transition-colors ${onViewOrder ? "cursor-pointer hover:bg-gray-50" : ""}`}
                            >
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-bold text-gray-900">
                                                #{order.display_id || order.id.slice(0, 4)}
                                            </span>
                                            {getStatusBadge(
                                                order.status,
                                                order.is_delivery === "mesa" || order.is_delivery === "retirada"
                                            )}
                                        </div>
                                        <div className="mt-2 flex min-w-0 items-center gap-2">
                                            <p className="min-w-0 truncate text-sm font-medium text-gray-800">
                                                {order.customer_name}
                                            </p>
                                            {order.is_delivery === "mesa" && (
                                                <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-brand">
                                                    <FontAwesomeIcon icon={faChair} />
                                                    {order.table_name_snapshot || "Mesa"}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {fmtDate(order.created_at)}
                                        </p>
                                    </div>

                                    <button
                                        onClick={(event) => {
                                            event.stopPropagation();
                                            onViewOrder?.(order);
                                        }}
                                        className="shrink-0 p-2 text-gray-400 transition-colors hover:text-brand"
                                        title="Ver Detalhes"
                                        aria-label={`Ver detalhes do pedido #${order.display_id || order.id.slice(0, 4)}`}
                                    >
                                        <FontAwesomeIcon icon={faEye} />
                                    </button>
                                </div>

                                <div className="flex items-center justify-between border-t border-gray-100 pt-3 text-sm">
                                    <span className="text-gray-500">Valor</span>
                                    <span className="font-semibold text-gray-900">
                                        {fmtMoney(order.total_cents)}
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            <div className="hidden md:block">
                {/* Header da Tabela */}
                <div className="bg-gray-50 border-b border-gray-200 grid grid-cols-12 px-6 2xl:px-8 2xl:py-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider 2xl:text-sm">
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
                            <div className="p-10 text-center text-gray-500 2xl:text-lg 2xl:p-18">
                                Nenhum pedido encontrado com estes filtros.
                            </div>
                        ) : (
                            orders.map((order) => (
                                <div
                                    key={order.id}
                                    role={onViewOrder ? "button" : undefined}
                                    tabIndex={onViewOrder ? 0 : undefined}
                                    onClick={() => onViewOrder?.(order)}
                                    onKeyDown={(event) => {
                                        if (onViewOrder && (event.key === "Enter" || event.key === " ")) {
                                            event.preventDefault();
                                            onViewOrder(order);
                                        }
                                    }}
                                    className={`grid grid-cols-12 px-6 py-4 2xl:py-5 items-center hover:bg-gray-50 transition-colors text-sm 2xl:text-[1.1rem] text-gray-700 ${onViewOrder ? "cursor-pointer" : ""}`}
                                >
                                    <div className="col-span-2 font-bold text-gray-900">
                                        #{order.display_id || order.id.slice(0, 4)}
                                    </div>
                                    <div className="col-span-3 flex min-w-0 items-center gap-2 pr-4 font-medium">
                                        <span className="min-w-0 truncate">{order.customer_name}</span>
                                        {order.is_delivery === "mesa" && (
                                            <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-brand 2xl:text-sm">
                                                <FontAwesomeIcon icon={faChair} />
                                                {order.table_name_snapshot || "Mesa"}
                                            </span>
                                        )}
                                    </div>
                                    <div className="col-span-2 text-gray-500">
                                        {fmtDate(order.created_at)}
                                    </div>
                                    <div className="col-span-2 font-medium">
                                        {fmtMoney(order.total_cents)}
                                    </div>
                                    <div className="col-span-2 ">
                                        <span className={"truncate"}>{getStatusBadge(order.status, order.is_delivery === "mesa" || order.is_delivery === "retirada")}</span>
                                    </div>
                                    <div className="col-span-1 text-right">
                                        <button
                                            onClick={(event) => {
                                                event.stopPropagation();
                                                onViewOrder?.(order);
                                            }}
                                            className="text-gray-400 hover:text-brand p-2 transition-colors cursor-pointer"
                                            title="Ver Detalhes"
                                        >
                                            <FontAwesomeIcon icon={faEye} />
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}
            </div>
        </Card>
    );
}
