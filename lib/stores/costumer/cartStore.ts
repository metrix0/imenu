/*
// lib/stores/costumer/cartStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/proxy';

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

*/

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem } from "@/lib/types/types";


type CartState = {
    items: CartItem[];

    addItem: (item: CartItem) => void;
    changeQty: (id: string, qty: number) => void;
    removeItem: (id: string) => void;
    clear: () => void;
};

export const useCartStore = create<CartState>()(
    persist(
        (set) => ({
            items: [],

            addItem: (item: CartItem) =>
                set((state) => {
                    const existing = state.items.find((i) =>
                        i.base_item_id === item.base_item_id &&
                        i.observation === item.observation &&
                        JSON.stringify(i.selectedSubitems) === JSON.stringify(item.selectedSubitems) &&
                        i.is_reward === item.is_reward
                    );

                    // Se já existe, aumenta a quantidade
                    if (existing) {
                        if (existing.is_reward) {
                            return { items: state.items };
                        }
                        return {
                            items: state.items.map((i) =>
                                i.id === existing.id
                                    ? {
                                        ...i,
                                        qty: i.qty + item.qty,
                                        total_cents: (i.qty + item.qty) * i.unit_price_cents,
                                    }
                                    : i
                            ),
                        };
                    }

                    // Caso contrário, adiciona como novo
                    return {
                        items: [...state.items, item],
                    };
                }),
            changeQty: (id: string, qty: number) =>
                set((state) => {
                    const item = state.items.find(i => i.id === id);
                    
                    // 🛑 TRAVA DE SEGURANÇA: Impede aumentar qty de prêmios
                    if (item?.is_reward && qty > 1) {
                        return state; // Retorna o estado sem alterações
                    }

                    return {
                        items: state.items.map((i) =>
                            i.id === id
                                ? {
                                    ...i,
                                    qty,
                                    total_cents: qty * i.unit_price_cents,
                                }
                                : i
                        ),
                    };
                }),

            removeItem: (id: string) =>
                set((state) => ({
                    items: state.items.filter((i) => i.id !== id),
                })),

            clear: () => set({ items: [] }),
        }),
        {
            name: typeof window !== "undefined"
                ? `cart-storage-${window.location.pathname.split("/")[1]}`
                : "cart-storage",        
            }
    )
);
