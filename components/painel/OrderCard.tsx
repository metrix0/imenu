"use client";

import { useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faClock, faMapMarkerAlt, faMotorcycle, faCheckCircle } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { supabase } from "@/lib/supabaseClient";

// Tipos baseados no seu schema (aproximados para o frontend)
export type OrderStatus = "pending" | "preparing" | "delivering" | "finished" | "cancelled";

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
    order_items: OrderItemData[];
}

interface OrderCardProps {
    order: OrderData;
    onStatusChange: () => void; // Callback para atualizar a lista se necessário
}

export default function OrderCard({ order, onStatusChange }: OrderCardProps) {
    const [loading, setLoading] = useState(false);

    // Cálculo de tempo decorrido (simples)
    const getElapsedTime = () => {
        const start = new Date(order.created_at).getTime();
        const now = new Date().getTime();
        const diffMins = Math.floor((now - start) / 60000);
        if (diffMins < 60) return `${diffMins} min`;
        return `${Math.floor(diffMins / 60)}h`;
    };

    // Formatação de Moeda
    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

    // Lógica de Avançar Status
    const advanceStatus = async () => {
        let nextStatus: OrderStatus | null = null;

        if (order.status === "pending") nextStatus = "preparing";
        else if (order.status === "preparing") nextStatus = "delivering"; // ou 'ready'
        else if (order.status === "delivering") nextStatus = "finished";

        if (!nextStatus) return;

        setLoading(true);
        try {
            const { error } = await supabase
                .from("orders")
                .update({ status: nextStatus })
                .eq("id", order.id);

            if (error) throw error;
            onStatusChange(); // Notifica o pai (embora o Realtime vá fazer isso também)
        } catch (err) {
            alert("Erro ao atualizar status");
        } finally {
            setLoading(false);
        }
    };

    // Configuração visual baseada no status
    const statusConfig = {
        pending: { label: "Pendente", color: "bg-yellow-100 text-yellow-800", btn: "Confirmar", btnColor: "primary" },
        preparing: { label: "Preparando", color: "bg-blue-100 text-blue-800", btn: "Enviar Entrega", btnColor: "primary" },
        delivering: { label: "Em Rota", color: "bg-orange-100 text-orange-800", btn: "Concluir", btnColor: "secondary" },
        finished: { label: "Concluído", color: "bg-green-100 text-green-800", btn: null, btnColor: "secondary" },
        cancelled: { label: "Cancelado", color: "bg-red-100 text-red-800", btn: null, btnColor: "secondary" }
    };

    const config = statusConfig[order.status] || statusConfig.pending;

    return (
        <Card className="p-0 overflow-hidden border-l-4 border-l-brand">
            {/* Header do Card */}
            <div className="p-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                <div className="flex items-center gap-2">
                    <span className="font-bold text-gray-900 text-lg">#{order.display_id || order.id.slice(0, 4)}</span>
                    <span className={`text-xs px-2 py-1 rounded-full font-medium ${config.color}`}>
                        {config.label}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-red-600 font-bold bg-red-50 px-2 py-1 rounded text-sm">
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
                            <span>{order.address_line1}</span>
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

                {/* Botão de Ação */}
                {config.btn && (
                    <Button 
                        variant={config.btnColor as "primary" | "secondary"} 
                        className="w-full mt-2"
                        onClick={advanceStatus}
                        loading={loading}
                    >
                        {config.btn}
                    </Button>
                )}
            </div>
        </Card>
    );
}