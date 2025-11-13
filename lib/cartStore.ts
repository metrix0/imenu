// lib/cartStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';

// O carrinho agora só armazena o ID do pedido ativo
type CartState = {
    orderId: string | null;
    restaurantSlug: string | null; // Para saber a qual restaurante o pedido pertence
    
    // Armazena o ID do pedido e o slug do restaurante
    setDraftOrder: (orderId: string, restaurantSlug: string) => void;
    
    // Limpa o carrinho (após o checkout)
    clearCart: () => void;
};

export const useCart = create<CartState>()(
    persist(
        (set) => ({
            orderId: null,
            restaurantSlug: null,
            setDraftOrder: (orderId, restaurantSlug) => set({ orderId, restaurantSlug }),
            clearCart: () => set({ orderId: null, restaurantSlug: null }),
        }),
        {
            name: 'cart-storage', // A chave no localStorage
            storage: createJSONStorage(() => localStorage),
        }
    )
);