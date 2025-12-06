"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Tabs from "@/components/ui/Tabs";
import Button from "@/components/ui/Button";

// Componentes Refatorados
import OrdersFilter from "@/components/painel/pedidos/OrdersFilter";
import OrdersTable, { Order } from "@/components/painel/pedidos/OrdersTable";

const TABS = ["Todos", "Em aberto", "Concluídos", "Cancelados"];

export default function PedidosPage() {
    const [activeTab, setActiveTab] = useState("Todos");
    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);

    // Estados de Filtro
    const [searchId, setSearchId] = useState("");
    const [searchDate, setSearchDate] = useState("");
    const [selectedStatus, setSelectedStatus] = useState("todas");

    // 1. Inicialização
    useEffect(() => {
        const init = async () => {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: rest } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (rest) {
                setRestaurantId(rest.id);
                fetchOrders(rest.id);
            }
        };
        init();
    }, []);

    // 2. Recarrega ao mudar aba
    useEffect(() => {
        if (restaurantId) fetchOrders(restaurantId);
    }, [activeTab, restaurantId]);

    // 3. Lógica de Busca
    const fetchOrders = async (restId: string) => {
        setIsLoading(true);
        try {
            let query = supabase
                .from("orders")
                .select("id, display_id, created_at, customer_name, status, total_cents")
                .eq("restaurant_id", restId)
                .order("created_at", { ascending: false });

            // Filtro por Aba
            if (activeTab === "Em aberto") {
                query = query.in("status", ["pending", "preparing", "delivering"]);
            } else if (activeTab === "Concluídos") {
                query = query.eq("status", "finished");
            } else if (activeTab === "Cancelados") {
                query = query.eq("status", "cancelled");
            }

            // Filtros do Usuário
            if (searchId) query = query.eq("display_id", searchId);
            
            if (searchDate) {
                const start = new Date(searchDate); start.setHours(0, 0, 0, 0);
                const end = new Date(searchDate); end.setHours(23, 59, 59, 999);
                query = query.gte("created_at", start.toISOString()).lte("created_at", end.toISOString());
            }

            if (selectedStatus !== "todas") query = query.eq("status", selectedStatus);

            const { data, error } = await query;
            if (error) throw error;

            setOrders(data as any[] || []);

        } catch (err) {
            console.error("Erro ao buscar pedidos:", err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto pb-20 space-y-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Pedidos</h1>
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
            />

            {/* Paginação Simples */}
            {!isLoading && orders.length > 0 && (
                <div className="flex justify-center pt-4">
                    <div className="flex gap-2">
                        <Button variant="secondary" disabled className="px-4 py-2 text-xs">Anterior</Button>
                        <Button variant="secondary" className="px-4 py-2 text-xs">Próxima</Button>
                    </div>
                </div>
            )}
        </div>
    );
}