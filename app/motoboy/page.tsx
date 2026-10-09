"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faArrowLeft, faLink, faTruck } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import OrderCard, { type OrderData } from "@/components/restaurant-owner/OrderCard";
import type { Order } from "@/components/restaurant-owner/pedidos/OrdersTable";
import OrderDetailsModal from "@/components/restaurant-owner/pedidos/OrderDetailsModal";
import { supabase } from "@/lib/database/supabaseClient";

const ORDER_SELECT = `*, order_items(id, item_id, pizza, quantity, price_cents, name, observation, total_cents, order_item_subitems(id, subitem_id, name, price_cents, quantity))`;
const DELIVERED_PAGE_SIZE = 50;
type Restaurant = { id: string; name: string | null };

export default function MotoboyPage() {
    const router = useRouter();
    const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
    const [pending, setPending] = useState<OrderData[]>([]);
    const [delivered, setDelivered] = useState<OrderData[]>([]);
    const deliveredLimitRef = useRef(DELIVERED_PAGE_SIZE);
    const [hasMoreDelivered, setHasMoreDelivered] = useState(false);
    const [loadingMore, setLoadingMore] = useState(false);
    const [ordersLoading, setOrdersLoading] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [linkCopied, setLinkCopied] = useState(false);
    const [selectedOrder, setSelectedOrder] = useState<OrderData | null>(null);
    const requestRef = useRef(0);

    const loadOrders = useCallback(async (restaurantId: string, limit: number) => {
        const request = ++requestRef.current;
        const [pendingResult, deliveredResult] = await Promise.all([
            supabase.from("orders").select(ORDER_SELECT).eq("restaurant_id", restaurantId)
                .eq("is_delivery", "entrega").eq("status", "delivering")
                .order("created_at", { ascending: false }),
            supabase.from("orders").select(ORDER_SELECT).eq("restaurant_id", restaurantId)
                .eq("is_delivery", "entrega").eq("status", "done")
                .order("created_at", { ascending: false }).order("id", { ascending: false }).limit(limit + 1),
        ]);
        if (request !== requestRef.current) return;
        setOrdersLoading(false);
        if (pendingResult.error || deliveredResult.error) {
            setError("Não foi possível carregar os pedidos.");
            return;
        }
        setError(null);
        setPending((pendingResult.data as OrderData[]) || []);
        setDelivered(((deliveredResult.data as OrderData[]) || []).slice(0, limit));
        setHasMoreDelivered((deliveredResult.data?.length || 0) > limit);
    }, []);

    useEffect(() => {
        let active = true;
        const init = async () => {
            try {
                const { data: { session } } = await supabase.auth.getSession();
                if (!active) return;
                if (!session?.user) {
                    router.replace("/restaurante/login?next=/motoboy");
                    return;
                }
                const { data, error: restaurantError } = await supabase.from("restaurants")
                    .select("id, name").eq("user_id", session.user.id).maybeSingle();
                if (!active) return;
                if (restaurantError || !data) throw new Error("Restaurante não encontrado.");
                setRestaurant(data);
            } catch (caught) {
                if (active) setError(caught instanceof Error ? caught.message : "Não foi possível carregar o painel.");
            } finally {
                if (active) setLoading(false);
            }
        };
        void init();
        return () => { active = false; requestRef.current++; };
    }, [router]);

    useEffect(() => {
        if (!restaurant) return;
        const refresh = () => void loadOrders(restaurant.id, deliveredLimitRef.current);
        const channel = supabase.channel(`motoboy-orders-${restaurant.id}`)
            .on("postgres_changes", { event: "*", schema: "public", table: "orders", filter: `restaurant_id=eq.${restaurant.id}` }, refresh)
            .subscribe((status) => { if (status === "SUBSCRIBED") refresh(); });
        refresh();
        window.addEventListener("focus", refresh);
        return () => {
            requestRef.current++;
            window.removeEventListener("focus", refresh);
            void supabase.removeChannel(channel);
        };
    }, [restaurant, loadOrders]);

    const copyLink = async () => {
        try {
            await navigator.clipboard.writeText(window.location.href);
            setLinkCopied(true);
            window.setTimeout(() => setLinkCopied(false), 2000);
        } catch { setError("Não foi possível copiar o link."); }
    };

    const loadMore = async () => {
        if (!restaurant) return;
        setLoadingMore(true);
        const nextLimit = deliveredLimitRef.current + DELIVERED_PAGE_SIZE;
        deliveredLimitRef.current = nextLimit;
        await loadOrders(restaurant.id, nextLimit);
        setLoadingMore(false);
    };

    if (loading) return <div className="flex min-h-screen items-center justify-center bg-gray-50"><Loader className="border-t-brand" /></div>;

    return (
        <main className="min-h-screen bg-gray-50 px-4 pb-16 pt-6 sm:px-6 sm:pt-8">
            <div className="mx-auto max-w-6xl [container-type:inline-size]">
                <Link href="/painel/motoboy-garcom" className="inline-flex items-center gap-2 text-sm text-gray-600 hover:text-brand">
                    <FontAwesomeIcon icon={faArrowLeft} />Voltar para painel
                </Link>
                <div className="mb-6 mt-5">
                    <div className="flex flex-wrap items-center gap-3">
                        <h1 className="flex items-center gap-3 text-3xl font-bold text-gray-900"><FontAwesomeIcon icon={faTruck} className="text-brand" />Motoboy</h1>
                        <button type="button" onClick={() => void copyLink()} aria-label="Copiar link do painel motoboy" title="Copiar link" className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-gray-100 hover:text-brand"><FontAwesomeIcon icon={faLink} /></button>
                        {linkCopied && <span className="text-sm font-medium text-brand">Link copiado</span>}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">{restaurant?.name || "Restaurante"}</p>
                </div>
                {error && <div role="alert" className="mb-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
                {restaurant && ordersLoading && <div className="flex h-64 items-center justify-center"><Loader /></div>}
                {restaurant && !ordersLoading && <>
                    {[{ title: "Pedidos para entrega", orders: pending }, { title: "Entregues", orders: delivered }].map((section) => (
                        <section key={section.title} className="mb-8">
                            <h2 className="mb-4 text-xl font-bold text-gray-900">{section.title}</h2>
                            {section.orders.length ? <div className="panel-orders">
                                {section.orders.map((order) => <OrderCard key={order.id} order={order} deliveryOnly onStatusChange={() => void loadOrders(restaurant.id, deliveredLimitRef.current)} onViewOrder={setSelectedOrder} />)}
                            </div> : <Card className="border border-gray-200 text-center shadow-sm"><p className="py-8 text-sm text-gray-500">Nenhum pedido.</p></Card>}
                        </section>
                    ))}
                    {hasMoreDelivered && <Button variant="secondary" loading={loadingMore} disabled={loadingMore} onClick={() => void loadMore()}>Carregar mais entregues</Button>}
                </>}
            </div>
            {selectedOrder && <OrderDetailsModal isOpen onClose={() => setSelectedOrder(null)} order={selectedOrder as Order} onOrderUpdate={() => restaurant && void loadOrders(restaurant.id, deliveredLimitRef.current)} />}
        </main>
    );
}
