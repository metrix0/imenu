"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faArrowLeft,
    faBellConcierge,
    faChair,
    faLink,
    faPlus,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
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
    table_id: string | null;
    table_name_snapshot: string | null;
    order_items: Array<{
        name: string;
        quantity: number;
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

    const loadData = useCallback(async () => {
        setLoading(true);
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
                        "id, display_id, created_at, customer_name, status, total_cents, table_id, table_name_snapshot, order_items(name, quantity)"
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
            setLoading(false);
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

    const copyWaiterLink = async () => {
        await navigator.clipboard.writeText(window.location.href);
        setLinkCopied(true);
        window.setTimeout(() => setLinkCopied(false), 2000);
    };

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
                                                            <div>
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
                                                                <p className="mt-1 text-sm text-gray-700">
                                                                    {order.customer_name || "Cliente"}
                                                                </p>
                                                            </div>
                                                            <div className="text-right">
                                                                <p className="text-sm font-semibold text-gray-900">
                                                                    {formatMoney(order.total_cents)}
                                                                </p>
                                                                <p className="mt-1 text-xs text-gray-400">
                                                                    {formatTime(order.created_at)}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        {order.order_items?.length > 0 && (
                                                            <p className="mt-2 border-t border-gray-100 pt-2 text-xs leading-relaxed text-gray-500">
                                                                {order.order_items
                                                                    .map(
                                                                        (item) =>
                                                                            `${item.quantity}x ${item.name}`
                                                                    )
                                                                    .join(" • ")}
                                                            </p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <Button
                                        type="button"
                                        className="w-full"
                                        onClick={() => addOrder(table)}
                                    >
                                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                                        Adicionar pedido
                                    </Button>
                                </Card>
                            );
                        })}
                    </div>
                )}
            </div>
        </main>
    );
}
