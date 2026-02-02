// app/painel/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient"; // Ajustado para o seu import padrão
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Ajustado para o seu import padrão
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShareAlt } from "@fortawesome/free-solid-svg-icons";

import OrderCard, { OrderData } from "@/components/restaurant-owner/OrderCard"; // Ajustado imports
import ShareMenuModal from "@/components/restaurant-owner/ShareMenuModal";
import OrderDetailsModal from "@/components/restaurant-owner/pedidos/OrderDetailsModal";

export default function PainelPedidosAtivosPage() {
    const [isLoading, setIsLoading] = useState(true);
    
    // 1. Recupera ID do Store Global para acesso imediato
    const { restaurantId, setRestaurantId, setRestaurantSlug, restaurantSlug } = useCreationStore();

    const [orders, setOrders] = useState<OrderData[]>([]);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // Novo: Estado para detalhes do pedido
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null); 
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);

    // --- FETCH ORDERS ---
    const fetchOrders = async (restId: string) => {
        const { data, error } = await supabase
            .from("orders")
            .select(`
                *,
                order_items (
                    id,
                    quantity,
                    price_cents,
                    name
                )
            `)
            .eq("restaurant_id", restId)
            // Filtra apenas pedidos ativos (fila de produção)
            .in("status", ["paid", "pending_physical_payment", "preparing", "delivering"])
            .order("created_at", { ascending: false }); // Mais antigos primeiro (FIFO)

        if (error) {
            console.error("Erro ao buscar pedidos:", error);
        } else {
            // Mapeamento para garantir compatibilidade com OrderCard se necessário
            // Se o backend já retorna 'name' no order_items (como vimos no fix anterior), isso funciona direto.
            setOrders(data as any[] || []);
        }
    };

    // --- HELPER PARA TRATAR FIRST TIME ---
    const handleFirstTime = async (restId: string, isFirstTime: boolean) => {
        if (isFirstTime) {
            console.log("🎉 Primeiro acesso detectado! Abrindo modal de compartilhamento.");
            setIsShareModalOpen(true);
            
            // Atualiza no banco para não abrir mais
            await supabase
                .from("restaurants")
                .update({ first_time: false })
                .eq("id", restId);
        }
    };

    const handleViewOrder = (order: OrderData) => {
        setSelectedOrder(order);
        setIsDetailsOpen(true);
    };

    // --- INIT ---
    useEffect(() => {
        const init = async () => {
            // CENÁRIO A: Já temos o ID no Zustand (Navegação interna)
            if (restaurantId) {
                fetchOrders(restaurantId);
                
                // Precisamos verificar o first_time e o slug mesmo se já tivermos o ID
                const { data } = await supabase
                    .from("restaurants")
                    .select("url_slug, first_time")
                    .eq("id", restaurantId)
                    .single();
                
                if (data) {
                    if (!restaurantSlug) setRestaurantSlug(data.url_slug);
                    // Verifica se é a primeira vez
                    handleFirstTime(restaurantId, data.first_time);
                }

                setIsLoading(false);
                return;
            }

            // CENÁRIO B: Não tem ID no Zustand (Refresh da página / Login direto)
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                setIsLoading(false);
                return;
            }

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id, url_slug, first_time") // <--- ADICIONADO first_time
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) {
                // Salva no Zustand
                setRestaurantId(restaurant.id);
                setRestaurantSlug(restaurant.url_slug);
                
                await fetchOrders(restaurant.id);
                
                // Verifica se é a primeira vez
                handleFirstTime(restaurant.id, restaurant.first_time);
            }
            setIsLoading(false);
        };

        init();
    }, [restaurantId, setRestaurantId]); 

    // --- REALTIME SUBSCRIPTION (DB > Client) ---
    useEffect(() => {
        if (!restaurantId) return;

        console.log("🔌 Conectando Realtime Pedidos para:", restaurantId);
        
        const channel = supabase
            .channel(`orders-live-${restaurantId}`)
            .on(
                "postgres_changes",
                {
                    event: "*", 
                    schema: "public",
                    table: "orders",
                    filter: `restaurant_id=eq.${restaurantId}`
                },
                (payload) => {
                    console.log("🔔 Atualização recebida:", payload);
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
                <p className="text-gray-400 mt-4">Carregando painel...</p>
            </div>
        );
    }

    if (!restaurantId) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[50vh] text-gray-500">
                <p>Nenhum restaurante encontrado para este usuário.</p>
            </div>
        );
    }

    return (
        <div className="max-w-7xl 2xl:max-w-[90rem] mx-auto pb-20 px-4 sm:px-6 pt-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">Pedidos de Hoje</h1>
                    <p className="text-gray-500 mt-1 2xl:text-lg 2xl:mt-2">Acompanhe a fila de produção em tempo real.</p>
                </div>

                <Button
                    onClick={() => setIsShareModalOpen(true)}
                    className="bg-brand text-white border-transparent hover:opacity-90 shadow-sm"
                >
                    <FontAwesomeIcon icon={faShareAlt} className="mr-2" />
                    Compartilhar Loja
                </Button>
            </div>

            {/* Grid de Pedidos */}
            {orders.length === 0 ? (
                <div className="text-center flex flex-col items-center py-20 2xl:py-30 bg-white rounded-xl border border-dashed border-gray-300">
                    <div className="h-25 w-25 2xl:h-30 2xl:w-30 mb-4 ">
                        <img src={"images/sleeping_emoji.png"} alt="Sem pedidos" className="h-full w-full object-contain" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 2xl:text-3xl">Sem pedidos ativos</h3>
                    <p className="text-gray-500 mt-2 2xl:text-lg">Esta página recebe pedidos automaticamente, não é necessário atualizar.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 2xl:gap-10">
                    {orders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            onStatusChange={() => fetchOrders(restaurantId)}
                            onViewOrder={handleViewOrder}
                        />
                    ))}
                </div>
            )}

            {/* Modal de Compartilhamento */}
            <ShareMenuModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                restaurantId={restaurantId}
                restaurantSlug={restaurantSlug ?? undefined}
            />
            {/* Modal de Detalhes do Pedido */}
            {selectedOrder && (
                <OrderDetailsModal 
                    isOpen={isDetailsOpen}
                    onClose={() => setIsDetailsOpen(false)}
                    order={selectedOrder}
                />
            )}
        </div>
    );
}