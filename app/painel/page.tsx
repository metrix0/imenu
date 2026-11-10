// app/painel/page.tsx
"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from "react";
import { supabase } from "@/lib/database/supabaseClient"; // Ajustado para o seu import padrão
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Ajustado para o seu import padrão
import Loader from "@/components/ui/Loader";
import Button from "@/components/ui/Button";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { Inbox } from "lucide-react";
import { useRouter } from "next/navigation";
import { hasOwnerPushSubscription } from "@/lib/push/client";
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

type PanelOrderModalHandle = { open: (order?: { id: string }) => void };

const PanelOrderModal = forwardRef<PanelOrderModalHandle, {
    restaurantId: string;
    onCreated: () => Promise<void>;
}>(function PanelOrderModal({ restaurantId, onCreated }, ref) {
    const [isOpen, setIsOpen] = useState(false);
    const [editingOrder, setEditingOrder] = useState<{ id: string } | null>(null);

    useImperativeHandle(ref, () => ({
        open: (order) => {
            setEditingOrder(order ?? null);
            setIsOpen(true);
        },
    }), []);

    return (
        <CreatePanelOrderModal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            editingOrder={editingOrder}
            restaurantId={restaurantId}
            onCreated={async () => {
                setIsOpen(false);
                await onCreated();
            }}
        />
    );
});

export default function PainelPedidosAtivosPage() {
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [pushEnabled, setPushEnabled] = useState<boolean | null>(null);

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
    const orderModalRef = useRef<PanelOrderModalHandle>(null);

    // --- FETCH ORDERS ---
    const fetchOrders = useCallback(async (restId: string) => {
        const { data, error } = await supabase
            .from("orders")
            .select(`
      *,
      order_items (
        id,
        item_id,
        pizza,
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

    const fetchMesasAccess = async (_restId: string) => {
        setHasMesasAccess(true);
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

                // Precisamos verificar o slug mesmo se já tivermos o ID
                const { data } = await supabase
                    .from("restaurants")
                    .select("url_slug")
                    .eq("id", restaurantId)
                    .single();

                if (data && !restaurantSlug) {
                    setRestaurantSlug(data.url_slug);
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
                .select("id, url_slug")
                .eq("user_id", session.user.id)
                .single();

            if (restaurant) {
                // Salva no Zustand
                setRestaurantId(restaurant.id);
                setRestaurantSlug(restaurant.url_slug);

                await fetchOrders(restaurant.id);
                await fetchMesasAccess(restaurant.id);

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

    // Mobile bell reports push notifications, independently of panel audio.
    useEffect(() => {
        if (!restaurantId) return;
        let mounted = true;
        let checkId = 0;
        const mobile = window.matchMedia("(max-width: 639px)");
        const refreshPushStatus = () => {
            if (!mobile.matches) return;
            const currentCheck = ++checkId;
            void hasOwnerPushSubscription(restaurantId)
                .then(enabled => {
                    if (mounted && checkId === currentCheck) setPushEnabled(enabled);
                })
                .catch(() => {
                    if (mounted && checkId === currentCheck) setPushEnabled(false);
                });
        };
        const onVisibilityChange = () => {
            if (!document.hidden) refreshPushStatus();
        };
        refreshPushStatus();
        window.addEventListener("focus", refreshPushStatus);
        mobile.addEventListener("change", refreshPushStatus);
        document.addEventListener("visibilitychange", onVisibilityChange);
        return () => {
            mounted = false;
            window.removeEventListener("focus", refreshPushStatus);
            mobile.removeEventListener("change", refreshPushStatus);
            document.removeEventListener("visibilitychange", onVisibilityChange);
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
            <div className="panel-page-heading flex flex-col xl:flex-row justify-between items-start xl:items-end gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900 2xl:text-4xl">
                        Pedidos de Hoje
                    </h1>
                    <p className="text-gray-500 mt-1 2xl:text-lg 2xl:mt-2">
                        Acompanhe a fila de produção em tempo real.
                    </p>
                </div>

                <div className="panel-page-actions flex flex-row items-center gap-2 sm:gap-3">
                    <div
                        className={`hidden sm:block shrink-0 ${
                            soundEnabled ? "pointer-events-none" : ""
                        }`}
                    >
                        <div
                            className={`delay-600 duration-300 ${
                                soundEnabled
                                    ? "opacity-0 -translate-y-2"
                                    : "opacity-100 translate-y-0"
                            }`}
                        >
                            <div
                                className={`
                                    inline-flex h-10 w-fit items-center cursor-pointer px-8 rounded-2xl
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
                                        <span>Clique para Ativar o <b>som dos pedidos</b>.</span>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    <Button
                        onClick={() => orderModalRef.current?.open()}
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
                        aria-label="Compartilhar cardápio"
                        variant="secondary"
                    >
                        <FontAwesomeIcon icon={faShareAlt} className="" />
                    </Button>

                    <div className="sm:hidden shrink-0">
                        <button
                            type="button"
                            className={`p-4 rounded-2xl transition-colors duration-300 ${
                                pushEnabled === null
                                    ? "bg-gray-100 text-gray-500"
                                    : pushEnabled
                                        ? "bg-green/10 text-green-800 cursor-default"
                                        : "bg-warning-bg text-warning cursor-pointer"
                            }`}
                            disabled={pushEnabled === null}
                            onClick={() => {
                                if (pushEnabled === false) router.push("/painel/aplicativo");
                            }}
                            aria-label={pushEnabled === null
                                ? "Verificando notificações de pedidos"
                                : pushEnabled
                                    ? "Notificações de pedidos ativas neste aparelho"
                                    : "Notificações de pedidos desativadas. Configurar"}
                            title={pushEnabled === null
                                ? "Verificando notificações"
                                : pushEnabled
                                    ? "Notificações de pedidos ativas"
                                    : "Configurar notificações de pedidos"}
                        >
                            <FontAwesomeIcon icon={pushEnabled ? faBell : faBellSlash} />
                        </button>
                    </div>
                </div>
            </div>
            {/* Grid de Pedidos */}
            {orders.length === 0 ? (
                <div className="panel-empty text-center flex flex-col items-center bg-white">
                    <Inbox className="panel-empty-icon" strokeWidth={1.75} aria-hidden="true" />
                    <h3 className="text-xl font-bold text-gray-900 2xl:text-3xl">
                        Sem pedidos ativos
                    </h3>
                    <p className="text-gray-500 mt-2 2xl:text-lg">
                        Esta página recebe pedidos automaticamente, não é
                        necessário atualizar.
                    </p>
                </div>
            ) : (
                <div className="panel-orders">
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
                    showStatusActions
                    onOrderUpdate={() => void fetchOrders(restaurantId)}
                    onEditOrder={(order) => {
                        setIsDetailsOpen(false);
                        orderModalRef.current?.open({ id: order.id });
                    }}
                />
            )}

            <PanelOrderModal
                ref={orderModalRef}
                restaurantId={restaurantId}
                onCreated={() => fetchOrders(restaurantId)}
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
