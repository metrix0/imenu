"use client";

import {useEffect, useState} from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
    faClock,
    faCalendarDays,
    faMapMarkerAlt, 
    faArrowLeft, 
    faEye,
    faCircleInfo,
    faChair,
    faUser,
    faPhone,
    faBagShopping
} from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Tooltip from "@/components/ui/Tooltip";
import { supabase } from "@/lib/database/supabaseClient";

const futureSchedulingByRestaurant = new Map<string, PromiseLike<boolean>>();

function getFutureSchedulingSetting(restaurantId: string) {
    const cached = futureSchedulingByRestaurant.get(restaurantId);
    if (cached) return cached;

    const request = supabase
        .from("restaurants")
        .select("allow_future_order_scheduling")
        .eq("id", restaurantId)
        .single()
        .then(({ data }) => data?.allow_future_order_scheduling === true);

    futureSchedulingByRestaurant.set(restaurantId, request);
    return request;
}

// Tipos baseados no seu schema
export type OrderStatus = "pending_online_payment" | "pending_physical_payment" | "preparing" | "delivering" | "done" | "canceled" | "paid";

export interface OrderItemData {
    id: string;
    quantity: number;
    price_cents: number;
    name: string;
    observation?: string | null;
}

export interface OrderData {
    id: string;
    restaurant_id?: string;
    display_id?: number; 
    created_at: string;
    scheduled_for?: string | null;
    delivery_eta?: string | null;
    status: OrderStatus;
    customer_name: string;
    customer_phone?: string;
    customer_address?: string | null;
    delivery_cents: number;
    total_cents: number;
    payment_method?: string;
    is_delivery?: string | null;
    table_id?: string | null;
    table_name_snapshot?: string | null;
    order_items: OrderItemData[];
}

interface OrderCardProps {
    order: OrderData;
    onStatusChange: () => void; 
    onViewOrder?: (order: OrderData) => void; // NOVA PROP
}


function CashChangeInfo({ text }: { text: string }) {
    return (
        <Tooltip
            text={text}
            position="bottom"
            size="medium"
            portal
            tooltipClassName="max-w-[280px] text-center"
        >
            <button
                type="button"
                className="inline-flex items-center justify-center text-gray-500 hover:text-gray-700 focus:text-gray-700 focus:outline-none"
                aria-label="Informações sobre troco"
            >
                <FontAwesomeIcon icon={faCircleInfo} />
            </button>
        </Tooltip>
    );
}

function TimeInfo({ text, time, scheduled }: { text: string; time: string; scheduled: boolean }) {
    const badge = (
        <div
            tabIndex={text ? 0 : undefined}
            className={`flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium outline-none 2xl:px-3 2xl:py-1 2xl:text-base ${text ? "cursor-help" : ""} ${
                scheduled
                    ? "bg-green-50 text-green-700"
                    : "bg-red-50 text-red-600"
            }`}
        >
            <FontAwesomeIcon icon={scheduled ? faCalendarDays : faClock} />
            {time}
        </div>
    );

    if (!text) {
        return <div className="ml-auto shrink-0">{badge}</div>;
    }

    return (
        <Tooltip
            text={text}
            position="bottom"
            size="medium"
            portal
            parentClassName="ml-auto shrink-0"
            tooltipClassName="max-w-[300px] text-center"
        >
            {badge}
        </Tooltip>
    );
}

