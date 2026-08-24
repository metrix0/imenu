"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faChair } from "@fortawesome/free-solid-svg-icons";

import type {
    OrderData,
    OrderStatus,
} from "@/components/restaurant-owner/OrderCard";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";

type RestaurantTable = {
    id: string;
    name: string;
};

const STATUS_LABELS: Record<OrderStatus, string> = {
    pending_online_payment: "Pendente",
    pending_physical_payment: "Pendente",
    paid: "Pendente",
    preparing: "Preparando",
    delivering: "Pronto",
    done: "Concluído",
    canceled: "Cancelado",
};

const STATUS_CLASSES: Record<OrderStatus, string> = {
    pending_online_payment: "bg-yellow-100 text-yellow-700",
    pending_physical_payment: "bg-yellow-100 text-yellow-700",
    paid: "bg-yellow-100 text-yellow-700",
    preparing: "bg-blue-100 text-blue-800",
    delivering: "bg-green-100 text-green-800",
    done: "bg-green-100 text-green-800",
    canceled: "bg-red-100 text-red-800",
};

function formatMoney(cents: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(cents / 100);
}

export default function TablesOrdersModal({
    open,
    onClose,
    restaurantId,
    orders,
}: {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    orders: OrderData[];
}) {
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!open) return;

        let active = true;
        const loadTables = async () => {
            setLoading(true);
            setError(false);

            const { data, error: tablesError } = await supabase
                .from("restaurant_tables")
                .select("id, name")
                .eq("restaurant_id", restaurantId)
                .eq("is_active", true)
                .order("position", { ascending: true })
                .order("created_at", { ascending: true });

            if (!active) return;
            setLoading(false);

            if (tablesError) {
                console.error("Erro ao carregar mesas:", tablesError);
                setError(true);
                return;
            }

            setTables((data as RestaurantTable[]) || []);
        };

        void loadTables();
        return () => {
            active = false;
        };
    }, [open, restaurantId]);

    const ordersByTable = useMemo(() => {
        const grouped = new Map<string, OrderData[]>();

        for (const order of orders) {
            if (order.is_delivery !== "mesa" || !order.table_id) continue;
            const current = grouped.get(order.table_id) || [];
            current.push(order);
            grouped.set(order.table_id, current);
        }

        return grouped;
    }, [orders]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            className="max-w-5xl"
            showCloseButton
        >
            <div className="border-b border-gray-100 px-6 pb-5 pt-6 sm:px-8">
                <h2 className="text-2xl font-bold text-gray-900">Mesas</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Veja os pedidos ativos de cada mesa.
                </p>
            </div>

            <div className="px-6 py-6 sm:px-8">
                {loading && (
                    <div className="flex min-h-48 items-center justify-center">
                        <Loader className="border-t-brand" />
                    </div>
                )}

                {!loading && error && (
                    <p className="py-12 text-center text-sm text-red-600">
                        Não foi possível carregar as mesas.
                    </p>
                )}

                {!loading && !error && tables.length === 0 && (
                    <p className="py-12 text-center text-sm text-gray-500">
                        Nenhuma mesa cadastrada.
                    </p>
                )}

                {!loading && !error && tables.length > 0 && (
                    <div className="grid gap-4 md:grid-cols-2">
                        {tables.map((table) => {
                            const tableOrders =
                                ordersByTable.get(table.id) || [];

                            return (
                                <Card
                                    key={table.id}
                                    className="border border-gray-200 shadow-none"
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div className="flex items-center gap-3">
                                            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                                <FontAwesomeIcon icon={faChair} />
                                            </span>
                                            <h3 className="font-bold text-gray-900">
                                                {table.name}
                                            </h3>
                                        </div>
                                        <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-600">
                                            {tableOrders.length}{" "}
                                            {tableOrders.length === 1
                                                ? "pedido"
                                                : "pedidos"}
                                        </span>
                                    </div>

                                    {tableOrders.length === 0 ? (
                                        <p className="mt-5 rounded-lg bg-gray-50 px-3 py-4 text-center text-sm text-gray-500">
                                            Sem pedidos ativos
                                        </p>
                                    ) : (
                                        <div className="mt-4 divide-y divide-gray-100 rounded-lg border border-gray-100">
                                            {tableOrders.map((order) => (
                                                <div
                                                    key={order.id}
                                                    className="flex items-center justify-between gap-3 px-3 py-3"
                                                >
                                                    <div className="min-w-0">
                                                        <p className="truncate text-sm font-semibold text-gray-900">
                                                            Pedido #{order.display_id || order.id.slice(0, 8)}
                                                        </p>
                                                        <p className="truncate text-xs text-gray-500">
                                                            {order.customer_name}
                                                        </p>
                                                    </div>
                                                    <div className="shrink-0 text-right">
                                                        <span className={`inline-flex rounded-full px-2 py-1 text-[11px] font-semibold ${STATUS_CLASSES[order.status]}`}>
                                                            {STATUS_LABELS[order.status]}
                                                        </span>
                                                        <p className="mt-1 text-xs font-semibold text-gray-700">
                                                            {formatMoney(order.total_cents)}
                                                        </p>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </Modal>
    );
}
