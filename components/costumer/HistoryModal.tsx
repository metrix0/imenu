"use client";

import { useEffect } from "react";
import ModalMobile from "@/components/ui/HybridModal";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { useHistoryStore } from "@/lib/stores/costumer/historyStore";
import { useCartStore } from "@/lib/stores/costumer/cartStore"; // Importar CartStore
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faStar, faGift, faTrophy, faLock } from "@fortawesome/free-solid-svg-icons";
import { formatPrice } from "@/lib/utils/formatPrice";
import Toast from "@/components/ui/Toast";
import { useState } from "react";

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
        program, 
        orders, 
        loading, 
        error,
        setPhone,
        requestOtp, // Action nova
        validateOtp, // Action nova 
        fetchHistory, 
        reset 
    } = useHistoryStore();

    const addToCart = useCartStore((s) => s.addItem);
    const [showToast, setShowToast] = useState(false);
    const [otpCode, setOtpCode] = useState(""); // Estado local para o input do código

    useEffect(() => {
        if (open) {
            reset();
            setOtpCode("");
        }
    }, [open]);

    // 1. Pede o Código
    const handleSendCode = () => {
        requestOtp();
    };

    // 2. Valida o Código
    const handleVerifyCode = () => {
        if (otpCode.length < 6) return;
        validateOtp(otpCode, restaurantId);
    };

    const handleFetch = () => {
        fetchHistory(restaurantId);
    };

    const handleRedeem = () => {
        if (!program || !program.reward_item_id) return;

        // 1. Monta os subitens formatados para o Carrinho
        // O backend (API status atualizada) deve retornar 'expanded_reward_subitems'
        // @ts-ignore - A tipagem do program na store pode não ter atualizado ainda
        const expandedSubs = program.expanded_reward_subitems || [];
        
        const cartSubitems = expandedSubs.map((sub: any) => ({
            subcategoryId: sub.subcategory_id,
            subcategoryName: sub.subcategory_name,
            subitemId: sub.subitem_id,
            subitemName: sub.subitem_name,
            price_cents: 0 // Grátis
        }));

        // 2. Adiciona ao Carrinho
        addToCart({
            id: crypto.randomUUID(),
            base_item_id: program.reward_item_id!,
            // @ts-ignore
            name: `(PRÊMIO) ${program.reward_item_name || program.reward_description || "Recompensa"}`,
            total_cents: 0, // Custo Zero
            qty: 1,
            // @ts-ignore
            image: program.reward_item_image,
            selectedSubitems: cartSubitems,
            unit_price_cents: 0,
            is_reward: true // FLAG IMPORTANTE
        });

        setShowToast(true);
        setTimeout(() => {
            setShowToast(false);
            onClose();
        }, 2000);
    };

    const renderProgress = () => {
        const goal = program?.goal_count || 10; 
        const current = loyaltyBalance?.current_count || 0;
        const canRedeem = current >= goal;
        
        const stars = [];
        for (let i = 1; i <= goal; i++) {
            const isFilled = i <= current;
            stars.push(
                <div key={i} className={`flex flex-col items-center justify-center w-8 h-8 rounded-full border-2 transition-all duration-300
                    ${isFilled ? "bg-brand border-brand text-white scale-110" : "border-gray-200 text-gray-200"}`}>
                    <FontAwesomeIcon icon={faStar} className="text-xs" />
                </div>
            );
        }

        return (
            <div className="flex flex-col items-center">
                <div className="flex flex-wrap gap-2 justify-center py-6">{stars}</div>
                
                {canRedeem ? (
                    <div className="w-full animate-fadeUp">
                        <p className="text-green-600 font-bold mb-3">🎉 Meta atingida! Você ganhou um prêmio.</p>
                        <Button variant="primary" onClick={handleRedeem} className="w-full shadow-lg shadow-brand/20">
                            <FontAwesomeIcon icon={faTrophy} className="mr-2"/>
                            RESGATAR AGORA
                        </Button>
                        <p className="text-[10px] text-gray-400 mt-2">
                            O item será adicionado ao seu carrinho gratuitamente.
                        </p>
                    </div>
                ) : (
                    <p className="text-xs text-gray-400 mt-2">
                        Faltam {goal - current} pedidos para sua recompensa.
                    </p>
                )}
            </div>
        );
    };

    return (
        <ModalMobile open={open} onClose={onClose} title="Fidelidade" height={0.85}>
            <div className="p-4 space-y-6 relative">
                {showToast && (
                    <div className="absolute top-0 left-0 right-0 z-50 flex justify-center">
                        <Toast message="Recompensa adicionada à sacola!" type="success" onClose={() => setShowToast(false)}/>
                    </div>
                )}

                {/* STEP 1: INPUT PHONE */}
                {step === "input_phone" && (
                    <div className="space-y-4 pt-10">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-brand/10 rounded-full flex items-center justify-center text-brand text-2xl">
                                <FontAwesomeIcon icon={faGift} />
                            </div>
                        </div>
                        <p className="text-gray-600 text-center font-medium">
                            Digite seu WhatsApp para acessar seus pontos.
                        </p>
                        <Input 
                            placeholder="(00) 00000-0000"
                            value={customer_phone}
                            onChange={(e) => setPhone(e.target.value)} 
                            type="tel"
                            className="text-center text-lg tracking-widest"
                        />
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}
                        
                        <Button 
                            onClick={handleSendCode} 
                            loading={loading} 
                            className="w-full mt-4"
                        >
                            Enviar Código de Acesso
                        </Button>
                        <p className="text-xs text-gray-400 text-center px-4">
                            Enviaremos um código temporário para o seu WhatsApp para confirmar sua identidade.
                        </p>
                    </div>
                )}

                {/* STEP 2: INPUT OTP (NOVO) */}
                {step === "waiting_code" && (
                    <div className="space-y-4 pt-10 animate-fadeIn">
                        <div className="flex justify-center mb-4">
                            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-500 text-2xl">
                                <FontAwesomeIcon icon={faLock} />
                            </div>
                        </div>
                        
                        <div className="text-center">
                            <p className="text-gray-800 font-bold text-lg">Digite o código</p>
                            <p className="text-gray-500 text-sm mt-1">
                                Enviado para o WhatsApp <strong>{customer_phone}</strong>
                            </p>
                        </div>

                        <Input 
                            placeholder="000000"
                            value={otpCode}
                            onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))} 
                            type="tel"
                            className="text-center text-2xl tracking-[0.5em] font-bold"
                            autoFocus
                        />

                        
                        
                        <Button 
                            onClick={handleVerifyCode} 
                            loading={loading} 
                            className="w-full mt-4"
                            disabled={otpCode.length < 6}
                        >
                            Confirmar Código
                        </Button>
                        
                        {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                        <button 
                            onClick={() => { reset(); setOtpCode(""); }} 
                            className="w-full text-center text-sm text-brand mt-4 underline"
                        >
                            Trocar número
                        </button>
                    </div>
                )}

                {/* STEP 3: VIEW DATA */}
                {step === "view_history" && (
                    <div className="space-y-8 animate-fadeIn">
                        
                        {/* FIDELIDADE CARD */}
                        <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm text-center relative overflow-hidden">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-brand/50 to-brand"></div>
                            
                            <h3 className="font-bold text-xl text-gray-900 mb-1">
                                {program?.reward_description || "Programa de Fidelidade"}
                            </h3>
                            
                            {program?.active ? (
                                <>
                                    <p className="text-sm text-gray-500 mb-2">
                                        Complete a cartela para ganhar.
                                    </p>
                                    
                                    {renderProgress()}
                                </>
                            ) : (
                                <p className="text-gray-500 text-sm py-4">
                                    Este restaurante não possui programa ativo no momento.
                                </p>
                            )}
                        </div>

                        {/* LISTA DE PEDIDOS */}
                        <div>
                            <h3 className="font-bold text-gray-900 mb-3 ml-1 text-sm uppercase tracking-wider text-gray-400">Histórico Recente</h3>
                            {orders.length === 0 ? (
                                <div className="text-center py-8 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <p className="text-gray-400 text-sm">Nenhum pedido pontuado ainda.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map((order) => (
                                        <div key={order.id} className="flex justify-between items-center border-b border-gray-50 pb-3 last:border-0">
                                            <div className="flex items-center gap-3">
                                                {/* Bolinha muda de cor se for Resgate */}
                                                <div className={`w-2 h-2 rounded-full ${
                                                    order.loyalty_points_used > 0 ? 'bg-blue-500' : // Azul para resgate
                                                    order.loyalty_credited ? 'bg-green-500' : 'bg-gray-300'
                                                }`}></div>
                                                
                                                <div>
                                                    <p className="font-medium text-sm text-gray-800">
                                                        Pedido #{order.display_id}
                                                    </p>
                                                    <p className="text-xs text-gray-400">
                                                        {new Date(order.created_at).toLocaleDateString('pt-BR')}
                                                    </p>
                                                </div>
                                            </div>
                                            
                                            {/* Badge da Direita */}
                                            {order.loyalty_points_used > 0 ? (
                                                <span className="text-xs font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded-full">
                                                    Trocou {order.loyalty_points_used} pts
                                                </span>
                                            ) : order.loyalty_credited ? (
                                                <span className="text-xs font-bold text-brand bg-brand/10 px-2 py-1 rounded-full">
                                                    +1 Selo
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">
                                                    Não pontuou
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button variant="secondary" onClick={reset} className="w-full text-xs text-gray-400 hover:text-gray-600">
                            Sair / Trocar número
                        </Button>
                    </div>
                )}
            </div>
        </ModalMobile>
    );
}