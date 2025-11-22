"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShareAlt } from "@fortawesome/free-solid-svg-icons";

import OrderCard, { OrderData } from "@/components/painel/OrderCard";
import ShareMenuModal from "@/components/painel/ShareMenuModal";

export default function PainelPedidosAtivosPage() {
    const [isLoading, setIsLoading] = useState(true);
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [restaurantSlug, setRestaurantSlug] = useState<string | undefined>(undefined);
    const [orders, setOrders] = useState<OrderData[]>([]);
    
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // --- FETCH INICIAL ---
    const fetchOrders = async (restId: string) => {
        // Busca pedidos que NÃO estão concluídos ou cancelados (fila ativa)
        const { data, error } = await supabase
            .from("orders")
            .select(`
                *,
                order_items (
                    id,
                    quantity,
                    price_at_purchase_cents,
                    item ( name )
                )
            `)
            .eq("restaurant_id", restId)
            .in("status", ["pending", "preparing", "delivering"]) 
            .order("created_at", { ascending: true }); // Mais antigos primeiro (fila)

        if (error) console.error("Erro ao buscar pedidos:", error);
        else setOrders(data as any[] || []);
    };

    useEffect(() => {
        const init = async () => {
            setIsLoading(true);
            // 1. Pega usuário
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            // 2. Pega restaurante
            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id, url_slug") // Supondo que url_slug é o campo do link amigável
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) {
                setRestaurantId(restaurant.id);
                setRestaurantSlug(restaurant.url_slug);
                await fetchOrders(restaurant.id);
            }
            setIsLoading(false);
        };

        init();
    }, []);

    // --- REALTIME SUBSCRIPTION ---
    useEffect(() => {
        if (!restaurantId) return;

        console.log("🔌 Conectando Realtime Pedidos...");
        const channel = supabase
            .channel(`orders-live-${restaurantId}`)
            .on(
                "postgres_changes",
                {
                    event: "*", // Escuta INSERT e UPDATE
                    schema: "public",
                    table: "orders",
                    filter: `restaurant_id=eq.${restaurantId}`
                },
                (payload) => {
                    console.log("🔔 Mudança em pedidos:", payload);
                    // Estratégia simples: Recarrega tudo para garantir integridade (JOINs etc)
                    // Em app gigante, faríamos optimistic update, mas aqui fetch é mais seguro
                    fetchOrders(restaurantId);
                }
            )
            .subscribe();

        return () => {
            supabase.removeChannel(channel);
        };
    }, [restaurantId]);


    if (isLoading) {
        return (
            <div className="flex flex-col justify-center items-center h-64">
                <Loader />
                <p className="text-gray-400 mt-4">Buscando pedidos em tempo real...</p>
            </div>
        );
    }

    if (!restaurantId) return <div className="p-8 text-center">Restaurante não encontrado.</div>;

    return (
        <div className="max-w-6xl mx-auto pb-20">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Pedidos de Hoje</h1>
                    <p className="text-gray-500 mt-1">Acompanhe a fila de produção em tempo real.</p>
                </div>
                
            <Button 
                onClick={() => setIsShareModalOpen(true)} 
                className="bg-brand text-white border border-transparent hover:opacity-90 shadow-sm transition-opacity"
            >
                <FontAwesomeIcon icon={faShareAlt} className="mr-2" />
                Compartilhar Loja
            </Button>
            </div>

            {/* Kanban / Grid de Pedidos */}
            {orders.length === 0 ? (
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <div className="text-6xl mb-4">😴</div>
                    <h3 className="text-xl font-bold text-gray-900">Sem pedidos ativos no momento</h3>
                    <p className="text-gray-500">Quando um cliente pedir, ele aparecerá aqui automaticamente.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map(order => (
                        <OrderCard 
                            key={order.id} 
                            order={order} 
                            onStatusChange={() => fetchOrders(restaurantId)}
                        />
                    ))}
                </div>
            )}

            {/* Modais */}
            <ShareMenuModal 
                isOpen={isShareModalOpen} 
                onClose={() => setIsShareModalOpen(false)} 
                restaurantId={restaurantId}
                restaurantSlug={restaurantSlug}
            />
        </div>
    );
}