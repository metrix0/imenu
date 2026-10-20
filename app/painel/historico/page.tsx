"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import Pagination from "@/components/ui/Pagination";
import { orderSearchFilter } from "@/lib/utils/orderSearch";
import type { DateRange } from "@/lib/utils/dateRange";
import OrdersFilter from "@/components/restaurant-owner/pedidos/OrdersFilter";
import OrdersTable, { Order } from "@/components/restaurant-owner/pedidos/OrdersTable";
import OrderDetailsModal from "@/components/restaurant-owner/pedidos/OrderDetailsModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Toast from "@/components/ui/Toast";
import Link from "next/link";
import { faArrowRight, faChartLine } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Card from "@/components/ui/Card";
import { formatDate } from "@/lib/utils/dateRange";


type CashTotals = { pix: number; card: number; cash: number };

const CASH_PAGE_SIZE = 1000;
const CASH_STATUSES = ["done", "paid", "preparing", "delivering"];
const CASH_PAYMENT_METHODS = ["pix", "pix-entrega", "cartao", "trazer-maquininha", "dinheiro"];

const formatCashTotal = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function DailyCashClosing({ restaurantId, refreshKey }: {
    restaurantId: string | null;
    refreshKey: number;
}) {
    const date = formatDate(new Date());
    const [totals, setTotals] = useState<CashTotals>({ pix: 0, card: 0, cash: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);

    useEffect(() => {
        if (!restaurantId || !date) return;
        let canceled = false;

        const loadTotals = async () => {
            setLoading(true);
            setError(false);
            try {
                const [year, month, day] = date.split("-").map(Number);
                const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
                const sums: CashTotals = { pix: 0, card: 0, cash: 0 };
                let offset = 0;

                while (true) {
                    const { data, error: queryError } = await supabase
                        .from("orders")
                        .select("id, status, payment_method, total_cents")
                        .eq("restaurant_id", restaurantId)
                        .gte("created_at", date + "T00:00:00-03:00")
                        .lt("created_at", nextDate + "T00:00:00-03:00")
                        .in("status", CASH_STATUSES)
                        .in("payment_method", CASH_PAYMENT_METHODS)
                        .order("created_at", { ascending: true })
                        .order("id", { ascending: true })
                        .range(offset, offset + CASH_PAGE_SIZE - 1);

                    if (canceled) return;
                    if (queryError) throw queryError;

                    for (const order of data || []) {
                        const method = order.payment_method;
                        // Payments on delivery only count after the order is concluded.
                        if (order.status !== "done" && method !== "pix" && method !== "cartao") continue;
                        const amount = Number(order.total_cents || 0);
                        if (method === "pix" || method === "pix-entrega") sums.pix += amount;
                        else if (method === "cartao" || method === "trazer-maquininha") sums.card += amount;
                        else if (method === "dinheiro") sums.cash += amount;
                    }

                    if (!data || data.length < CASH_PAGE_SIZE) break;
                    offset += CASH_PAGE_SIZE;
                }

                if (!canceled) setTotals(sums);
            } catch (caught) {
                console.error("Erro ao carregar fechamento de caixa:", caught);
                if (!canceled) setError(true);
            } finally {
                if (!canceled) setLoading(false);
            }
        };

        void loadTotals();
        return () => { canceled = true; };
    }, [restaurantId, date, refreshKey]);

    const total = totals.pix + totals.card + totals.cash;

    return (
        <section>
            {error ? (
                <p className="text-sm text-red-600">Não foi possível carregar o fechamento de caixa.</p>
            ) : loading ? (
                <p className="py-4 text-sm text-gray-500" role="status">Calculando fechamento de caixa...</p>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                        {([
                            { key: "pix", label: "Pix" },
                            { key: "card", label: "Cartão" },
                            { key: "cash", label: "Dinheiro" },
                            { key: "total", label: "Total" },
                        ] as const).map(({ key, label }) => (
                            <div key={key} className="rounded-lg border border-gray-200 bg-gray-50 p-4">
                                <p className="text-sm text-gray-500">{label}</p>
                                <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{formatCashTotal(key === "total" ? total : totals[key])}</p>
                            </div>
                        ))}
                    </div>
                </>
            )}
        </section>
    );
}

const PAGE_SIZE = 10;

export default function HistoricoPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);

    // Paginação
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [cashRefreshKey, setCashRefreshKey] = useState(0);
    const requestId = useRef(0);

    // Filtros
    const [search, setSearch] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [range, setRange] = useState<DateRange>({ startDate: "", endDate: "" });
    const [selectedStatus, setSelectedStatus] = useState("todas");

    // Modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // 1. Inicialização (Busca ID se não tiver)
    useEffect(() => {
        const init = async () => {
            if (restaurantId) return; // Já temos ID no Zustand

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: rest } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (rest) {
                setRestaurantId(rest.id);
            }
        };
        init();
    }, [restaurantId, setRestaurantId]);

    useEffect(() => {
        const timer = window.setTimeout(() => { setSearchTerm(search); setPage(0); }, 250);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (restaurantId) void fetchOrders(restaurantId);
        return () => { requestId.current += 1; };
    }, [restaurantId, page, searchTerm, range.startDate, range.endDate, selectedStatus]);

    // 3. Lógica de Busca
    const fetchOrders = async (restId: string) => {
        const currentRequest = ++requestId.current;
        setIsLoading(true);
        try {
            let query = supabase
                .from("orders")
                .select("id, display_id, created_at, customer_name, customer_address, status, payment_method, is_delivery, table_name_snapshot, total_cents", { count: 'exact' })
                .eq("restaurant_id", restId)
                .neq("status", "pending_online_payment")
                .order("created_at", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            const searchFilter = orderSearchFilter(searchTerm);
            if (searchFilter) query = query.or(searchFilter);
            if (range.startDate) query = query.gte("created_at", new Date(range.startDate + "T00:00:00").toISOString());
            if (range.endDate) query = query.lte("created_at", new Date(range.endDate + "T23:59:59.999").toISOString());

            if (selectedStatus !== "todas") query = query.eq("status", selectedStatus);

            const { data, error, count } = await query;
            if (currentRequest !== requestId.current) return;
            if (error) throw error;

            setOrders(data as any[] || []);

            setTotalCount(count ?? data?.length ?? 0);

        } catch (err) {
            console.error("Erro ao buscar pedidos:", err);
        } finally {
            if (currentRequest === requestId.current) setIsLoading(false);
        }
    };

    const handleViewOrder = (order: Order) => {
        setSelectedOrder(order);
        setIsDetailsOpen(true);
    };

    // Callback chamado quando o modal altera status
    const handleOrderUpdate = () => {
        setCashRefreshKey(value => value + 1);
        if (restaurantId) fetchOrders(restaurantId);
    };

    const handleDeleteOrder = async () => {
        if (!restaurantId || !orderToDelete || isDeleting) return;
        setIsDeleting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Sessão inválida ou expirada.");

            const response = await fetch(`/api/orders/${orderToDelete.id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ restaurant_id: restaurantId }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) throw new Error(result?.error || "Não foi possível excluir o pedido.");

            setOrderToDelete(null);
            setToast({ message: "Pedido excluído.", type: "success" });
            setCashRefreshKey(value => value + 1);
            if (page > 0 && orders.length === 1) {
                setPage(page - 1);
            } else {
                await fetchOrders(restaurantId);
            }
        } catch (error) {
            setToast({
                message: error instanceof Error ? error.message : "Não foi possível excluir o pedido.",
                type: "error",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="max-w-7xl 2xl:max-w-9xl mx-auto pb-20 space-y-8 px-4 sm:px-6 pt-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Histórico de Pedidos</h1>
            </div>

            <DailyCashClosing restaurantId={restaurantId} refreshKey={cashRefreshKey} />

            <OrdersFilter
                search={search} onSearchChange={setSearch}
                range={range} onRangeChange={value => { setRange(value); setPage(0); }}
                selectedStatus={selectedStatus} onStatusChange={value => { setSelectedStatus(value); setPage(0); }}
            />

            <OrdersTable
                orders={orders}
                isLoading={isLoading}
                onViewOrder={handleViewOrder}
                onDeleteOrder={setOrderToDelete}
            />

            {(totalCount > 0 || page > 0) && <Pagination page={page} pageCount={Math.ceil(totalCount / PAGE_SIZE)} onChange={setPage} disabled={isLoading} />}

            <Card className="overflow-hidden border-brand/20 bg-brand/5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-brand shadow-sm">
                            <FontAwesomeIcon icon={faChartLine} />
                        </span>
                        <div className="min-w-0 max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                                Analytics
                            </p>
                            <h2 className="mt-1 text-lg font-bold text-gray-900 2xl:text-xl">
                                Quer entender melhor o que está por trás das vendas?
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-gray-600 2xl:text-base">
                                Descubra os itens mais pedidos, categorias que mais vendem, combinações de compra e outros indicadores do seu cardápio.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/painel/analytics"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                        Abrir Analytics
                        <FontAwesomeIcon icon={faArrowRight} />
                    </Link>
                </div>
            </Card>

            <ConfirmModal
                open={orderToDelete !== null}
                onClose={() => { if (!isDeleting) setOrderToDelete(null); }}
                onConfirm={() => void handleDeleteOrder()}
                title="Excluir pedido?"
                description={`O pedido #${orderToDelete?.display_id || orderToDelete?.id.slice(0, 4) || ""} será removido permanentemente do histórico e das métricas. A exclusão não reembolsa pagamentos.`}
                confirmLabel="Excluir pedido"
                isLoading={isDeleting}
                variant="danger"
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <OrderDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                order={selectedOrder}
                onOrderUpdate={handleOrderUpdate}
            />
        </div>
    );
}
