// app/[slug]/[id]/cart-client.tsx
"use client";

import React, { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useCart } from "@/lib/cartStore"; // Apenas para 'clearCart'
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/fontawesome";

// (Tipos de dados recebidos do Server Component)
type OrderItem = {
    id: string;
    name: string;
    price_cents: number;
    quantity: number;
    image_public_url: string | null;
};
type Order = {
    id: string;
    status: string;
    subtotal_cents: number;
};
type Restaurant = {
    id: string;
    name: string;
    logo_url: string | null;
};
type HighlightItem = {
    id: string;
    name: string;
    price_cents: number;
    image_public_url: string | null;
};

const formatPrice = (priceInCents: number) => {
    return (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
};

export default function CartClientPage({
    slug,
    order: initialOrder,
    restaurant,
    initialItems,
    highlights,
}: {
    slug: string;
    order: Order;
    restaurant: Restaurant;
    initialItems: OrderItem[];
    highlights: HighlightItem[];
}) {
    const router = useRouter();
    const { clearCart } = useCart();
    const [isPending, startTransition] = useTransition();

    const [items, setItems] = useState(initialItems);
    const [order, setOrder] = useState(initialOrder);

    // --- Lógica de Interação com API ---

    const updateItemQuantity = async (orderItemId: string, newQuantity: number) => {
        // Atualiza a UI otimistamente
        setItems(prevItems =>
            newQuantity <= 0
                ? prevItems.filter(it => it.id !== orderItemId) // Remove
                : prevItems.map(it => 
                    it.id === orderItemId ? { ...it, quantity: newQuantity } : it
                )
        );

        // Chama a API
        const response = await fetch("/api/cart/update-item", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                orderId: order.id,
                orderItemId: orderItemId,
                newQuantity: newQuantity,
            }),
        });
        const data = await response.json();
        
        // Sincroniza o total (a API recalcula)
        if (data.newSubtotal !== undefined) {
            setOrder(prevOrder => ({ ...prevOrder, subtotal_cents: data.newSubtotal }));
        }
    };
    
    const handleClearCart = async () => {
        if (!confirm("Limpar sacola?")) return;
        
        setItems([]); // Limpa otimistamente
        setOrder(prev => ({ ...prev, subtotal_cents: 0 }));
        
        await fetch("/api/cart/clear", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: order.id }),
        });
        
        clearCart(); // Limpa o ID do localStorage
        router.push(`/${slug}`); // Volta ao cardápio
    };

    const total = order.subtotal_cents; // Por enquanto, total é o subtotal

    return (
        <div className="min-h-screen bg-gray-50 pb-32">
            <div className="max-w-lg mx-auto bg-white shadow-sm">
                
                {/* Header (estilo iFood) */}
                <header className="p-4 flex items-center justify-between border-b">
                    <button onClick={() => router.back()} aria-label="Voltar">
                        <FontAwesomeIcon icon={icons.faChevronLeft} /> {/* (Precisa adicionar faChevronLeft ao fontawesome.ts) */}
                    </button>
                    <h1 className="text-lg font-semibold">SACOLA</h1>
                    <button onClick={handleClearCart} className="text-sm font-medium text-red-600">
                        Limpar
                    </button>
                </header>

                {/* Info Restaurante (do rascunho) */}
                <div className="p-4 flex items-center gap-3 border-b">
                    {restaurant.logo_url && (
                        <img src={restaurant.logo_url} alt="Logo" className="w-12 h-12 rounded-full object-cover" />
                    )}
                    <div>
                        <h2 className="font-semibold">{restaurant.name}</h2>
                        <button onClick={() => router.push(`/${slug}`)} className="text-sm text-indigo-600">
                            Adicionar mais itens
                        </button>
                    </div>
                </div>

                {/* Itens Adicionados */}
                <div className="p-4 space-y-4">
                    <h3 className="font-semibold text-lg">Itens adicionados</h3>
                    {items.length === 0 ? (
                        <p className="text-gray-500">Sua sacola está vazia.</p>
                    ) : (
                        items.map((item) => (
                            <div key={item.id} className="flex gap-3">
                                {item.image_public_url ? (
                                    <img src={item.image_public_url} alt={item.name} className="w-20 h-20 rounded-md object-cover" />
                                ) : (
                                    <div className="w-20 h-20 rounded-md bg-gray-200" />
                                )}
                                <div className="flex-1 min-w-0">
                                    <h4 className="font-medium truncate">{item.name}</h4>
                                    {/* (Descrições não são salvas no order_items, mas o 'name' já é descritivo) */}
                                    <p className="text-gray-600 text-sm">{formatPrice(item.price_cents)}</p>
                                </div>
                                {/* Controles (do rascunho) */}
                                <div className="flex items-center rounded-md border border-gray-300 h-9">
                                    <button 
                                        onClick={() => startTransition(() => updateItemQuantity(item.id, item.quantity - 1))}
                                        className="px-3 py-1 text-lg font-medium text-red-600"
                                    >
                                        -
                                    </button>
                                    <span className="px-3 py-1 text-sm font-medium">{item.quantity}</span>
                                    <button 
                                        onClick={() => startTransition(() => updateItemQuantity(item.id, item.quantity + 1))}
                                        className="px-3 py-1 text-lg font-medium text-green-700"
                                    >
                                        +
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Peça também (do iFood) */}
                {highlights.length > 0 && (
                    <div className="p-4 border-t">
                        <h3 className="font-semibold text-lg mb-4">Peça também</h3>
                        <div className="flex gap-4 overflow-x-auto pb-2">
                            {highlights.map(item => (
                                <button key={item.id} onClick={() => router.push(`/${slug}/item/${item.id}`)} className="flex-shrink-0 w-32 text-left">
                                    {item.image_public_url ? (
                                        <img src={item.image_public_url} alt={item.name} className="w-32 h-24 object-cover rounded-md" />
                                    ) : (
                                        <div className="w-32 h-24 bg-gray-200 rounded-md" />
                                    )}
                                    <p className="text-sm mt-2 truncate">{item.name}</p>
                                    <p className="font-semibold text-sm">{formatPrice(item.price_cents)}</p>
                                </button>
                            ))}
                        </div>
                    </div>
                )}
            </div>

            {/* Rodapé Fixo (Continuar) */}
            <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 p-4 shadow-inner z-20">
                <div className="max-w-lg mx-auto flex justify-between items-center">
                    <div>
                        <p className="text-sm text-gray-600">Total (sem entrega)</p>
                        <p className="font-bold text-xl">{formatPrice(total)}</p>
                    </div>
                    <button
                        onClick={() => router.push(`/${slug}/${order.id}/info`)} // Vai para o Checkout
                        disabled={items.length === 0}
                        className="bg-black text-white px-8 py-3 rounded-lg font-bold text-lg shadow-md disabled:opacity-50"
                    >
                        Continuar
                    </button>
                </div>
            </div>
        </div>
    );
}