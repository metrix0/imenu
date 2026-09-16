"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faArrowLeft,
    faBellConcierge,
    faChair,
    faEye,
    faLink,
    faPlus,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Loader from "@/components/ui/Loader";
import OrderDetailsModal from "@/components/restaurant-owner/pedidos/OrderDetailsModal";
import { supabase } from "@/lib/database/supabaseClient";
import type { QrTableAddon } from "@/lib/qr-table/types";
import { hasQrTableAccess } from "@/lib/qr-table/types";

type Restaurant = {
    id: string;
    name: string | null;
    url_slug: string | null;
};

type RestaurantTable = {
    id: string;
    name: string;
    public_token: string;
    position: number;
};

type WaiterOrder = {
    id: string;
    display_id: number | null;
    created_at: string;
    customer_name: string | null;
    status: string;
    total_cents: number;
    payment_method: string | null;
    is_delivery: string | null;
    table_id: string | null;
    table_name_snapshot: string | null;
    order_items: Array<{
        name: string;
        quantity: number;
        price_cents: number;
    }>;
};

const OPEN_ORDER_STATUSES = [
    "paid",
    "pending_physical_payment",
    "preparing",
    "delivering",
];

const STATUS_LABELS: Record<string, string> = {
    paid: "Pendente",
    pending_physical_payment: "Pendente",
    preparing: "Preparando",
    delivering: "Pronto",
};

