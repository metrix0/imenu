"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
    faClock, 
    faMapMarkerAlt, 
    faArrowLeft 
} from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";

<<<<<<< HEAD
// Tipos baseados no seu schema
export type OrderStatus = "pending_online_payment" | "pending_physical_payment" | "preparing" | "delivering" | "done" | "canceled";
=======
// Tipos baseados no seu schema (aproximados para o frontend)
export type OrderStatus = "pending" | "preparing" | "delivering" | "finished" | "cancelled";
>>>>>>> 5688e2d1e6f02d91401f335d643174d7735ff563

export interface OrderItemData {
    id: string;
    quantity: number;
    price_at_purchase_cents: number;
    item: {
        name: string;
    };
    // Adicione subitens aqui se necessário na query
}

export interface OrderData {
    id: string;
    display_id?: number; // Se você tiver um ID sequencial amigável (Pedido #1)
    created_at: string;
    status: OrderStatus;
    customer_name: string;
    customer_phone?: string;
    address_line1?: string; // Endereço
    delivery_fee_cents: number;
    total_cents: number;
    payment_method?: string; 
    order_items: OrderItemData[];
}

interface OrderCardProps {
    order: OrderData;
    onStatusChange: () => void; // Callback para atualizar a lista se necessário
}

export default function OrderCard({ order, onStatusChange }: OrderCardProps) {
    const [loading, setLoading] = useState(false);

    // Cálculo de tempo decorrido
    const getElapsedTime = () => {
        const start = new Date(order.created_at).getTime();
        const now = new Date().getTime();
        const diffMins = Math.floor((now - start) / 60000);
        if (diffMins < 60) return `${diffMins} min`;
        return `${Math.floor(diffMins / 60)}h`;
    };

    // Formatação de Moeda
    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // --- Lógica de AVANÇAR Status ---
    const advanceStatus = async () => {
        let nextStatus: OrderStatus | null = null;

        if (order.status === "pending") nextStatus = "preparing";
        else if (order.status === "preparing") nextStatus = "delivering"; // ou 'ready'
        else if (order.status === "delivering") nextStatus = "finished";

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
            const { error } = await supabase
                .from("orders")
                .update({ status: newStatus })
                .eq("id", order.id);

            if (error) throw error;
            onStatusChange(); // Notifica o pai (embora o Realtime vá fazer isso também)
        } catch (err) {
            console.error(err);
            alert("Erro ao atualizar status");
        } finally {
            setLoading(false);
        }
    };

<<<<<<< HEAD
    const statusConfig: Record<string, { label: string; color: string; btn: string | null; btnColor: string }> = {
        pending_online_payment: { 
            label: "Pendente (Online)", 
            color: "bg-yellow-100 text-yellow-800", 
            btn: "Confirmar", 
            btnColor: "primary" 
        },
        pending_physical_payment: { 
            label: "Pendente (Balcão)", 
            color: "bg-orange-100 text-orange-800", 
            btn: "Confirmar", 
            btnColor: "primary" 
        },
        preparing: { 
            label: "Preparando", 
            color: "bg-blue-100 text-blue-800 border-blue-200", 
            btn: "Enviar Entrega", 
            btnColor: "primary" 
        },
        delivering: { 
            label: "Em Rota", 
            color: "bg-orange-100 text-orange-800 border-orange-200", 
            btn: "Concluir", 
            btnColor: "primary" 
        },
        done: { 
            label: "Concluído", 
            color: "bg-green-100 text-green-800 border-green-200", 
            btn: null, 
            btnColor: "secondary" 
        },
        canceled: { 
            label: "Cancelado", 
            color: "bg-red-100 text-red-800 border-red-200", 
            btn: null, 
            btnColor: "secondary" 
        }
    };

    const config = statusConfig[order.status] || statusConfig.pending_online_payment;
    const showBackButton = ["preparing", "delivering", "done"].includes(order.status);
=======
    // Configuração visual baseada no status
    const statusConfig = {
        pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", btn: "Confirmar", btnColor: "primary" },
        preparing: { label: "Preparando", color: "bg-blue-100 text-blue-800", btn: "Enviar Entrega", btnColor: "primary" },
        delivering: { label: "Em Rota", color: "bg-orange-100 text-orange-800", btn: "Concluir", btnColor: "secondary" },
        finished: { label: "Concluído", color: "bg-green-100 text-green-800", btn: null, btnColor: "secondary" },
        cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800", btn: null, btnColor: "secondary" }
    };

    const config = statusConfig[order.status] || statusConfig.pending;
>>>>>>> 5688e2d1e6f02d91401f335d643174d7735ff563

    return (
        <Card className="p-0 overflow-hidden border-l-4 border-l-brand">
            {/* Header do Card */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-start">
                {/* Lado Esquerdo: ID, Nome, Status */}
                <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-lg">
                            #{order.display_id || order.id.slice(0, 4)}
                        </span>
                        {/* Status Tag */}
                        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${config.color}`}>
                            {config.label}
                        </span>
                    </div>
                    {/* Nome do Cliente - Agora aqui */}
                    <span className="text-sm font-medium text-gray-700 truncate max-w-[200px]" title={order.customer_name}>
                        {order.customer_name}
                    </span>
                </div>

                {/* Lado Direito: Timer */}
                <div className="flex items-center gap-1 text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-sm whitespace-nowrap">
                    <FontAwesomeIcon icon={faClock} />
                    {getElapsedTime()}
                </div>
            </div>

            {/* Conteúdo */}
            <div className="p-4 space-y-4">
                {/* Itens */}
                <div className="space-y-2">
                    {order.order_items.map((item, idx) => (
                        <div key={`${order.id}-item-${idx}`} className="flex justify-between text-sm">
                            <div className="flex gap-2">
                                <span className="font-bold text-gray-900">{item.quantity}x</span>
                                <span className="text-gray-700">{item.item.name}</span>
                            </div>
                            <span className="text-gray-500">{fmtMoney(item.price_at_purchase_cents * item.quantity)}</span>
                        </div>
                    ))}
                </div>

                <hr className="border-gray-100" />

                {/* Dados de Entrega e Totais */}
                <div className="text-sm space-y-1">
                    {order.address_line1 && (
                        <div className="flex items-start gap-2 text-gray-600">
                            <FontAwesomeIcon icon={faMapMarkerAlt} className="mt-1 text-gray-400" />
                            <span className="line-clamp-2">{order.address_line1}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-gray-500 pt-2">
                        <span>Taxa de Entrega</span>
                        <span>{fmtMoney(order.delivery_fee_cents)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg text-gray-900">
                        <span>Total</span>
                        <span>{fmtMoney(order.total_cents)}</span>
                    </div>
                </div>

                {/* Botões de Ação */}
                {config.btn && (
                    <div className="flex gap-2 mt-2">
                        {showBackButton && (
                            <Button 
                                variant="secondary"
                                className="px-4"
                                onClick={revertStatus}
                                loading={loading}
                                title="Voltar status anterior"
                            >
                                <FontAwesomeIcon icon={faArrowLeft} />
                            </Button>
                        )}
                        
                        <Button 
                            variant={config.btnColor as "primary" | "secondary"} 
                            className="flex-1"
                            onClick={advanceStatus}
                            loading={loading}
                        >
                            {config.btn}
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );
}