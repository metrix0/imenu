"use client";

import {useRef, useState} from "react";
import { createPortal } from "react-dom";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
    faClock, 
    faMapMarkerAlt, 
    faArrowLeft, 
    faEye,
    faCircleInfo
} from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { supabase } from "@/lib/database/supabaseClient";

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
    display_id?: number; 
    created_at: string;
    status: OrderStatus;
    customer_name: string;
    customer_phone?: string;
    customer_address?: string | null;
    delivery_cents: number;
    total_cents: number;
    payment_method?: string;
    is_delivery?: string | null;
    order_items: OrderItemData[];
}

interface OrderCardProps {
    order: OrderData;
    onStatusChange: () => void; 
    onViewOrder?: (order: OrderData) => void; // NOVA PROP
}


function CashChangeInfo({ text }: { text: string }) {
    const triggerRef = useRef<HTMLButtonElement>(null);
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState({ left: 0, top: 0 });

    const showTooltip = () => {
        const trigger = triggerRef.current;
        if (!trigger) return;

        const rect = trigger.getBoundingClientRect();
        const estimatedWidth = Math.min(
            Math.max(text.length * 7 + 24, 170),
            280
        );
        const halfWidth = estimatedWidth / 2;
        const viewportPadding = 8;
        const centeredLeft = rect.left + rect.width / 2;
        const left = Math.max(
            viewportPadding + halfWidth,
            Math.min(
                window.innerWidth - viewportPadding - halfWidth,
                centeredLeft
            )
        );

        setPosition({
            left,
            top: rect.bottom + 8,
        });
        setOpen(true);
    };

    const hideTooltip = () => {
        setOpen(false);
    };

    return (
        <>
            <button
                ref={triggerRef}
                type="button"
                onMouseEnter={showTooltip}
                onMouseLeave={hideTooltip}
                onFocus={showTooltip}
                onBlur={hideTooltip}
                className="inline-flex items-center justify-center text-gray-500 hover:text-gray-700 focus:text-gray-700 focus:outline-none"
                aria-label="Informações sobre troco"
                aria-describedby={open ? `troco-tooltip-${text}` : undefined}
            >
                <FontAwesomeIcon icon={faCircleInfo} />
            </button>

            {open && typeof document !== "undefined" &&
                createPortal(
                    <div
                        id={`troco-tooltip-${text}`}
                        role="tooltip"
                        className="pointer-events-none fixed z-[9999] max-w-[280px] -translate-x-1/2 rounded-lg bg-gray-900 px-3 py-2 text-center text-xs font-medium leading-snug text-white shadow-lg"
                        style={{
                            left: position.left,
                            top: position.top,
                        }}
                    >
                        {text}
                        <span
                            className="absolute bottom-full left-1/2 -translate-x-1/2 border-x-4 border-b-4 border-x-transparent border-b-gray-900"
                            aria-hidden="true"
                        />
                    </div>,
                    document.body
                )}
        </>
    );
}

export default function OrderCard({ order, onStatusChange, onViewOrder }: OrderCardProps) {
    const [loading, setLoading] = useState(false);
    const isPickup = order.is_delivery === "retirada";

    // Cálculo de tempo decorrido
    const getElapsedTime = () => {
        const start = new Date(order.created_at).getTime();
        const now = Date.now();

        const diffMins = Math.max(
            0,
            Math.floor((now - start) / 60000)
        );

        if (diffMins < 60) return `${diffMins} min`;
        return `${Math.floor(diffMins / 60)}h`;
    };


    // Formatação de Moeda
    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

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
            prevStatus = isPhysical ? "pending_physical_payment" : "paid";
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
            color: "bg-yellow-100 text-yellow-800",
            borderColor: "border-l-yellow-500",
            btn: "Confirmar", 
            btnColor: "primary" 
        },
        pending_physical_payment: { 
            label: "Pendente",
            color: "bg-yellow-100 text-yellow-800",
            borderColor: "border-l-yellow-500", 
            btn: "Confirmar", 
            btnColor: "primary" ,
            extra: "Pgt. Entrega"
        },
        paid: {
            label: "Pendente",
            color: "bg-yellow-100 text-yellow-800",
            borderColor: "border-l-yellow-500",
            btn: "Confirmar",
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

    // LÓGICA DE VISUALIZAÇÃO LIMITADA
    const VISIBLE_ITEMS = 3;
    const remainingItems = order.order_items.length - VISIBLE_ITEMS;
    const itemsToShow = order.order_items.slice(0, VISIBLE_ITEMS);

    return (
        <Card className={`p-0 overflow-hidden border-l-4 ${config.borderColor} flex flex-col h-full`}>
            {/* Header do Card */}
            <div className="p-4 2xl:py-5 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 2xl:gap-4 whitespace-nowrap">
                        <span className="shrink-0 font-bold text-gray-900 text-lg">
                            #{order.display_id || order.id.slice(0, 4)}
                        </span>
                        <span className={`shrink-0 text-xs px-2 py-0.5 rounded-full font-medium 2xl:text-base 2xl:px-3 2xl:py-1 ${config.color}`}>
                            {config.label}
                        </span>
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
                    </div>
                    <span className="text-sm 2xl:text-base font-medium text-gray-700 truncate max-w-[200px]" title={order.customer_name}>
                        {order.customer_name}
                    </span>
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]" title={order.customer_phone}>
                        {order.customer_phone}
                    </span>
                </div>

                <div className="flex items-center gap-1 text-red-600 font-bold bg-red-50 px-2 py-1 2xl:px-3 2xl:py-1.5 2xl:text-base rounded text-sm whitespace-nowrap">
                    <FontAwesomeIcon icon={faClock} />
                    {getElapsedTime()}
                </div>
            </div>

            {/* Conteúdo */}
            <div className="p-4 space-y-4 2xl:mt-2">
                {/* Itens */}
                <div className="space-y-2 2xl:space-y-3">
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

                <hr className="border-gray-100" />

                {/* Dados de Entrega e Totais */}
                <div className="text-sm space-y-1 2xl:space-y-2">
                    <div className="flex min-w-0 items-center gap-2 text-gray-600 font-medium">
                        <FontAwesomeIcon icon={faMapMarkerAlt} className="shrink-0 text-gray-400" />
                        <span
                            className="min-w-0 truncate"
                            title={isPickup ? "Retirada no balcão" : order.customer_address || "Endereço não informado"}
                        >
                            {isPickup ? "Retirada no balcão" : order.customer_address || "Endereço não informado"}
                        </span>
                    </div>
                    <div className="flex justify-between text-gray-500 pt-2 2xl:text-base">
                        <span>{isPickup ? "Retirada" : "Taxa de Entrega"}</span>
                        <span>{fmtMoney(order.delivery_cents)}</span>
                    </div>
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
        </Card>
    );
}
