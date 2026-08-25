"use client";

import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faUser, faMapMarkerAlt, faClock, faReceipt, faCheck, faMotorcycle, faCalendarDays, faChair } from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/utils/fontawesome";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Button from "@/components/ui/Button";
import ListLoader from "@/components/ui/ListLoader";
import { Order } from "./OrdersTable"; 

interface OrderDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null; 
    onOrderUpdate?: () => void; 
}

type OrderDetail = Omit<Order, "status"> & {
    status: Order["status"] | "paid";
    subtotal_cents: number;
    delivery_cents: number;
    coupon_discount_cents: number | null;
    coupon_code: string | null;
    customer_phone: string | null;
    customer_address: string | null;
    payment_ref: string | null;
    delivery_eta: string | null;
    scheduled_for: string | null;
    is_delivery?: string | null;
    table_id?: string | null;
    table_name_snapshot?: string | null;
    order_items: Array<{
        id: string;
        quantity: number;
        price_cents: number;
        name: string;
        observation: string | null;
        order_item_subitems: Array<{
            id: string;
            name: string;
            price_cents: number;
            quantity: number;
        }>;
    }>;
};

export default function OrderDetailsModal({ isOpen, onClose, order, onOrderUpdate }: OrderDetailsModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [details, setDetails] = useState<OrderDetail | null>(null);
    const [showRefundConfirmation, setShowRefundConfirmation] = useState(false);
    const isTableOrder = details?.is_delivery === "mesa" || order?.is_delivery === "mesa";
    const isPickup = isTableOrder || details?.is_delivery === "retirada" || order?.is_delivery === "retirada";
    const isPaidOnlinePix = details?.status === "paid" && details?.payment_method === "pix";

    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleString("pt-BR");
    const storedCouponDiscountCents = Number(details?.coupon_discount_cents) || 0;
    const derivedCouponDiscountCents = details
        ? Math.max(
            (Number(details.subtotal_cents) || 0) +
            (Number(details.delivery_cents) || 0) -
            (Number(details.total_cents) || 0),
            0
        )
        : 0;
    const couponDiscountCents = storedCouponDiscountCents > 0
        ? storedCouponDiscountCents
        : derivedCouponDiscountCents;

    const formatEtaRange = (iso: string | null | undefined) => {
        if (!iso) return null;
        const center = new Date(iso);
        if (Number.isNaN(center.getTime())) return null;

        const start = new Date(center.getTime() - 10 * 60_000);
        const end = new Date(center.getTime() + 10 * 60_000);
        const formatTime = (date: Date) =>
            date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        return `${formatTime(start)} - ${formatTime(end)}`;
    };

    const formatScheduledRelativeTime = (date: Date) => {
        const diffMinutes = (date.getTime() - Date.now()) / 60000;
        if (Math.abs(diffMinutes) < 1) return "agora";

        const future = diffMinutes > 0;
        const absoluteMinutes = future
            ? Math.ceil(diffMinutes)
            : Math.floor(Math.abs(diffMinutes));
        const prefix = future ? "em" : "há";

        if (absoluteMinutes < 60) return `${prefix} ${absoluteMinutes} min`;

        const hours = Math.floor(absoluteMinutes / 60);
        const minutes = absoluteMinutes % 60;

        if (absoluteMinutes > 600 || minutes === 0) {
            return `${prefix} ${hours} h`;
        }

        return `${prefix} ${hours} h ${minutes} min`;
    };

    const scheduledDate = details?.scheduled_for ? new Date(details.scheduled_for) : null;
    const isScheduled = !isTableOrder && Boolean(scheduledDate && !Number.isNaN(scheduledDate.getTime()));
    const scheduledLabel = isScheduled && scheduledDate
        ? `${scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })} (${formatScheduledRelativeTime(scheduledDate)})`
        : null;
    const etaRange = !isScheduled ? formatEtaRange(details?.delivery_eta) : null;

    const wasOpenRef = useRef(isOpen);

    useEffect(() => {
        const wasOpen = wasOpenRef.current;
        wasOpenRef.current = isOpen;

        if (isOpen && order) {
            fetchDetails();
            return;
        }

        setShowRefundConfirmation(false);

        if (!wasOpen) {
            setDetails(null);
            return;
        }

        const closeTimer = window.setTimeout(() => {
            setDetails(null);
        }, 220);

        return () => window.clearTimeout(closeTimer);
    }, [isOpen, order]);

    const fetchDetails = async () => {
        if (!order) return;
        setIsLoading(true);
        try {
            // Leitura permitida via Client (SELECT)
            const { data, error } = await supabase
                .from("orders")
                .select(`
    *,
    order_items (
      id,
      quantity,
      price_cents,
      name,
      observation,
      order_item_subitems (
        id,
        name,
        price_cents,
        quantity
      )
    )
  `)
                .eq("id", order.id)
                .single();

            if (error) throw error;
            setDetails(data as any);
        } catch (err) {
            console.error("Erro ao carregar detalhes:", err);
        } finally {
            setIsLoading(false);
        }
    };

    // AÇÃO: Mudar Status via API
    const handleStatusUpdate = async (newStatus: string) => {
        if (!details) return;
        setIsUpdating(true);
        try {
            // CORREÇÃO: Usando API Route
            const response = await fetch(`/api/orders/${details.id}/status-order`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus }),
            });

            if (!response.ok) {
                const payload = await response.json().catch(() => null);
                throw new Error(payload?.error || "Falha ao atualizar");
            }

            // Atualiza localmente para feedback instantâneo
            setDetails(prev => prev ? { ...prev, status: newStatus as any } : null);
            
            // Notifica o pai para recarregar a lista
            if (onOrderUpdate) onOrderUpdate();

        } catch (err) {
            alert(err instanceof Error ? err.message : "Erro ao atualizar pedido. Tente novamente.");
            console.error(err);
        } finally {
            setIsUpdating(false);
        }
    };


    const renderStatus = (status: string) => {
        const labels: Record<string, string> = {
            pending_online_payment: "À Pagar",
            pending_physical_payment: isPickup ? "Pendente" : "Pendente (Pgt. Entrega)",
            paid: "Pendente (Pago)",
            preparing: "Preparando",
            delivering: isPickup ? "Pronto" : "Em Rota",
            done: "Concluído",
            canceled: "Cancelado",
            dinheiro: "Dinheiro",
            "pix-entrega": "Pix Entrega",
            cartao: "Cartão (Online)",
            pix: "Pix (Online)",
            "trazer-maquininha": "Maquininha",
            retirada: "Retirada",
        };
        const colors: Record<string, string> = {
            pending_online_payment: "bg-yellow-100 text-yellow-800",
            pending_physical_payment: "bg-yellow-100 text-yellow-800",
            paid: "bg-yellow-100 text-yellow-800",
            preparing: "bg-blue-100 text-blue-800 border-blue-200",
            delivering: isPickup ? "bg-green-100 text-green-800 border-green-200" : "bg-purple-100 text-purple-800",
            done: "bg-green-100 text-green-800 border-green-200",
            canceled: "bg-red-200 text-red-800 border-red-200",
            dinheiro: "bg-gray-200 text-gray-800",
            "pix-entrega": "bg-gray-200 text-gray-800",
            cartao: "bg-gray-200 text-gray-800",
            pix: "bg-gray-200 text-gray-800",
            "trazer-maquininha": "bg-gray-200 text-gray-800",
            retirada: "bg-gray-200 text-gray-800 font-bold",
        };
        return (
            <span className={`2xl:text-base 2xl:px-3 px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100"}`}>
                {labels[status] || status}
            </span>
        );
    };

    const renderActions = () => {
        if (!details || isUpdating) return null;

        if (
            details.status === "pending_online_payment" ||
            details.status === "pending_physical_payment" ||
            isPaidOnlinePix
        ) {
            return (
                <>
                    <Button
                        variant="secondary"
                        onClick={() => setShowRefundConfirmation(true)}
                        className="text-red-600 hover:bg-red-50 border-red-200"
                    >
                        Rejeitar
                    </Button>
                    <Button variant="primary" onClick={() => handleStatusUpdate("preparing")}>
                        <FontAwesomeIcon icon={faCheck} className="mr-2" /> Aceitar Pedido
                    </Button>
                </>
            );
        }

        switch (details.status) {
            case "preparing":
                return isPickup ? (
                    <Button variant="primary" className="bg-green-600 hover:bg-green-700 border-green-600" onClick={() => handleStatusUpdate("delivering")}>
                        <FontAwesomeIcon icon={faCheck} className="mr-2" /> Pronto
                    </Button>
                ) : (
                    <Button variant="primary" onClick={() => handleStatusUpdate("delivering")}>
                        <FontAwesomeIcon icon={faMotorcycle} className="mr-2" /> Saiu para Entrega
                    </Button>
                );
            case "delivering":
                return (
                    <Button variant="primary" className="bg-green-600 hover:bg-green-700 border-green-600" onClick={() => handleStatusUpdate("done")}>
                        <FontAwesomeIcon icon={faCheck} className="mr-2" /> {isPickup ? "Entregue" : "Concluir Pedido"}
                    </Button>
                );
            default:
                return null;
        }
    };
    console.log(order)

    return (
        <>
            <Modal open={isOpen} onClose={onClose}>
                <div className="w-full max-w-2xl bg-white rounded-lg flex flex-col max-h-[92dvh] sm:max-h-[85vh]">
                    {/* Header */}
                    <div className="p-4 sm:p-5 border-b border-gray-100 flex justify-between items-start gap-3">
                        <div>
                            <div className="flex min-w-0 flex-wrap items-center gap-2 sm:gap-3 mb-1">
                                <h2 className="text-xl 2xl:text-2xl font-bold text-gray-900">
                                    Pedido #{order?.display_id}
                                </h2>
                                {(details || order) && renderStatus(details?.status || order!.status)}
                                {order && (isTableOrder ? (
                                    <span className="inline-flex items-center gap-1.5 rounded-full bg-brand/10 px-2.5 py-0.5 text-xs font-medium text-brand 2xl:px-3 2xl:text-base">
                                        <FontAwesomeIcon icon={faChair} />
                                        {details?.table_name_snapshot || order.table_name_snapshot || "Mesa"}
                                    </span>
                                ) : renderStatus(isPickup ? "retirada" : order.payment_method))}
                            </div>
                            <p className="text-xs text-gray-500 flex items-center gap-1 2xl:text-base">
                                <FontAwesomeIcon icon={faClock} /> Realizado em {order && fmtDate(order.created_at)}
                            </p>
                        </div>
                        <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 cursor-pointer">
                            <FontAwesomeIcon icon={icons.faTimes} className="text-xl" />
                        </button>
                    </div>

                    {/* Body */}
                    <div className="p-4 sm:p-6 overflow-y-auto flex-1">
                        {isLoading || !details ? (
                            <div className="space-y-4">
                                <ListLoader lines={2} />
                                <div className="h-8" />
                                <ListLoader lines={4} />
                            </div>
                        ) : (
                            <div className="space-y-8">
                                {/* Cliente */}
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-3 2xl:space-y-6">
                                        <h4 className="text-sm 2xl:text-base font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1">Cliente</h4>
                                        <div className="text-sm 2xl:text-base">
                                            <p className="font-medium text-gray-900 flex items-center gap-2 2xl:gap-3">
                                                <FontAwesomeIcon icon={faUser} className="text-gray-400 w-4" />
                                                {details.customer_name}
                                            </p>
                                            {details.customer_phone && (
                                                <p className="text-gray-500 ml-6 2xl:ml-8 mt-1 2xl:text-base">{details.customer_phone}</p>
                                            )}
                                        </div>
                                    </div>
                                    <div className="space-y-3 2xl:space-y-6">
                                        <h4 className="text-sm 2xl:text-base font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1">{isTableOrder ? "Mesa" : isPickup ? "Retirada" : "Entrega"}</h4>
                                        <div className="text-sm 2xl:text-[1.1rem]">
                                            {isTableOrder ? (
                                                <p className="flex items-center gap-2 font-medium text-gray-600">
                                                    <FontAwesomeIcon icon={faChair} className="w-4 text-gray-400" />
                                                    {details.table_name_snapshot || "Mesa"}
                                                </p>
                                            ) : isPickup ? (
                                                <p className="text-gray-600 font-medium">Retirada no balcão</p>
                                            ) : details.customer_address ? (
                                                <p className="text-gray-600 flex items-start gap-2">
                                                    <FontAwesomeIcon icon={faMapMarkerAlt} className="text-gray-400 w-4 mt-0.5 2xl:mt-0.8" />
                                                    {details.customer_address}
                                                </p>
                                            ) : (
                                                <p className="text-gray-500 italic">Retirada no local</p>
                                            )}
                                            {isScheduled && scheduledLabel ? (
                                                <p className="mt-2 flex items-center gap-2 font-medium text-green-700">
                                                    <FontAwesomeIcon icon={faCalendarDays} className="w-4" />
                                                    Agendado para {scheduledLabel}
                                                </p>
                                            ) : etaRange ? (
                                                <p className="mt-2 flex items-center gap-2 text-gray-500">
                                                    <FontAwesomeIcon icon={faClock} className="w-4" />
                                                    {isPickup ? "Previsão de retirada" : "Previsão de entrega"}: {etaRange}
                                                </p>
                                            ) : null}
                                        </div>
                                    </div>
                                </div>

                                {/* Itens */}
                                <div>
                                    <h4 className="text-sm 2xl:text-base font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-3 flex items-center gap-2">
                                        <FontAwesomeIcon icon={faReceipt} className="text-gray-400" /> Resumo do Pedido
                                    </h4>
                                    <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                        {details.order_items.map((item, idx) => (
                                            <div
                                                key={item.id}
                                                className={`flex justify-between items-start gap-3 p-3 ${
                                                    idx !== details.order_items.length - 1 ? "border-b border-gray-200" : ""
                                                }`}
                                            >
                                                <div className="flex min-w-0 gap-3">
                                                    <span className="font-bold text-gray-900 w-6 text-right 2xl:text-lg">{item.quantity}x</span>
                                                    <div className="flex min-w-0 flex-col">
                                                        <span className="text-gray-800 font-medium 2xl:text-lg">{item.name}</span>
                                                        {item.observation && item.observation.trim() !== "" && (
                                                            <span className="mt-1 text-xs 2xl:text-sm text-gray-600 italic">Obs: {item.observation}</span>
                                                        )}
                                                        {item.order_item_subitems?.length > 0 && (
                                                            <div className="mt-2 space-y-1">
                                                                {item.order_item_subitems.map((sub) => (
                                                                    <div key={sub.id} className="flex items-start justify-between gap-3">
                                                                        <span className="text-xs 2xl:text-sm text-gray-600">• {sub.quantity}x {sub.name}</span>
                                                                        <span className="text-xs 2xl:text-sm text-gray-600 whitespace-nowrap">{fmtMoney(sub.price_cents * sub.quantity)}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                                <span className="shrink-0 font-medium text-gray-700 2xl:text-lg">{fmtMoney(item.price_cents * item.quantity)}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                {/* Totais */}
                                <div className="flex justify-end">
                                    <div className="w-full md:w-1/2 space-y-2 2xl:space-y-3 sm:mx-4">
                                        <div className="flex justify-between text-sm 2xl:text-base text-gray-500">
                                            <span>Subtotal</span>
                                            <span>{fmtMoney(details.subtotal_cents || 0)}</span>
                                        </div>
                                        {!isTableOrder && (
                                            <div className="flex justify-between text-sm 2xl:text-base text-gray-500">
                                                <span>{isPickup ? "Retirada" : "Taxa de Entrega"}</span>
                                                <span>{fmtMoney(details.delivery_cents || 0)}</span>
                                            </div>
                                        )}
                                        {!isTableOrder && couponDiscountCents > 0 && (
                                            <div className="flex justify-between text-sm 2xl:text-base text-gray-500">
                                                <span>{details.coupon_code ? `Cupom: ${details.coupon_code}` : "Desconto"}</span>
                                                <span>-{fmtMoney(couponDiscountCents)}</span>
                                            </div>
                                        )}
                                        <div className="flex justify-between text-lg 2xl:text-xl font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
                                            <span>Total</span>
                                            <span>{fmtMoney(details.total_cents)}</span>
                                        </div>
                                        {details.payment_ref && (
                                            <div className="text-right text-xs text-gray-400 mt-1">
                                                Pagamento: {details.payment_ref}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Footer */}
                    <div className="p-4 sm:p-5 border-t border-gray-100 flex flex-col sm:flex-row justify-end gap-3 bg-gray-50/50 [&>button]:w-full sm:[&>button]:w-auto">
                        {renderActions()}
                        {(!renderActions() || isUpdating) && (
                            <Button variant="secondary" onClick={onClose} disabled={isUpdating}>Fechar</Button>
                        )}
                    </div>
                </div>
            </Modal>

            <ConfirmModal
                open={showRefundConfirmation}
                onClose={() => setShowRefundConfirmation(false)}
                onConfirm={() => {
                    setShowRefundConfirmation(false);
                    void handleStatusUpdate("canceled");
                }}
                title="Rejeitar pedido?"
                description={isPaidOnlinePix
                    ? "O valor total pago via Pix será reembolsado automaticamente ao cliente. O cliente será notificado na página de acompanhamento do pedido."
                    : "O cliente será notificado do cancelamento na página de acompanhamento do pedido."}
                confirmLabel={isPaidOnlinePix ? "Rejeitar e reembolsar" : "Rejeitar pedido"}
                cancelLabel="Voltar"
                isLoading={isUpdating}
                variant="danger"
            />
        </>
    );
}
