"use client";

import { useEffect } from "react";
import ModalMobile from "@/components/ui/HybridModal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useHistoryStore } from "@/lib/stores/costumer/historyStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faGift } from "@fortawesome/free-solid-svg-icons";
import { formatPrice } from "@/lib/utils/formatPrice"; 

type Props = {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
};

export default function HistoryModal({ open, onClose, restaurantId }: Props) {
    const { 
        step, 
        customer_phone, 
        loyaltyBalance,
        program, // ✅ Agora usamos este objeto para as regras
        orders, 
        loading, 
        error,
        setPhone, 
        fetchHistory, 
        reset 
    } = useHistoryStore();

    // Resetar ao abrir
    useEffect(() => {
        if (open) reset();
    }, [open]);

    const handleFetch = () => {
        fetchHistory(restaurantId);
    };

    // Renderiza estrelinhas de progresso
    const renderProgress = () => {
        // ✅ Correção: Pegando a meta do objeto 'program'
        const goal = program?.goal_count || 10; 
        const current = loyaltyBalance?.current_count || 0;
        
        const stars = [];
        for (let i = 1; i <= goal; i++) {
            const isFilled = i <= current;
            stars.push(
                <div key={i} className={`flex flex-col items-center justify-center w-8 h-8 rounded-full border-2 
                    ${isFilled ? "bg-brand border-brand text-white" : "border-gray-200 text-gray-200"}`}>
                    <FontAwesomeIcon icon={faStar} className="text-xs" />
                </div>
            );
        }
        return <div className="flex flex-wrap gap-2 justify-center py-4">{stars}</div>;
    };

    return (
        <ModalMobile open={open} onClose={onClose} title="Histórico e Fidelidade" height={0.8}>
            <div className="p-4 space-y-6">
                
                {/* STEP 1: INPUT PHONE */}
                {step === "input_phone" && (
                    <div className="space-y-4 pt-4">
                        <p className="text-gray-600 text-center">
                            Digite seu celular para ver seus pontos e pedidos anteriores.
                        </p>
                        <Input 
                            placeholder="(00) 00000-0000"
                            value={customer_phone}
                            onChange={(e) => setPhone(e.target.value)} 
                            type="tel"
                        />
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        
                        <Button 
                            onClick={handleFetch} 
                            loading={loading} 
                            className="w-full mt-4"
                        >
                            Ver Histórico
                        </Button>
                    </div>
                )}

                {/* STEP 2: VIEW DATA */}
                {step === "view_history" && (
                    <div className="space-y-8 animate-fadeIn">
                        
                        {/* FIDELIDADE CARD */}
                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100 text-center">
                            <h3 className="font-bold text-lg text-brand mb-1">
                                <FontAwesomeIcon icon={faGift} className="mr-2"/>
                                Programa de Fidelidade
                            </h3>
                            
                            {/* ✅ Correção: Usando program?.active */}
                            {program?.active ? (
                                <>
                                    <p className="text-sm text-gray-600 mb-4">
                                        Complete {program?.goal_count} pedidos para ganhar: <br/>
                                        <b className="text-gray-900">{program?.reward_description || "uma recompensa surpresa"}</b>
                                    </p>
                                    
                                    {renderProgress()}
                                    
                                    <p className="text-xs text-gray-400 mt-2">
                                        Você tem {loyaltyBalance?.current_count || 0} de {program?.goal_count} selos.
                                    </p>
                                </>
                            ) : (
                                <p className="text-gray-500 text-sm py-4">
                                    Este restaurante não possui programa de fidelidade ativo no momento.
                                </p>
                            )}
                        </div>

                        {/* LISTA DE PEDIDOS */}
                        <div>
                            <h3 className="font-bold text-gray-900 mb-3 ml-1">Últimos Pedidos</h3>
                            {orders.length === 0 ? (
                                <p className="text-gray-500 text-sm text-center py-4">Nenhum pedido encontrado.</p>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map((order) => (
                                        <div key={order.id} className="flex justify-between items-center border-b border-gray-100 pb-3 last:border-0">
                                            <div>
                                                <p className="font-medium text-sm text-gray-800">
                                                    Pedido #{order.display_id}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {new Date(order.created_at).toLocaleDateString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-semibold text-sm">
                                                    {formatPrice(order.total_cents)}
                                                </p>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full 
                                                    ${order.status === 'done' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                                                    {order.status === 'done' ? 'Concluído' : 'Processando'}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button variant="secondary" onClick={reset} className="w-full text-xs">
                            Consultar outro número
                        </Button>
                    </div>
                )}
            </div>
        </ModalMobile>
    );
}