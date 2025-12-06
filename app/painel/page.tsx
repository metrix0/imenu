// app/painel/page.tsx
"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import { useCreationStore } from "@/lib/creationStore"; // IMPORTANTE: Usando o Store Global
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faShareAlt } from "@fortawesome/free-solid-svg-icons";

// Supondo que OrderCard já esteja criado em components/painel/OrderCard
import OrderCard, { OrderData } from "@/components/painel/OrderCard";
import ShareMenuModal from "@/components/painel/ShareMenuModal";

export default function PainelPedidosAtivosPage() {
    const [isLoading, setIsLoading] = useState(true);
    
    // 1. Recupera ID do Store Global para acesso imediato
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [restaurantSlug, setRestaurantSlug] = useState<string | undefined>(undefined);
    
    const [orders, setOrders] = useState<OrderData[]>([]);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);

    // --- FETCH ORDERS ---
    // Função isolada para poder ser chamada tanto no Load quanto no Realtime
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
            .in("status", ["pending_online_payment", "pending_physical_payment", "preparing", "delivering"]) 
            .order("created_at", { ascending: true }); // Mais antigos primeiro (FIFO)

        if (error) {
            console.error("Erro ao buscar pedidos:", error);
        } else {
            setOrders(data as any[] || []);
        }
    };

    // --- INIT ---
    useEffect(() => {
        const init = async () => {
            // Se já temos o ID no Zustand, carregamos os pedidos imediatamente (UX rápida)
            if (restaurantId) {
                fetchOrders(restaurantId);
                // Ainda buscamos o slug em background se não tivermos
                if (!restaurantSlug) {
                    const { data } = await supabase.from("restaurants").select("url_slug").eq("id", restaurantId).single();
                    if (data) setRestaurantSlug(data.url_slug);
                }
                setIsLoading(false);
                return;
            }

            // Fallback: Se não tem ID no Zustand (ex: deu refresh), busca via Auth
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) {
                // Redirecionar para login se necessário, ou mostrar erro
                setIsLoading(false);
                return;
            }

            const { data: restaurant } = await supabase
                .from("restaurants")
                .select("id, url_slug")
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) {
                // Salva no Zustand para as próximas navegações serem rápidas
                setRestaurantId(restaurant.id);
                setRestaurantSlug(restaurant.url_slug);
                await fetchOrders(restaurant.id);
            }
            setIsLoading(false);
        };

        init();
    }, [restaurantId, setRestaurantId]); // Dependência correta

    // --- REALTIME SUBSCRIPTION (DB > Client) ---
    useEffect(() => {
        if (!restaurantId) return;

        console.log("🔌 Conectando Realtime Pedidos para:", restaurantId);
        
        const channel = supabase
            .channel(`orders-live-${restaurantId}`)
            .on(
                "postgres_changes",
                {
                    event: "*", // Escuta INSERT (novo pedido) e UPDATE (mudança de status)
                    schema: "public",
                    table: "orders",
                    filter: `restaurant_id=eq.${restaurantId}`
                },
                (payload) => {
                    console.log("🔔 Atualização recebida:", payload);
                    // Recarrega a fila para garantir a ordem e dados atualizados
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
        <div className="max-w-7xl mx-auto pb-20 px-4 sm:px-6 pt-8">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Pedidos de Hoje</h1>
                    <p className="text-gray-500 mt-1">Acompanhe a fila de produção em tempo real.</p>
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
                <div className="text-center py-20 bg-white rounded-xl border border-dashed border-gray-300">
                    <div className="text-6xl mb-4">😴</div>
                    <h3 className="text-xl font-bold text-gray-900">Sem pedidos ativos</h3>
                    <p className="text-gray-500 mt-2">Sua loja está aberta e aguardando novos pedidos.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {orders.map(order => (
                        <OrderCard
                            key={order.id}
                            order={order}
                            // O fetchOrders será chamado quando o OrderCard chamar a API de status
                            // e o Realtime disparar, ou podemos forçar refresh aqui também.
                            onStatusChange={() => fetchOrders(restaurantId)}
                        />
                    ))}
                </div>
            )}

            {/* Modal de Compartilhamento */}
            <ShareMenuModal
                isOpen={isShareModalOpen}
                onClose={() => setIsShareModalOpen(false)}
                restaurantId={restaurantId}
                restaurantSlug={restaurantSlug}
            />
        </div>
    );
}