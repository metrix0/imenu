"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";
import OrdersFilter from "@/components/painel/pedidos/OrdersFilter";
import OrdersTable, { Order } from "@/components/painel/pedidos/OrdersTable";
import OrderDetailsModal from "@/components/painel/pedidos/OrderDetailsModal";

const TABS = ["Todos", "Em aberto", "Concluídos", "Cancelados"];
const PAGE_SIZE = 10;

export default function PedidosPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [activeTab, setActiveTab] = useState("Todos");
    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    
    // Paginação
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(false);

    // Filtros
    const [searchId, setSearchId] = useState("");
    const [searchDate, setSearchDate] = useState("");
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

    // 2. Recarrega ao mudar filtros, aba ou página
    useEffect(() => {
        if (restaurantId) fetchOrders(restaurantId);
    }, [activeTab, restaurantId, page, searchId, searchDate, selectedStatus]);

    // Resetar página ao mudar filtros
    useEffect(() => {
        setPage(0);
    }, [activeTab, searchId, searchDate, selectedStatus]);

    // 3. Lógica de Busca
    const fetchOrders = async (restId: string) => {
        setIsLoading(true);
        try {
            let query = supabase
                .from("orders")
                .select("id, display_id, created_at, customer_name, status, total_cents", { count: 'exact' })
                .eq("restaurant_id", restId)
                .order("created_at", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            // Filtro por Aba
            if (activeTab === "Em aberto") {
                query = query.in("status", ["pending_online_payment", "pending_physical_payment", "preparing", "delivering"]);
            } else if (activeTab === "Concluídos") {
                query = query.eq("status", "done");
            } else if (activeTab === "Cancelados") {
                query = query.eq("status", "canceled");
            }

            // Filtros do Usuário
            if (searchId) query = query.eq("display_id", searchId);
            
            if (searchDate) {
                const start = new Date(`${searchDate}T00:00:00`); 
                const end = new Date(`${searchDate}T23:59:59.999`);
                
                query = query
                    .gte("created_at", start.toISOString())
                    .lte("created_at", end.toISOString());
            }

            if (selectedStatus !== "todas") query = query.eq("status", selectedStatus);

            const { data, error, count } = await query;
            if (error) throw error;

            setOrders(data as any[] || []);
            
            if (count !== null) {
                setHasMore((page + 1) * PAGE_SIZE < count);
            } else {
                setHasMore(data.length === PAGE_SIZE);
            }

        } catch (err) {
            console.error("Erro ao buscar pedidos:", err);
        } finally {
            setIsLoading(false);
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
        <div className="max-w-7xl mx-auto pb-20 space-y-8 px-4 sm:px-6 pt-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Histórico de Pedidos</h1>
            </div>

            <div className="border-b border-gray-200">
                <Tabs tabs={TABS} active={activeTab} onChange={setActiveTab} />
            </div>

            <OrdersFilter 
                searchId={searchId}
                setSearchId={setSearchId}
                searchDate={searchDate}
                setSearchDate={setSearchDate}
                selectedStatus={selectedStatus}
                setSelectedStatus={setSelectedStatus}
                onSearch={() => restaurantId && fetchOrders(restaurantId)}
            />

            <OrdersTable 
                orders={orders}
                isLoading={isLoading}
                onViewOrder={handleViewOrder} 
            />

            {!isLoading && (orders.length > 0 || page > 0) && (
                <div className="flex justify-center pt-4">
                    <div className="flex gap-2 items-center">
                        <Button 
                            variant="secondary" 
                            disabled={page === 0 || isLoading} 
                            onClick={() => setPage(p => Math.max(0, p - 1))}
                            className="px-4 py-2 text-xs"
                        >
                            Anterior
                        </Button>
                        <span className="text-sm text-gray-500 px-2">Página {page + 1}</span>
                        <Button 
                            variant="secondary" 
                            disabled={!hasMore || isLoading}
                            onClick={() => setPage(p => p + 1)}
                            className="px-4 py-2 text-xs"
                        >
                            Próxima
                        </Button>
                    </div>
                </div>
            )}

            <OrderDetailsModal 
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                order={selectedOrder}
                onOrderUpdate={handleOrderUpdate}
            />
        </div>
    );
}