export default function OrderCard({ order, onStatusChange, onViewOrder }: OrderCardProps) {
    const [loading, setLoading] = useState(false);
    const [currentTime, setCurrentTime] = useState(() => Date.now());
    const [allowFutureOrderScheduling, setAllowFutureOrderScheduling] = useState(false);
    const isTableOrder = order.is_delivery === "mesa";
    const isPickup = isTableOrder || order.is_delivery === "retirada";

    useEffect(() => {
        if (!order.restaurant_id) return;

        let active = true;
        void getFutureSchedulingSetting(order.restaurant_id).then((enabled) => {
            if (active) setAllowFutureOrderScheduling(enabled);
        });

        return () => {
            active = false;
        };
    }, [order.restaurant_id]);

    useEffect(() => {
        let intervalId: number | undefined;
        const delayUntilNextMinute = 60_000 - (Date.now() % 60_000) + 50;
        const timeoutId = window.setTimeout(() => {
            setCurrentTime(Date.now());
            intervalId = window.setInterval(() => {
                setCurrentTime(Date.now());
            }, 60_000);
        }, delayUntilNextMinute);

        return () => {
            window.clearTimeout(timeoutId);
            if (intervalId !== undefined) window.clearInterval(intervalId);
        };
    }, []);

    // Cálculo de tempo decorrido
    const getElapsedTime = () => {
        const start = new Date(order.created_at).getTime();
        const diffMins = Math.max(
            0,
            Math.floor((currentTime - start) / 60000)
        );

        if (diffMins < 60) return `${diffMins} min`;
        return `${Math.floor(diffMins / 60)}h`;
    };


    // Formatação de Moeda
    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    const formatPhone = (value?: string) => {
        if (!value) return "";

        let digits = value.replace(/\D/g, "");
        if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
            digits = digits.slice(2);
        }

        if (digits.length === 11) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
        }

        if (digits.length === 10) {
            return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
        }

        return value;
    };

    const formatEtaRange = (iso?: string | null) => {
        if (!iso) return "";
        const center = new Date(iso);
        if (Number.isNaN(center.getTime())) return "";

        const roundToFiveMinutes = (date: Date) =>
            new Date(Math.round(date.getTime() / 300_000) * 300_000);
        const start = roundToFiveMinutes(
            new Date(center.getTime() - 10 * 60_000)
        );
        const end = roundToFiveMinutes(
            new Date(center.getTime() + 10 * 60_000)
        );
        const formatTime = (date: Date) =>
            date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
        const createdAt = new Date(order.created_at);
        const createdAtText = Number.isNaN(createdAt.getTime())
            ? ""
            : `Pedido feito às ${formatTime(createdAt)}. `;

        return `${createdAtText}${isPickup ? "Previsão de retirada" : "Previsão de entrega"} ${formatTime(start)} - ${formatTime(end)}`;
    };

    const formatScheduledRelativeTime = (diffMinutes: number) => {
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

    // --- Lógica de AVANÇAR Status ---
    const advanceStatus = async () => {
        let nextStatus: OrderStatus | null = null;

        console.log(order)

        if (order.status === "pending_online_payment" || order.status === "pending_physical_payment" || order.status === "paid") {
            nextStatus = "preparing";
        }
        else if (order.status === "preparing") nextStatus = "delivering";
        else if (order.status === "delivering") nextStatus = "done";

        if (!nextStatus) return;
        await updateStatus(nextStatus);
    };

    // --- Lógica de VOLTAR Status ---
    const revertStatus = async () => {
        let prevStatus: OrderStatus | null = null;

        if (order.status === "delivering") {
            prevStatus = "preparing";
        } 
        else if (order.status === "done") {
            prevStatus = "delivering";
        }
        else if (order.status === "preparing") {
            const isPhysical = ["trazer-maquininha", "dinheiro", "pix-entrega"].includes(order.payment_method || "");
            prevStatus = isTableOrder || isPhysical ? "pending_physical_payment" : "paid";
        }

        if (!prevStatus) return;
        await updateStatus(prevStatus);
    };

    const updateStatus = async (newStatus: OrderStatus) => {
        setLoading(true);
        try {
            const res = await fetch(`/api/orders/${order.id}/status-order`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ status: newStatus })
            });

            if (!res.ok) {
                const err = await res.json();
                throw new Error(err.error || "Erro ao atualizar status");
            }
            
            onStatusChange(); // Dispara refresh no pai
        } catch (err) {
            console.error(err);
            alert("Erro ao atualizar status");
        } finally {
            setLoading(false);
        }
    };

    const statusConfig: Record<string, { label: string; extra?: string | null;color: string; borderColor: string; btn: string | null; btnColor: string; }> = {
        pending_online_payment: { 
            label: "Pendente",
            color: "bg-yellow-100 text-yellow-700 border-yellow-200",
            borderColor: "border-l-yellow-500",
            btn: "Aceitar", 
            btnColor: "primary" 
        },
        pending_physical_payment: { 
            label: "Pendente",
            color: "bg-yellow-100 text-yellow-700 border-yellow-200",
            borderColor: "border-l-yellow-500", 
            btn: "Aceitar", 
            btnColor: "primary" ,
            extra: "Pgt. Entrega"
        },
        paid: {
            label: "Pendente",
            color: "bg-yellow-100 text-yellow-700 border-yellow-200",
            borderColor: "border-l-yellow-500",
            btn: "Aceitar",
            btnColor: "primary"
        },
        preparing: { 
            label: "Preparando", 
            color: "bg-blue-100 text-blue-800 border-blue-200", 
            borderColor: "border-l-blue-500",
            btn: isPickup ? "Pronto" : "Enviado", 
            btnColor: "primary" 
        },
        delivering: {
            label: isPickup ? "Pronto" : "Em Rota",
            color: isPickup ? "bg-green-100 text-green-800 border-green-200" : "bg-purple-100 text-purple-800 border-purple-800",
            borderColor: isPickup ? "border-l-green-500" : "border-l-purple-500",
            btn: isPickup ? "Entregue" : "Concluir",
            btnColor: "primary"
        },
        done: { 
            label: "Concluído", 
            color: "bg-green-100 text-green-800 border-green-200",
            borderColor: "border-l-green-500", 
            btn: null, 
            btnColor: "secondary" 
        },
        canceled: { 
            label: "Cancelado", 
            color: "bg-red-100 text-red-800 border-red-200",
            borderColor: "border-l-red-500", 
            btn: null, 
            btnColor: "secondary" 
        }
    };


    const paymentLabels: Record<string, string> = {
        cartao: "Cartão",
        "trazer-maquininha": "Cartão",
        dinheiro: "Dinheiro",
        "pix-entrega": "Pix (Entrega)",
        pix: "Pix (Pago)",
    };

    const paymentMethod = order.payment_method || "";
    const paymentLabel = paymentLabels[paymentMethod] || paymentMethod || "Pagamento";
    const cashChangeObservation = order.order_items
        .map((item) => String(item.observation ?? ""))
        .map((observation) => observation.match(/Troco\s+para\s*:\s*[^\r\n]*/i)?.[0]?.trim())
        .find(Boolean) || "Cliente não pediu troco";

    const config = statusConfig[order.status] || statusConfig.pending_online_payment;
    const showBackButton = ["preparing", "delivering", "done"].includes(order.status);
    const scheduledDate = order.scheduled_for ? new Date(order.scheduled_for) : null;
    const isScheduled = !isTableOrder && Boolean(scheduledDate && !Number.isNaN(scheduledDate.getTime()));
    const scheduledTime = scheduledDate
        ? scheduledDate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
        : "";
    const scheduledDay = scheduledDate
        ? scheduledDate.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
        : "";
    const scheduledTooltip = isScheduled
        ? `Pedido agendado para que ${isPickup ? "a retirada seja feita" : "a entrega seja feita"} às ${scheduledTime} (dia ${scheduledDay})`
        : "";
    const scheduledRelativeTime = scheduledDate
        ? formatScheduledRelativeTime((scheduledDate.getTime() - currentTime) / 60000)
        : "";
    const deliveryEtaTooltip = !isScheduled ? formatEtaRange(order.delivery_eta) : "";

    // LÓGICA DE VISUALIZAÇÃO LIMITADA
    const VISIBLE_ITEMS = isScheduled || isTableOrder ? 2 : 3;
    const remainingItems = order.order_items.length - VISIBLE_ITEMS;
    const itemsToShow = order.order_items.slice(0, VISIBLE_ITEMS);

    return (
        <Card className={`!p-0 overflow-hidden border-l-4 ${config.borderColor} flex flex-col h-full`}>
            {/* Header do Card */}
            <div className="rounded-t-xl bg-gray-50 border-b border-gray-100 px-5 py-4 2xl:px-6 2xl:py-5">
                <div className="flex items-center gap-2 whitespace-nowrap 2xl:gap-4">
                    <span className="shrink-0 font-bold text-gray-900 text-lg">
                        #{order.display_id || order.id.slice(0, 4)}
                    </span>
                    <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium 2xl:text-base 2xl:px-3 2xl:py-1 ${config.color}`}>
                        {config.label}
                    </span>
                    {!isTableOrder && (
                        <div
                            className={`flex shrink-0 items-center text-xs -ml-1 px-2 py-0.5 rounded-full font-medium 2xl:text-base 2xl:px-3 2xl:py-1 ${
                                paymentMethod === "pix"
                                    ? "bg-green-100 text-green-800"
                                    : "bg-gray-200 text-gray-700"
                            }`}
                        >
                            <span>{paymentLabel}</span>
                            {paymentMethod === "dinheiro" && (
                                <span className="ml-1.5 inline-flex leading-none">
                                    <CashChangeInfo text={cashChangeObservation} />
                                </span>
                            )}
                        </div>
                    )}
                    {isScheduled ? (
                        <TimeInfo
                            text={scheduledTooltip}
                            time={scheduledTime}
                            scheduled
                        />
                    ) : (
                        <TimeInfo
                            text={deliveryEtaTooltip}
                            time={getElapsedTime()}
                            scheduled={false}
                        />
                    )}
                </div>

                <div className="mt-2 flex w-full min-w-0 items-center gap-3 text-sm font-medium text-gray-700 2xl:text-base">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5" title={order.customer_name}>
                        <FontAwesomeIcon icon={faUser} className="shrink-0 text-gray-400" />
                        <span className="min-w-0 truncate">{order.customer_name}</span>
                    </span>
                    {isTableOrder ? (
                        <span
                            className="flex shrink-0 items-center gap-1.5"
                            title={order.table_name_snapshot || "Mesa"}
                        >
                            <FontAwesomeIcon icon={faChair} className="shrink-0 text-gray-400" />
                            <span>{order.table_name_snapshot || "Mesa"}</span>
                        </span>
                    ) : order.customer_phone ? (
                        <span className="flex shrink-0 items-center gap-1.5" title={formatPhone(order.customer_phone)}>
                            <FontAwesomeIcon icon={faPhone} className="shrink-0 text-gray-400" />
                            <span>{formatPhone(order.customer_phone)}</span>
                        </span>
                    ) : null}
                </div>
            </div>

            {/* Conteúdo */}
            <div className="flex flex-1 flex-col px-5 py-4 2xl:px-6 2xl:mt-2">
                {/* Itens */}
                <div className="space-y-2 2xl:space-y-3">
                    {isScheduled ? (
                        <div className="mb-3 flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-xs font-bold text-green-700 2xl:text-base">
                            <FontAwesomeIcon icon={faCalendarDays} />
                            <span>
                                Agendado para {allowFutureOrderScheduling ? `${scheduledDay} ` : ""}{scheduledTime}{" "}
                                <span className="font-medium">({scheduledRelativeTime})</span>
                            </span>
                        </div>
                    ) : null}
                    {itemsToShow.map((item, idx) => (
                        <div key={`${order.id}-item-${idx}`} className="flex min-w-0 justify-between gap-3 text-sm 2xl:text-base">
                            <div className="flex min-w-0 gap-2">
                                <span className="font-bold text-gray-900">{item.quantity}x</span>
                                <span className="min-w-0 text-gray-700 line-clamp-1">{item.name}</span>
                            </div>
                            <span className="text-gray-500 whitespace-nowrap">{fmtMoney(item.price_cents * item.quantity)}</span>
                        </div>
                    ))}
                    
                    {/* Indicador de mais itens */}
                    {remainingItems > 0 && (
                        <div 
                            className="text-xs text-gray-400 italic mt-1 "
                            
                        >
                            ...e mais {remainingItems} item(s). 
                        </div>
                    )}
                </div>

                <div className="mt-auto space-y-4 pt-4">
                    <hr className="border-gray-100" />

                    {/* Dados de Entrega e Totais */}
                    <div className="text-sm space-y-1 2xl:space-y-2">
                        <div className="flex min-w-0 items-center gap-2 text-gray-600 font-medium">
                            <FontAwesomeIcon icon={isTableOrder ? faChair : isPickup ? faBagShopping : faMapMarkerAlt} className="shrink-0 text-gray-400" />
                            <span
                                className="min-w-0 truncate"
                                title={isTableOrder ? order.table_name_snapshot || "Mesa" : isPickup ? "Retirada no balcão" : order.customer_address || "Endereço não informado"}
                            >
                                {isTableOrder ? order.table_name_snapshot || "Mesa" : isPickup ? "Retirada no balcão" : order.customer_address || "Endereço não informado"}
                            </span>
                        </div>
                        {!isPickup && (
                            <div className="flex justify-between text-gray-500 pt-2 2xl:text-base">
                                <span>Taxa de Entrega</span>
                                <span>{fmtMoney(order.delivery_cents)}</span>
                            </div>
                        )}
                        <div className="flex justify-between font-bold text-lg 2xl:text-xl text-gray-900">
                            <span>Total</span>
                            <span>{fmtMoney(order.total_cents)}</span>
                        </div>
                    </div>

                    {/* Botões de Ação */}
                    {config.btn && (
                        <div className="flex gap-2 mt-2 2xl:mt-5">
                            {showBackButton && (
                                <Button 
                                    variant="secondary"
                                    className="px-4"
                                    onClick={revertStatus}
                                    loading={loading}
                                    disabled={loading}
                                    title="Voltar status anterior"
                                >
                                    <FontAwesomeIcon icon={faArrowLeft} />
                                </Button>
                            )}
                            
                            {/* Botão Principal (Avançar) */}
                            <Button 
                                variant={config.btnColor as "primary" | "secondary"} 
                                className="flex-1"
                                onClick={advanceStatus}
                                loading={loading}
                                disabled={loading}
                            >
                                {config.btn}
                            </Button>

                            {/* Botão de Ver Detalhes (Olho) */}
                            <Button 
                                variant="secondary"
                                className="px-4"
                                onClick={() => onViewOrder && onViewOrder(order)}
                                title="Ver detalhes do pedido"
                                disabled={loading}
                            >
                                <FontAwesomeIcon icon={faEye} />
                            </Button>
                        </div>
                    )}
                </div>
            </div>
        </Card>
    );
}