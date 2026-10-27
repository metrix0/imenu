"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import Pagination from "@/components/ui/Pagination";
import { orderSearchFilter } from "@/lib/utils/orderSearch";
import type { DateRange } from "@/lib/utils/dateRange";
import OrdersFilter from "@/components/restaurant-owner/pedidos/OrdersFilter";
import OrdersTable, { Order } from "@/components/restaurant-owner/pedidos/OrdersTable";
import OrderDetailsModal from "@/components/restaurant-owner/pedidos/OrderDetailsModal";
import CreatePanelOrderModal from "@/components/restaurant-owner/CreatePanelOrderModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Toast from "@/components/ui/Toast";
import Link from "next/link";
import { faArrowRight, faChartLine } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Card from "@/components/ui/Card";
import DateRangePicker from "@/components/ui/DateRangePicker";



type CashOrder = {
    status: string;
    payment_method: string | null;
    total_cents: number;
    is_delivery: string | null;
};

const CASH_PAGE_SIZE = 1000;
const CASH_PAID_STATUSES = ["done", "paid", "preparing", "delivering"];
const formatCashTotal = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const cashDateToday = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value || "";
    return [part("year"), part("month"), part("day")].join("-");
};
const cashDateOffset = (daysAgo: number) => {
    const date = new Date(cashDateToday() + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
};
const formatCashDate = (date: string) =>
    new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
    });

function summarizeCashOrders(orders: CashOrder[]) {
    let total = 0, pix = 0, card = 0, cash = 0, unspecified = 0;
    let confirmed = 0, delivery = 0, pickup = 0, salon = 0;

    for (const order of orders) {
        if (!CASH_PAID_STATUSES.includes(order.status)) continue;
        const method = order.payment_method;
        const paidOnline = method === "pix" || method === "cartao";
        if (!paidOnline && order.status !== "done") continue;

        const cents = Number(order.total_cents || 0);
        total += cents;
        confirmed++;

        if (method === "pix" || method === "pix-entrega") pix += cents;
        else if (method === "cartao" || method === "trazer-maquininha") card += cents;
        else if (method === "dinheiro") cash += cents;
        else unspecified += cents;

        if (order.is_delivery === "entrega") delivery++;
        else if (order.is_delivery === "retirada") pickup++;
        else if (order.is_delivery === "mesa") salon++;
    }
    return { total, pix, card, cash, unspecified, confirmed, delivery, pickup, salon };
}

