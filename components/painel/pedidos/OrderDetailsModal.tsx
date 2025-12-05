"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faTimes, faUser, faMapMarkerAlt, faClock, faReceipt, faCheck, faMotorcycle } from "@fortawesome/free-solid-svg-icons";
import { icons } from "@/lib/fontawesome";
import Modal from "@/components/ui/Modal";
import Button from "@/components/ui/Button";
import ListLoader from "@/components/ui/ListLoader";
import { Order } from "./OrdersTable"; 

interface OrderDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    order: Order | null; 
    onOrderUpdate?: () => void; 
}

type OrderDetail = Order & {
    delivery_cents: number;
    customer_phone: string | null;
    customer_address: string | null;
    payment_ref: string | null;
    order_items: Array<{
        id: string;
        quantity: number;
        price_cents: number;
        name: string;
    }>;
};

export default function OrderDetailsModal({ isOpen, onClose, order, onOrderUpdate }: OrderDetailsModalProps) {
    const [isLoading, setIsLoading] = useState(true);
    const [isUpdating, setIsUpdating] = useState(false);
    const [details, setDetails] = useState<OrderDetail | null>(null);

    const fmtMoney = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
    const fmtDate = (dateStr: string) => new Date(dateStr).toLocaleString("pt-BR");

    useEffect(() => {
        if (isOpen && order) {
            fetchDetails();
        } else {
            setDetails(null);
        }
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
                        name
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
                throw new Error("Falha ao atualizar");
            }

            // Atualiza localmente para feedback instantâneo
            setDetails(prev => prev ? { ...prev, status: newStatus as any } : null);
            
            // Notifica o pai para recarregar a lista
            if (onOrderUpdate) onOrderUpdate();

        } catch (err) {
            alert("Erro ao atualizar pedido. Tente novamente.");
            console.error(err);
        } finally {
            setIsUpdating(false);
        }
    };

    const renderStatus = (status: string) => {
        const labels: Record<string, string> = {
            pending_online_payment: "Pendente (Online)",
            pending_physical_payment: "Pendente (Balcão/Entrega)",
            preparing: "Preparando",
            delivering: "Em Rota",
            done: "Concluído",
            canceled: "Cancelado",
        };
        const colors: Record<string, string> = {
            pending_online_payment: "bg-yellow-100 text-yellow-800",
            pending_physical_payment: "bg-orange-100 text-orange-800",
            preparing: "bg-blue-100 text-blue-800",
            delivering: "bg-purple-100 text-purple-800",
            done: "bg-green-100 text-green-800",
            canceled: "bg-red-100 text-red-800",
        };
        return (
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${colors[status] || "bg-gray-100"}`}>
                {labels[status] || status}
            </span>
        );
    };

    const renderActions = () => {
        if (!details || isUpdating) return null;

        if (details.status === "pending_online_payment" || details.status === "pending_physical_payment") {
            return (
                <>
                    <Button variant="secondary" onClick={() => handleStatusUpdate("canceled")} className="text-red-600 hover:bg-red-50 border-red-200">
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
                return (
                    <Button variant="primary" onClick={() => handleStatusUpdate("delivering")}>
                        <FontAwesomeIcon icon={faMotorcycle} className="mr-2" /> Saiu para Entrega
                    </Button>
                );
            case "delivering":
                return (
                    <Button variant="primary" className="bg-green-600 hover:bg-green-700 border-green-600" onClick={() => handleStatusUpdate("done")}>
                        <FontAwesomeIcon icon={faCheck} className="mr-2" /> Concluir Pedido
                    </Button>
                );
            default:
                return null;
        }
    };

    return (
        <Modal open={isOpen} onClose={onClose}>
            <div className="w-full max-w-2xl bg-white rounded-lg flex flex-col max-h-[85vh]">
                {/* Header */}
                <div className="p-5 border-b border-gray-100 flex justify-between items-start">
                    <div>
                        <div className="flex items-center gap-3 mb-1">
                            <h2 className="text-xl font-bold text-gray-900">
                                Pedido #{order?.display_id}
                            </h2>
                            {(details || order) && renderStatus(details?.status || order!.status)}
                        </div>
                        <p className="text-xs text-gray-500 flex items-center gap-1">
                            <FontAwesomeIcon icon={faClock} /> Realizado em {order && fmtDate(order.created_at)}
                        </p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1">
                        <FontAwesomeIcon icon={icons.faTimes} className="text-xl" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto flex-1">
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
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1">Cliente</h4>
                                    <div className="text-sm">
                                        <p className="font-medium text-gray-900 flex items-center gap-2">
                                            <FontAwesomeIcon icon={faUser} className="text-gray-400 w-4" />
                                            {details.customer_name}
                                        </p>
                                        {details.customer_phone && (
                                            <p className="text-gray-500 ml-6 mt-1">{details.customer_phone}</p>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-3">
                                    <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-1">Entrega</h4>
                                    <div className="text-sm">
                                        {details.customer_address ? (
                                            <p className="text-gray-600 flex items-start gap-2">
                                                <FontAwesomeIcon icon={faMapMarkerAlt} className="text-gray-400 w-4 mt-0.5" />
                                                {details.customer_address}
                                            </p>
                                        ) : (
                                            <p className="text-gray-500 italic">Retirada no local</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Itens */}
                            <div>
                                <h4 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-2 mb-3 flex items-center gap-2">
                                    <FontAwesomeIcon icon={faReceipt} className="text-gray-400" /> Resumo do Pedido
                                </h4>
                                <div className="bg-gray-50 rounded-lg border border-gray-200 overflow-hidden">
                                    {details.order_items.map((item, idx) => (
                                        <div key={item.id} className={`flex justify-between items-start p-3 ${idx !== details.order_items.length - 1 ? 'border-b border-gray-200' : ''}`}>
                                            <div className="flex gap-3">
                                                <span className="font-bold text-gray-900 w-6 text-right">{item.quantity}x</span>
                                                <div className="flex flex-col">
                                                    <span className="text-gray-800 font-medium">{item.name}</span>
                                                </div>
                                            </div>
                                            <span className="font-medium text-gray-700">
                                                {fmtMoney(item.price_cents * item.quantity)}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Totais */}
                            <div className="flex justify-end">
                                <div className="w-full md:w-1/2 space-y-2 mx-4">
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Subtotal</span>
                                        <span>{fmtMoney(details.total_cents - (details.delivery_cents || 0))}</span>
                                    </div>
                                    <div className="flex justify-between text-sm text-gray-500">
                                        <span>Taxa de Entrega</span>
                                        <span>{fmtMoney(details.delivery_cents || 0)}</span>
                                    </div>
                                    <div className="flex justify-between text-lg font-bold text-gray-900 border-t border-gray-200 pt-2 mt-2">
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
                <div className="p-5 border-t border-gray-100 flex justify-end gap-3 bg-gray-50/50">
                    {renderActions()}
                    {(!renderActions() || isUpdating) && (
                        <Button variant="secondary" onClick={onClose} disabled={isUpdating}>Fechar</Button>
                    )}
                </div>
            </div>
        </Modal>
    );
}