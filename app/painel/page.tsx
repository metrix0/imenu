// app/painel/page.tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient"; // Ajustado para o seu import padrão
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Ajustado para o seu import padrão
import { hasQrTableAccess } from "@/lib/qr-table/types";
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faShareAlt,
    faBell,
    faBellSlash,
    faPlus,
    faChair,
} from "@fortawesome/free-solid-svg-icons";
import OrderCard, {
    OrderData,
} from "@/components/restaurant-owner/OrderCard"; // Ajustado imports
import ShareMenuModal from "@/components/restaurant-owner/ShareMenuModal";
import OrderDetailsModal from "@/components/restaurant-owner/pedidos/OrderDetailsModal";
import CreatePanelOrderModal from "@/components/restaurant-owner/CreatePanelOrderModal";
import TablesOrdersModal from "@/components/restaurant-owner/mesas/TablesOrdersModal";
import {
    ORDER_REALTIME_EVENT,
    useOrderSound,
} from "@/components/restaurant-owner/OrderSoundProvider";

export default function PainelPedidosAtivosPage() {
    const [isLoading, setIsLoading] = useState(true);

    // 1. Recupera ID do Store Global para acesso imediato
    const {
        restaurantId,
        setRestaurantId,
        setRestaurantSlug,
        restaurantSlug,
    } = useCreationStore();

    const [orders, setOrders] = useState<OrderData[]>([]);
    const [isShareModalOpen, setIsShareModalOpen] = useState(false);
    const [isTablesModalOpen, setIsTablesModalOpen] = useState(false);
    const [hasMesasAccess, setHasMesasAccess] = useState(false);

    // Novo: Estado para detalhes do pedido
    const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const { soundEnabled, enableSound } = useOrderSound();
    const [isCreateOrderOpen, setIsCreateOrderOpen] = useState(false);

    // --- FETCH ORDERS ---
    const fetchOrders = useCallback(async (restId: string) => {
        const { data, error } = await supabase
            .from("orders")
            .select(`
      *,
      order_items (
        id,
        item_id,
        quantity,
        price_cents,
        name,
        observation,
        total_cents,
        order_item_subitems (
          id,
          subitem_id,
          name,
          price_cents,
          quantity
        )
      )
    `)
            .eq("restaurant_id", restId)
            .in("status", [
                "paid",
                "pending_physical_payment",
                "preparing",
                "delivering",
            ])
            .order("created_at", { ascending: false });

        if (error) {
            console.error("Erro ao buscar pedidos:", error);
            return;
        }

        setOrders((data as any[]) || []);
    }, []);

    const fetchMesasAccess = async (restId: string) => {
        const { data, error } = await supabase
            .from("restaurant_addons")
            .select("status, current_period_ends_at")
            .eq("restaurant_id", restId)
            .eq("product_key", "qr_code_mesa")
            .maybeSingle();

        if (error) {
            console.error("Erro ao verificar acesso Mesas:", error);
            setHasMesasAccess(false);
            return;
        }

        setHasMesasAccess(hasQrTableAccess(data));
    };

    // --- HELPER PARA TRATAR FIRST TIME ---
    const handleFirstTime = async (restId: string, isFirstTime: boolean) => {
        if (isFirstTime) {
            console.log(
                "🎉 Primeiro acesso detectado! Abrindo modal de compartilhamento.",
            );
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
                void fetchMesasAccess(restaurantId);

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
            const {
                data: { session },
            } = await supabase.auth.getSession();
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
                await fetchMesasAccess(restaurant.id);

                // Verifica se é a primeira vez
                handleFirstTime(restaurant.id, restaurant.first_time);
            }
            setIsLoading(false);
        };

        init();
    }, [restaurantId, setRestaurantId]);

    useEffect(() => {
        if (!restaurantId) return;

        const handleRealtimeUpdate = () => {
            void fetchOrders(restaurantId);
        };

        window.addEventListener(ORDER_REALTIME_EVENT, handleRealtimeUpdate);
        return () => {
            window.removeEventListener(
                ORDER_REALTIME_EVENT,
                handleRealtimeUpdate,
            );
        };
    }, [fetchOrders, restaurantId]);

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
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">
                        Pedidos de Hoje
                    </h1>
                    <p className="text-gray-500 mt-1 2xl:text-lg 2xl:mt-2">
                        Acompanhe a fila de produção em tempo real.
                    </p>
                </div>

                <div className="flex flex-row gap-2 sm:gap-3">
                    <Button
                        onClick={() => setIsCreateOrderOpen(true)}
                        className=""
                        variant="primary"
                    >
                        <FontAwesomeIcon icon={faPlus} className="mr-2" />
                        <span className="hidden sm:inline">Adicionar Pedido</span>
                        <span className="sm:hidden">Pedido</span>
                    </Button>

                    {hasMesasAccess && (
                        <Button
                            onClick={() => setIsTablesModalOpen(true)}
                            variant="secondary"
                        >
                            <FontAwesomeIcon icon={faChair} className="mr-2" />
                            Mesas
                        </Button>
                    )}

                    <Button
                        onClick={() => setIsShareModalOpen(true)}
                        variant="secondary"
                    >
                        <FontAwesomeIcon icon={faShareAlt} className="" />
                    </Button>

                    <div
                        className={`sm:hidden shrink-0 overflow-hidden transition-[max-width,opacity] delay-600 duration-300 ${
                            soundEnabled
                                ? "pointer-events-none max-w-0 opacity-0"
                                : "max-w-16 opacity-100"
                        }`}
                    >
                        <button
                            className={`p-4 cursor-pointer rounded-2xl transition-colors duration-300 ${
                                soundEnabled
                                    ? "bg-green/10 text-green-800"
                                    : "bg-warning-bg text-warning"
                            }`}
                            onClick={() => void enableSound()}
                            aria-label="Ativar som dos pedidos"
                        >
                            <FontAwesomeIcon
                                icon={soundEnabled ? faBell : faBellSlash}
                            />
                        </button>
                    </div>
                </div>
            </div>
            <div
                className={`hidden sm:block overflow-hidden delay-600 duration-300
                ${soundEnabled ? "pointer-events-none max-h-0" : "max-h-40"}
                `}
            >
                <div
                    className={` delay-600 duration-300
                    ${
                        soundEnabled
                            ? "opacity-0 -translate-y-2"
                            : "opacity-100 translate-y-0"
                    }
                    `}
                >
                    <div
                        className={`
        p-4 cursor-pointer w-fit px-8 rounded-2xl mb-6
        duration-300 ease-in-out 
        ${
            soundEnabled
                ? "bg-green/10 text-green-800"
                : "bg-warning-bg text-warning"
        }
      `}
                        onClick={() => void enableSound()}
                    >
                        {soundEnabled ? (
                            <>
                                <FontAwesomeIcon
                                    icon={faBell}
                                    className="mr-2"
                                />{" "}
                                Som ativado!
                            </>
                        ) : (
                            <>
                                <FontAwesomeIcon
                                    icon={faBellSlash}
                                    className="mr-2"
                                />
                                Clique para Ativar o <b>som dos pedidos</b>.
                            </>
                        )}
                    </div>
                </div>
            </div>
            {/* Grid de Pedidos */}
            {orders.length === 0 ? (
                <div className="truncate text-center flex flex-col items-center py-20 2xl:py-30 bg-white rounded-xl border border-dashed border-gray-300">
                    <div className="h-25 w-25 2xl:h-30 2xl:w-30 mb-4 ">
                        <img
                            src={"images/sleeping_emoji.png"}
                            alt="Sem pedidos"
                            className="h-full w-full object-contain"
                        />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 2xl:text-3xl">
                        Sem pedidos ativos
                    </h3>
                    <p className="text-gray-500 mt-2 2xl:text-lg">
                        Esta página recebe pedidos automaticamente, não é
                        necessário atualizar.
                    </p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 2xl:gap-10">
                    {orders.map((order) => (
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

            <CreatePanelOrderModal
                isOpen={isCreateOrderOpen}
                onClose={() => setIsCreateOrderOpen(false)}
                restaurantId={restaurantId}
                onCreated={async () => {
                    await fetchOrders(restaurantId);
                    setIsCreateOrderOpen(false);
                }}
            />

            <TablesOrdersModal
                open={isTablesModalOpen}
                onClose={() => setIsTablesModalOpen(false)}
                restaurantId={restaurantId}
                orders={orders}
                onViewOrder={(order) => {
                    setIsTablesModalOpen(false);
                    handleViewOrder(order);
                }}
            />
        </div>
    );
}
