"use client";

import type { PhysicalPaymentMethod } from "@/lib/payments/deliveryMethods";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faChair, faEye, faPenToSquare, faTrash, faStore, faBagShopping, faPersonBiking } from "@fortawesome/free-solid-svg-icons";
import { FileBadge } from "lucide-react";
import DataTable from "@/components/ui/DataTable";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import type { OrderStatus } from "../OrderCard";
import OrderBadge from "./OrderBadge";
import { NfceUpgradeButton } from "./NfceHistory";

export type Order = {
    payment_method: PhysicalPaymentMethod | "cartao" | "pix" | "ifood" | null;
    id: string;
    display_id: number;
    created_at: string;
    customer_name: string;
    customer_address?: string | null;
    status: OrderStatus;
    total_cents: number;
    is_delivery?: string | null;
    table_name_snapshot?: string | null;
};

interface OrdersTableProps {
    orders: Order[];
    isLoading: boolean;
    onViewOrder?: (order: Order) => void;
    onEditOrder?: (order: Order) => void;
    showFiscalActions?: (order: Order) => boolean;
    reserveFiscalSpace?: boolean;
    fiscalIds?: ReadonlySet<string>;
    fiscalPlus?: boolean | null;
    restaurantId?: string | null;
    onPaid?: () => void | Promise<void>;
    onViewFiscal?: (order: Order) => void;
    onDeleteOrder?: (order: Order) => void;
}

export default function OrdersTable({ orders, isLoading, onViewOrder, onEditOrder, onDeleteOrder, showFiscalActions, reserveFiscalSpace, fiscalIds, fiscalPlus, restaurantId, onPaid, onViewFiscal }: OrdersTableProps) {

    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });

    const statusBadge = (order: Order) => (
        <OrderBadge
            status={order.status}
            readyOnSite={order.is_delivery === "mesa" || order.is_delivery === "retirada" || order.is_delivery === "balcao"}
        />
    );

    const actionIconClass = "panel-history-action inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-gray-500 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand";

    const fiscalButton = (order: Order) => {
        const generated = Boolean(fiscalIds?.has(order.id));
        if (fiscalPlus === false && restaurantId && onPaid) {
            return <NfceUpgradeButton key="fiscal" iconOnly restaurant={restaurantId} onPaid={onPaid} />;
        }
        return (
            <button type="button" title={generated ? "Ver nota fiscal" : "Nota fiscal não emitida"}
                aria-label={generated ? "Ver nota fiscal do pedido" : "Nota fiscal ainda não emitida"}
                data-fiscal-muted={!generated}
                disabled={!generated || !onViewFiscal}
                className={`${actionIconClass} ${generated ? "" : "opacity-35"} disabled:cursor-default`}
                onKeyDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onViewFiscal?.(order); }}>
                <FileBadge className="panel-icon" size="1em" strokeWidth={1.75} aria-hidden="true" />
            </button>
        );
    };

    const actionButtons = (order: Order) => (
        <div className="flex shrink-0 items-center justify-end gap-1" style={reserveFiscalSpace ? { minWidth: 32 + 36 * (1 + Number(Boolean(onEditOrder)) + Number(Boolean(onDeleteOrder))) } : undefined}>
            {(showFiscalActions?.(order) ?? true) && fiscalButton(order)}
            <button type="button" title="Ver detalhes"
                aria-label={`Ver detalhes do pedido #${order.display_id || order.id.slice(0, 4)}`}
                className={actionIconClass}
                onKeyDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onViewOrder?.(order); }}>
                <FontAwesomeIcon icon={faEye} />
            </button>
            {onEditOrder && <button type="button" title="Editar pedido"
                aria-label={`Editar pedido #${order.display_id || order.id.slice(0, 4)}`}
                className={actionIconClass}
                onKeyDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onEditOrder(order); }}>
                <FontAwesomeIcon icon={faPenToSquare} />
            </button>}
            {onDeleteOrder && <button type="button" title="Excluir pedido"
                aria-label={`Excluir pedido #${order.display_id || order.id.slice(0, 4)}`}
                className={`${actionIconClass} panel-history-action-delete`}
                onKeyDown={event => event.stopPropagation()}
                onClick={event => { event.stopPropagation(); onDeleteOrder(order); }}>
                <FontAwesomeIcon icon={faTrash} />
            </button>}
        </div>
    );

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
                                            {statusBadge(order)}
                                        </div>
                                        <div className="mt-2 flex min-w-0 items-center gap-2">
                                            <p className="min-w-0 truncate text-sm font-medium text-gray-800">
                                                {order.customer_name}
                                            </p>
                                            {(order.is_delivery === "mesa" || order.is_delivery === "balcao" || order.is_delivery === "retirada") && (
                                                <span className="flex shrink-0 items-center gap-1.5 text-xs font-medium text-gray-500">
                                                    <FontAwesomeIcon icon={order.is_delivery === "balcao" ? faStore : order.is_delivery === "retirada" ? faBagShopping : faChair} />
                                                    {order.is_delivery === "balcao" ? "Balcão" : order.is_delivery === "retirada" ? "Retirada" : order.table_name_snapshot || "Mesa"}
                                                </span>
                                            )}
                                        </div>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {fmtDate(order.created_at)}
                                        </p>
                                    </div>

                                    {actionButtons(order)}
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
                        { key: "customer", label: "Cliente", render: order => <div className="max-w-xs"><div className="font-medium">{order.customer_name}</div>{order.customer_address && <div className="mt-1 truncate text-xs text-gray-500" title={order.customer_address}>{order.customer_address}</div>}</div> },
                        { key: "type", label: "Tipo", render: order => <span className="inline-flex items-center gap-1 whitespace-nowrap text-gray-500">{order.is_delivery === "balcao" ? <><FontAwesomeIcon icon={faStore} />Balcão</> : order.is_delivery === "retirada" ? <><FontAwesomeIcon icon={faBagShopping} />Retirada</> : order.is_delivery === "mesa" ? <><FontAwesomeIcon icon={faChair} />{order.table_name_snapshot || "Mesa"}</> : order.is_delivery === "entrega" ? <><FontAwesomeIcon icon={faPersonBiking} />Entrega</> : "—"}</span> },
                        { key: "date", label: "Data", render: order => <span className="whitespace-nowrap text-gray-500">{fmtDate(order.created_at)}</span> },
                        { key: "total", label: "Valor", render: order => <span className="whitespace-nowrap font-medium">{fmtMoney(order.total_cents)}</span> },
                        { key: "status", label: "Situação", render: order => statusBadge(order) },
                        { key: "action", label: "", render: order => actionButtons(order) },
                    ]} />
            </div>
        </Card>
    );
}