function DailyCashClosing({ restaurantId, refreshKey }: {
    restaurantId: string | null;
    refreshKey: number;
}) {
    const [dayOffset, setDayOffset] = useState(0);
    const [selectedDate, setSelectedDate] = useState<string | null>(null);
    const date = selectedDate ?? cashDateOffset(dayOffset);
    const [orders, setOrders] = useState<CashOrder[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        if (!restaurantId) { setLoading(false); return; }
        let canceled = false;
        const load = async () => {
            setLoading(true);
            setError("");
            setOrders([]);
            try {
                const [year, month, day] = date.split("-").map(Number);
                const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
                const all: CashOrder[] = [];

                while (true) {
                    const { data, error: queryError } = await supabase
                        .from("orders")
                        .select("id, status, payment_method, total_cents, is_delivery")
                        .eq("restaurant_id", restaurantId)
                        .gte("created_at", date + "T00:00:00-03:00")
                        .lt("created_at", nextDate + "T00:00:00-03:00")
                        .order("created_at", { ascending: true })
                        .order("id", { ascending: true })
                        .range(all.length, all.length + CASH_PAGE_SIZE - 1);

                    if (canceled) return;
                    if (queryError) throw queryError;
                    all.push(...((data || []) as CashOrder[]));
                    if (!data || data.length < CASH_PAGE_SIZE) break;
                }
                if (!canceled) setOrders(all);
            } catch (caught) {
                console.error("Erro ao carregar fechamento de caixa:", caught);
                if (!canceled) setError("Não foi possível carregar o fechamento de caixa.");
            } finally {
                if (!canceled) setLoading(false);
            }
        };
        void load();
        return () => { canceled = true; };
    }, [restaurantId, date, refreshKey]);

    const report = useMemo(() => summarizeCashOrders(orders), [orders]);

    return (
        <section aria-labelledby="cash-closing-heading" className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="cash-closing-heading" className="text-xl font-semibold text-gray-900">Fechamento de Caixa</h2>
                    <p className="mt-1 text-sm text-gray-500">Resumo de {formatCashDate(date)}</p>
                </div>
                <div className="inline-flex items-center gap-1 rounded-lg border border-[#e2e5e9] bg-white p-1">
                    {([{ value: 0, label: "Hoje" }, { value: 1, label: "Ontem" }] as const).map(day => (
                        <button
                            key={day.value}
                            type="button"
                            onClick={() => { setSelectedDate(null); setDayOffset(day.value); }}
                            aria-pressed={selectedDate === null && dayOffset === day.value}
                            className={selectedDate === null && dayOffset === day.value
                                ? "cursor-pointer rounded-md bg-[#f1f3f5] px-3 py-2 text-xs font-semibold text-gray-900"
                                : "cursor-pointer rounded-md px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"}
                        >
                            {day.label}
                        </button>
                    ))}
                    <DateRangePicker
                        label="Data"
                        value={{ startDate: date, endDate: date }}
                        onChange={range => { if (range.startDate) setSelectedDate(range.startDate); }}
                        presets={[]}
                        singleDate
                        iconOnly
                        active={selectedDate !== null}
                    />
                </div>
            </div>

            {error ? (
                <p className="text-sm text-red-600">{error}</p>
            ) : loading ? (
                <p className="py-4 text-sm text-gray-500" role="status">Calculando fechamento de caixa...</p>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">Total de vendas</p>
                        <p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums text-gray-900 2xl:text-3xl">
                            {formatCashTotal(report.total)}
                        </p>
                        <p className="mt-3 text-xs text-gray-500">{report.confirmed} pedidos pagos ou concluídos</p>
                    </Card>

                    <Card className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">Pedidos para entrega/retirada</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-gray-900 2xl:text-3xl">
                            {report.delivery + report.pickup}
                        </p>
                        <p className="mt-3 text-xs text-gray-500">{report.delivery} entregas · {report.pickup} retiradas</p>
                    </Card>

                    <Card className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">Pedidos no salão</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-gray-900 2xl:text-3xl">
                            {report.salon}
                        </p>
                        <p className="mt-3 text-xs text-gray-500">Pedidos de mesa concluídos</p>
                    </Card>

                    <Card className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">Vendas por pagamento</p>
                        <div className="mt-3 space-y-1.5 text-xs">
                            {([
                                { label: "Pix", value: report.pix },
                                { label: "Cartão", value: report.card },
                                { label: "Dinheiro", value: report.cash },
                            ] as const).map(item => (
                                <div key={item.label} className="flex items-baseline justify-between gap-2">
                                    <span className="text-gray-500">{item.label}</span>
                                    <span className="font-semibold tabular-nums text-gray-900">{formatCashTotal(item.value)}</span>
                                </div>
                            ))}
                            {report.unspecified > 0 && (
                                <div className="flex items-baseline justify-between gap-2 border-t border-gray-100 pt-1.5">
                                    <span className="text-gray-500">Não informado</span>
                                    <span className="font-semibold tabular-nums text-gray-900">{formatCashTotal(report.unspecified)}</span>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
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
    const [editingOrder, setEditingOrder] = useState<{ id: string } | null>(null);
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

            <DailyCashClosing restaurantId={restaurantId} refreshKey={cashRefreshKey} />

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
                onDeleteOrder={(order) => { setIsDetailsOpen(false); setOrderToDelete(order); }}
                onEditOrder={(order) => { setIsDetailsOpen(false); setEditingOrder({ id: order.id }); }}
            />
            {restaurantId && (
                <CreatePanelOrderModal
                    key={editingOrder?.id || "create"}
                    isOpen={editingOrder !== null}
                    onClose={() => setEditingOrder(null)}
                    restaurantId={restaurantId}
                    editingOrder={editingOrder}
                    onCreated={async () => { setEditingOrder(null); handleOrderUpdate(); }}
                />
            )}
        </div>
    );
}
