"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
    faClock, 
    faMapMarkerAlt, 
    faArrowLeft, 
    faEye
} from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { supabase } from "@/lib/database/supabaseClient";

// Tipos baseados no seu schema
export type OrderStatus = "pending_online_payment" | "pending_physical_payment" | "preparing" | "delivering" | "done" | "canceled";

export interface OrderItemData {
    id: string;
    quantity: number;
    price_cents: number;
    name: string; 
}

export interface OrderData {
    id: string;
    display_id?: number; 
    created_at: string;
    status: OrderStatus;
    customer_name: string;
    customer_phone?: string;
    address_line1?: string; 
    delivery_cents: number;
    total_cents: number;
    payment_method?: string; 
    order_items: OrderItemData[];
}

interface OrderCardProps {
    order: OrderData;
    onStatusChange: () => void; 
    onViewOrder?: (order: OrderData) => void; // NOVA PROP
}

export default function OrderCard({ order, onStatusChange, onViewOrder }: OrderCardProps) {
    const [loading, setLoading] = useState(false);

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

        if (order.status === "pending_online_payment" || order.status === "pending_physical_payment") {
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
            const isPhysical = ["money", "card_machine"].includes(order.payment_method || "");
            prevStatus = isPhysical ? "pending_physical_payment" : "pending_online_payment";
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
            btn: "Enviar Entrega", 
            btnColor: "primary" 
        },
        delivering: { 
            label: "Em Rota", 
            color: "bg-purple-100 text-purple-800 border-purple-800",
            borderColor: "border-l-purple-500", 
            btn: "Concluir", 
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

    const config = statusConfig[order.status] || statusConfig.pending_online_payment;
    const showBackButton = ["preparing", "delivering", "done"].includes(order.status);

    // LÓGICA DE VISUALIZAÇÃO LIMITADA
    const VISIBLE_ITEMS = 2;
    const remainingItems = order.order_items.length - VISIBLE_ITEMS;
    const itemsToShow = order.order_items.slice(0, VISIBLE_ITEMS);

    return (
        <Card className={`p-0 overflow-hidden border-l-4 ${config.borderColor} flex flex-col h-full`}>
            {/* Header do Card */}
            <div className="p-4 2xl:py-5 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 2xl:gap-4">
                        <span className="font-bold text-gray-900 text-lg">
                            #{order.display_id || order.id.slice(0, 4)}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium 2xl:text-base 2xl:px-3 2xl:py-1 ${config.color}`}>
                            {config.label}
                        </span>
                        {config.extra && (
                            <span className={`text-xs -ml-1 px-2 py-0.5 rounded-full font-medium 2xl:text-base 2xl:px-3 2xl:py-1 color-gray-500 bg-gray-200`}>
                            {config.extra}
                        </span>
                        )}
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
                    {order.order_items.map((item, idx) => (
                        <div key={`${order.id}-item-${idx}`} className="flex justify-between text-sm 2xl:text-base">
                            <div className="flex gap-2">
                                <span className="font-bold text-gray-900">{item.quantity}x</span>
                                <span className="text-gray-700 line-clamp-1">{item.name}</span>
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
                    {order.address_line1 && (
                        <div className="flex items-start gap-2 text-gray-600 ">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="mt-1 text-gray-400" />
                            <span className="line-clamp-2">{order.address_line1}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-gray-500 pt-2 2xl:text-base">
                        <span>Taxa de Entrega</span>
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