function formatMoney(cents: number): string {
    return (Number(cents) / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function formatTime(value: string): string {
    return new Date(value).toLocaleTimeString("pt-BR", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

function statusClasses(status: string): string {
    if (status === "preparing") {
        return "bg-blue-50 text-blue-700";
    }
    if (status === "delivering") {
        return "bg-green-50 text-green-700";
    }
    return "bg-amber-50 text-amber-700";
}

export default function GarcomPage() {
    const router = useRouter();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [tables, setTables] = useState<RestaurantTable[]>([]);
    const [orders, setOrders] = useState<WaiterOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [tableToFinalize, setTableToFinalize] = useState<RestaurantTable | null>(null);
    const [finishingTable, setFinishingTable] = useState(false);

    const loadData = useCallback(async (showLoader = true) => {
        if (showLoader) setLoading(true);
        setError(null);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.user) {
                router.replace("/restaurante/login?next=/garcom");
                return;
            }

            const { data: restaurantData, error: restaurantError } =
                await supabase
                    .from("restaurants")
                    .select("id, name, url_slug")
                    .eq("user_id", session.user.id)
                    .maybeSingle();

            if (restaurantError) throw restaurantError;
            if (!restaurantData?.id || !restaurantData.url_slug) {
                throw new Error("Restaurante não encontrado.");
            }

            const { data: addonData, error: addonError } = await supabase
                .from("restaurant_addons")
                .select("status, current_period_ends_at")
                .eq("restaurant_id", restaurantData.id)
                .eq("product_key", "qr_code_mesa")
                .maybeSingle();

            if (addonError) throw addonError;
            if (!hasQrTableAccess((addonData as QrTableAddon | null) || null)) {
                throw new Error("O iMenu QR Code Mesa não está ativo.");
            }

            const [tablesResult, ordersResult] = await Promise.all([
                supabase
                    .from("restaurant_tables")
                    .select("id, name, public_token, position")
                    .eq("restaurant_id", restaurantData.id)
                    .eq("is_active", true)
                    .order("position", { ascending: true })
                    .order("created_at", { ascending: true }),
                supabase
                    .from("orders")
                    .select(
                        "id, display_id, created_at, customer_name, status, total_cents, payment_method, is_delivery, table_id, table_name_snapshot, order_items(name, quantity, price_cents)"
                    )
                    .eq("restaurant_id", restaurantData.id)
                    .eq("is_delivery", "mesa")
                    .in("status", OPEN_ORDER_STATUSES)
                    .order("created_at", { ascending: false })
                    .limit(100),
            ]);

            if (tablesResult.error) throw tablesResult.error;
            if (ordersResult.error) throw ordersResult.error;

            setRestaurant(restaurantData as Restaurant);
            setTables((tablesResult.data as RestaurantTable[]) || []);
            setOrders((ordersResult.data as WaiterOrder[]) || []);
        } catch (caught) {
            console.error("Erro ao carregar página do garçom:", caught);
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Não foi possível carregar as mesas."
            );
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [router]);

    useEffect(() => {
        void loadData();
    }, [loadData]);

    const ordersByTable = useMemo(() => {
        const grouped = new Map<string, WaiterOrder[]>();

        for (const order of orders) {
            if (!order.table_id) continue;
            const current = grouped.get(order.table_id) || [];
            current.push(order);
            grouped.set(order.table_id, current);
        }

        return grouped;
    }, [orders]);

    const addOrder = (table: RestaurantTable) => {
        if (!restaurant?.url_slug) return;
        router.push(
            `/mesa/${encodeURIComponent(restaurant.url_slug)}/${encodeURIComponent(
                table.public_token
            )}?source=garcom`
        );
    };

    const finalizeTable = async () => {
        if (!tableToFinalize) return;

        const tableOrders = ordersByTable.get(tableToFinalize.id) || [];
        if (!tableOrders.length) {
            setTableToFinalize(null);
            return;
        }

        setFinishingTable(true);
        setError(null);

        try {
            await Promise.all(
                tableOrders.map(async (order) => {
                    const response = await fetch(`/api/orders/${order.id}/status-order`, {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ status: "done" }),
                    });

                    if (!response.ok) {
                        const payload = await response.json().catch(() => null);
                        throw new Error(payload?.error || "Não foi possível finalizar a mesa.");
                    }
                })
            );

            const finalizedTableId = tableToFinalize.id;
            setOrders((current) =>
                current.filter((order) => order.table_id !== finalizedTableId)
            );
            setTableToFinalize(null);
        } catch (caught) {
            console.error("Erro ao finalizar mesa:", caught);
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Não foi possível finalizar a mesa."
            );
            await loadData(false);
        } finally {
            setFinishingTable(false);
        }
    };

    const copyWaiterLink = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 2000);
    };

    const finalizingOrdersCount = tableToFinalize
        ? (ordersByTable.get(tableToFinalize.id) || []).length
        : 0;

    if (loading) {
        return (
            <div className="flex min-h-screen items-center justify-center bg-gray-50">
                <Loader className="border-t-brand" />
            </div>
        );
    }

    if (!restaurant) {
        return (
            <main className="min-h-screen bg-gray-50 px-4 py-8 sm:px-6">
                <div className="mx-auto max-w-3xl">
                    <Link
                        href="/painel/mesas"
                        className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-brand"
                    >
                        <FontAwesomeIcon icon={faArrowLeft} />
                        Voltar para painel
                    </Link>
                    {error && (
                        <Card className="mt-6 border border-gray-200 text-center shadow-sm">
                            <p className="text-sm text-gray-600">{error}</p>
                        </Card>
                    )}
                </div>
            </main>
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
            <div className="mx-auto max-w-6xl">
                <Link
                    href="/painel/mesas"
                    className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-brand"
                >
                    <FontAwesomeIcon icon={faArrowLeft} />
                    Voltar para painel
                </Link>

                <div className="mb-6 mt-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900">
                            <FontAwesomeIcon icon={faBellConcierge} className="text-brand" />
                            Garçom
                        </h1>
                        <button
                            type="button"
                            onClick={() => void copyWaiterLink()}
                            aria-label="Copiar link do painel garçom"
                            title="Copiar link"
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand"
                        >
                            <FontAwesomeIcon icon={faLink} />
                        </button>
                        {linkCopied && (
                            <span className="text-sm font-medium text-brand">
                                Link copiado
                            </span>
                        )}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">
                        {restaurant.name || "Restaurante"}
                    </p>
                </div>

                {error && (
                    <div className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {tables.length === 0 ? (
                    <Card className="border border-gray-200 text-center shadow-sm">
                        <div className="py-8 text-sm text-gray-500">
                            Nenhuma mesa cadastrada.
                        </div>
                    </Card>
                ) : (
                    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {tables.map((table) => {
                            const tableOrders = ordersByTable.get(table.id) || [];

                            return (
                                <Card
                                    key={table.id}
                                    className="flex flex-col border border-gray-200 shadow-sm"
                                >
                                    <div className="flex items-center justify-between gap-3 border-b border-gray-100 pb-4">
                                        <div className="flex min-w-0 items-center gap-3">
                                            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand/10 text-brand">
                                                <FontAwesomeIcon icon={faChair} />
                                            </span>
                                            <div className="min-w-0">
                                                <h2 className="truncate font-bold text-gray-900">
                                                    {table.name}
                                                </h2>
                                                <p className="text-xs text-gray-500">
                                                    {tableOrders.length === 0
                                                        ? "Sem pedidos em aberto"
                                                        : `${tableOrders.length} ${
                                                              tableOrders.length === 1
                                                                  ? "pedido em aberto"
                                                                  : "pedidos em aberto"
                                                          }`}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex-1 py-4">
                                        {tableOrders.length === 0 ? (
                                            <p className="py-3 text-center text-sm text-gray-400">
                                                Nenhum pedido nesta mesa.
                                            </p>
                                        ) : (
                                            <div className="space-y-3">
                                                {tableOrders.map((order) => (
                                                    <div
                                                        key={order.id}
                                                        className="rounded-lg border border-gray-200 bg-white p-3"
                                                    >
                                                        <div className="flex items-start justify-between gap-3">
                                                            <div className="min-w-0">
                                                                <div className="flex flex-wrap items-center gap-2">
                                                                    <span className="text-sm font-bold text-gray-900">
                                                                        #{order.display_id || order.id.slice(0, 4)}
                                                                    </span>
                                                                    <span
                                                                        className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${statusClasses(
                                                                            order.status
                                                                        )}`}
                                                                    >
                                                                        {STATUS_LABELS[order.status] || order.status}
                                                                    </span>
                                                                </div>
                                                                <p className="mt-1 truncate text-sm text-gray-700">
                                                                    {order.customer_name || "Cliente"}
                                                                </p>
                                                            </div>
                                                            <div className="flex shrink-0 items-start gap-2">
                                                                <div className="text-right">
                                                                    <p className="text-sm font-semibold text-gray-900">
                                                                        {formatMoney(order.total_cents)}
                                                                    </p>
                                                                    <p className="mt-1 text-xs text-gray-400">
                                                                        {formatTime(order.created_at)}
                                                                    </p>
                                                                </div>
                                                                <Button
                                                                    type="button"
                                                                    variant="secondary"
                                                                    className="h-9 w-9 shrink-0 px-0"
                                                                    onClick={() => setSelectedOrder(order)}
                                                                    title="Ver detalhes do pedido"
                                                                    aria-label={`Ver detalhes do pedido #${order.display_id || order.id.slice(0, 4)}`}
                                                                >
                                                                    <FontAwesomeIcon icon={faEye} />
                                                                </Button>
                                                            </div>
                                                        </div>

                                                        {order.order_items?.length > 0 && (
                                                            <div className="mt-3 space-y-2 border-t border-gray-100 pt-3">
                                                                {order.order_items.map((item, index) => (
                                                                    <div
                                                                        key={`${order.id}-item-${index}`}
                                                                        className="flex min-w-0 items-start justify-between gap-3 text-sm"
                                                                    >
                                                                        <div className="flex min-w-0 gap-2">
                                                                            <span className="shrink-0 font-bold text-gray-900">
                                                                                {item.quantity}x
                                                                            </span>
                                                                            <span className="min-w-0 break-words text-gray-700">
                                                                                {item.name}
                                                                            </span>
                                                                        </div>
                                                                        <span className="shrink-0 whitespace-nowrap text-gray-500">
                                                                            {formatMoney(item.price_cents * item.quantity)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <Button
                                            type="button"
                                            className="w-full"
                                            onClick={() => addOrder(table)}
                                        >
                                            <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                            Adicionar pedido
                                        </Button>
                                        <Button
                                            type="button"
                                            variant="secondary"
                                            className="w-full"
                                            disabled={tableOrders.length === 0}
                                            onClick={() => setTableToFinalize(table)}
                                        >
                                            Finalizar Mesa
                                        </Button>
                                    </div>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>

            <OrderDetailsModal
                isOpen={Boolean(selectedOrder)}
                onClose={() => setSelectedOrder(null)}
                order={selectedOrder}
                onOrderUpdate={() => void loadData(false)}
            />

            <ConfirmModal
                open={Boolean(tableToFinalize)}
                onClose={() => {
                    if (!finishingTable) setTableToFinalize(null);
                }}
                onConfirm={() => void finalizeTable()}
                title={`Finalizar ${tableToFinalize?.name || "mesa"}?`}
                description={`Os ${finalizingOrdersCount} ${finalizingOrdersCount === 1 ? "pedido em aberto será marcado como concluído" : "pedidos em aberto serão marcados como concluídos"}.`}
                confirmLabel="Finalizar Mesa"
                isLoading={finishingTable}
                variant="primary"
            />
        </main>
    );
}
