"use client";

import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faChair, faEye } from "@fortawesome/free-solid-svg-icons";
import DataTable from "@/components/ui/DataTable";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";

export type Order = {
    payment_method: "dinheiro" | "cartao" | "pix" | "trazer-maquininha";
    id: string;
    display_id: number;
    created_at: string;
    customer_name: string;
    customer_address?: string | null;
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
            pending_online_payment: "bg-yellow-100 text-yellow-700 border-yellow-200",
            pending_physical_payment: "bg-yellow-100 text-yellow-700 border-yellow-200",
            paid: "bg-yellow-100 text-yellow-700 border-yellow-200",
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
        <Card className="panel-history-table p-0 overflow-hidden border border-gray-200 shadow-sm">
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
                <DataTable rows={orders} rowKey={order => order.id} loading={isLoading} onRowClick={onViewOrder}
                    emptyMessage="Nenhum pedido encontrado com estes filtros." columns={[
                        { key: "number", label: "Pedido", render: order => <span className="font-semibold">#{order.display_id || order.id.slice(0, 4)}</span> },
                        { key: "customer", label: "Cliente", render: order => <div className="max-w-xs"><div className="font-medium">{order.customer_name}</div>{order.customer_address && <div className="mt-1 truncate text-xs text-gray-500" title={order.customer_address}>{order.customer_address}</div>}{order.is_delivery === "mesa" && <span className="inline-flex items-center gap-1 text-xs text-brand"><FontAwesomeIcon icon={faChair} />{order.table_name_snapshot || "Mesa"}</span>}</div> },
                        { key: "date", label: "Data", render: order => <span className="whitespace-nowrap text-gray-500">{fmtDate(order.created_at)}</span> },
                        { key: "total", label: "Valor", render: order => <span className="whitespace-nowrap font-medium">{fmtMoney(order.total_cents)}</span> },
                        { key: "status", label: "Situação", render: order => getStatusBadge(order.status, order.is_delivery === "mesa" || order.is_delivery === "retirada") },
                        { key: "action", label: "", render: order => <button type="button" aria-label={"Ver detalhes do pedido #" + (order.display_id || order.id.slice(0, 4))} onClick={event => { event.stopPropagation(); onViewOrder?.(order); }} className="rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-brand"><FontAwesomeIcon icon={faEye} /></button> },
                    ]} />
            </div>
        </Card>
    );
}
