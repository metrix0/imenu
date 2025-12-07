/*
// lib/stores/costumer/CartStore.ts
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

*/

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CartItem = {
    id: string; // unique id for the cart row
    base_item_id: string;
    name: string;
    image: string;
    qty: number;
    unit_price_cents: number;
    total_cents: number;
    observation?: string;
    selectedSubitems: {
        subcategoryId: string;
        subcategoryName: string;
        subitemId: string;
        subitemName: string;
        price_cents: number;
    }[];
};

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
                        JSON.stringify(i.selectedSubitems) === JSON.stringify(item.selectedSubitems)
                    );

                    // Se já existe, aumenta a quantidade
                    if (existing) {
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
                set((state) => ({
                    items: state.items.map((i) =>
                        i.id === id
                            ? {
                                ...i,
                                qty,
                                total_cents: qty * i.unit_price_cents,
                            }
                            : i
                    ),
                })),

            removeItem: (id: string) =>
                set((state) => ({
                    items: state.items.filter((i) => i.id !== id),
                })),

            clear: () => set({ items: [] }),
        }),
        {
            name: typeof window !== "undefined"
                ? `cart-storage-${window.location.pathname.split("/")[1]}`
                : "cart-storage",        }
    )
);
