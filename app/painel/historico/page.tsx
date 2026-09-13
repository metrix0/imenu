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

const PAGE_SIZE = 10;

export default function HistoricoPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);

    // Paginação
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const requestId = useRef(0);

    // Filtros
    const [search, setSearch] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [range, setRange] = useState<DateRange>({ startDate: "", endDate: "" });
    const [selectedStatus, setSelectedStatus] = useState("todas");

    // Modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

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
        if (restaurantId) fetchOrders(restaurantId);
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
            />

            {(totalCount > 0 || page > 0) && <Pagination page={page} pageCount={Math.ceil(totalCount / PAGE_SIZE)} onChange={setPage} disabled={isLoading} />}

            <OrderDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                order={selectedOrder}
                onOrderUpdate={handleOrderUpdate}
            />
        </div>
    );
}
