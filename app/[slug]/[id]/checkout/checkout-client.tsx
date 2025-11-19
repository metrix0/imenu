// app/[slug]/[id]/checkout/checkout-client.tsx
"use client";

import React, { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cartStore";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";
// --- 1. Importar o Popup ---
import Popup from "@/components/Popup"; // (Presumindo que está em @/components/Popup.tsx)
import posthog from "posthog-js";

// (Tipos 'Order', 'Restaurant' e 'formatPrice' - sem mudança)
type Order = {
    id: string;
    status: string;
    subtotal_cents: number;
    delivery_cents: number;
    total_cents: number;
    restaurant_id: string;
    customer_name: string;
    customer_phone: string;
    customer_address: string | null;
    is_delivery: boolean;
};
type Restaurant = {
    id: string;
    name: string;
    logo_url: string | null;
};
const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};
// --- Fim dos Tipos ---

export default function CheckoutClientPage({
    slug,
    order,
    restaurant,
}: {
    slug: string;
    order: Order;
    restaurant: Restaurant;
}) {
    const router = useRouter();
    const { clearCart } = useCart();

    useEffect(() => {
        if (!slug || !order?.id) return;

        posthog.capture("checkout_page_viewed", {
            restaurant_slug: slug,
            order_id: order.id,
            total_cents: order.total_cents,
            delivery_cents: order.delivery_cents,
            is_delivery: order.is_delivery,
        });
    }, [slug, order?.id]);


    const [paymentMethod, setPaymentMethod] = useState<"online" | "machine">("online");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // --- 2. State para o Popup ---
    const [isSuccessPopupOpen, setIsSuccessPopupOpen] = useState(false);

    // --- 3. Função de Fechar/Redirecionar ---
    const handlePopupClose = () => {
        setIsSuccessPopupOpen(false);
        router.push(`/${slug}`); // Redireciona para o cardápio
    };

    const handleFinalizeOrder = async () => {
        setIsSubmitting(true);
        setError(null);

        try {
            const response = await fetch("/api/checkout/finalize", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    orderId: order.id,
                    customer_name: order.customer_name,
                    customer_phone: order.customer_phone,
                    customer_address: order.customer_address,
                    delivery_fee_cents: order.delivery_cents,
                    paymentMethod: paymentMethod,
                    isDelivery: order.is_delivery,
                }),
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || "Falha ao finalizar o pedido.");
            }

            const data = await response.json();
            clearCart();

            // --- 4. LÓGICA DE REDIRECIONAMENTO ATUALIZADA ---
            if (data.payment_type === "machine") {
                // Caso 1: Maquininha -> MOSTRA O POPUP DE SUCESSO
                setIsSuccessPopupOpen(true);
                // (O 'handlePopupClose' cuidará do redirecionamento)

            } else if (data.payment_type === "online" && data.init_point) {
                // Caso 2: Online -> Redireciona para o Mercado Pago
                window.location.href = data.init_point;
            } else {
                throw new Error("Resposta da API inválida.");
            }
            // --- FIM DA ATUALIZAÇÃO ---

        } catch (err) {
            setError((err as Error).message);
            setIsSubmitting(false);
        }
    };

    return (
        // UI baseada no rascunho (Mobile First)
        <div className="min-h-screen bg-gray-50 pb-32">
            <div className="max-w-lg mx-auto bg-white shadow-sm min-h-screen">

                {/* (Header) */}
                <div className="p-4 flex items-center gap-3 border-b">
                    {restaurant.logo_url && (
                        <img src={restaurant.logo_url} alt="Logo" className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div>
                        <h2 className="font-semibold">{restaurant.name}</h2>
                    </div>
                </div>

                {/* (Seção de Pagamento) */}
                <div className="p-4 border-b">
                    <h2 className="text-xl font-bold mb-4">Pagamento</h2>
                    <div className="space-y-3">
                        <label className="flex items-center p-4 border rounded-md has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-500">
                            <input type="radio" name="paymentMethod" value="online"
                                checked={paymentMethod === "online"} onChange={e => setPaymentMethod(e.target.value as "online")}
                                className="h-4 w-4 text-indigo-600 border-gray-300" />
                            <span className="ml-3 block text-sm font-medium text-gray-700">
                                Pagar Online (Pix ou Cartão)
                            </span>
                        </label>
                        <label className="flex items-center p-4 border rounded-md has-[:checked]:bg-indigo-50 has-[:checked]:border-indigo-500">
                            <input type="radio" name="paymentMethod" value="machine"
                                checked={paymentMethod === "machine"} onChange={e => setPaymentMethod(e.target.value as "machine")}
                                className="h-4 w-4 text-indigo-600 border-gray-300" />
                            <span className="ml-3 block text-sm font-medium text-gray-700">Pagar na Entrega (Maquininha)</span>
                        </label>
                    </div>
                </div>

                {/* (Resumo de Valores) */}
                <div className="p-4">
                    <h2 className="text-xl font-bold mb-4">Resumo de valores</h2>
                    <div className="space-y-3">
                        <div className="flex justify-between text-gray-700">
                            <span>Subtotal</span>
                            <span>{formatPrice(order.subtotal_cents)}</span>
                        </div>
                        <div className="flex justify-between text-gray-700">
                            <span>Taxa de Entrega</span>
                            <span className={order.delivery_cents === 0 ? "text-green-600 font-medium" : ""}>
                                {order.is_delivery ?
                                    (order.delivery_cents === 0 ? "Grátis" : formatPrice(order.delivery_cents))
                                    : "Retirada na loja"
                                }
                            </span>
                        </div>
                        <hr className="my-2" />
                        <div className="flex justify-between text-lg font-bold text-gray-900">
                            <span>Total</span>
                            <span>{formatPrice(order.total_cents)}</span>
                        </div>
                    </div>
                </div>

                {error && (
                    <div className="p-4">
                        <p className="text-center text-sm text-red-600">{error}</p>
                    </div>
                )}
            </div>

            {/* (Rodapé Fixo) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-inner z-20">
                <div className="max-w-lg mx-auto flex justify-between items-center">
                    <p className="font-bold text-xl">{formatPrice(order.total_cents)}</p>
                    <button
                        onClick={handleFinalizeOrder}
                        disabled={isSubmitting}
                        className="bg-red-600 text-white px-8 py-3 rounded-lg font-bold text-lg shadow-md disabled:opacity-50"
                    >
                        {isSubmitting ? "Finalizando..." : "Revisar pedido"}
                    </button>
                </div>
            </div>

            {/* --- 5. RENDERIZA O POPUP --- */}
            <Popup
                open={isSuccessPopupOpen}
                onClose={handlePopupClose}
            >
                {/* Conteúdo customizado do Popup */}
                <h2 className="text-2xl font-bold text-green-600 mb-4">Sucesso!</h2>
                <p>Seu pedido foi realizado e enviado para a loja.</p>
            </Popup>
        </div>
    );
}