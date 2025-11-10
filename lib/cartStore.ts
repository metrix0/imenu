// lib/cartStore.ts
"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { CartItem, CartStore } from "./types";

// Criamos o cartStore com persistência no localStorage
export const useCart = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],

            // Adiciona um novo item configurado
            // Nota: Esta lógica não tenta "mesclar" itens com a mesma base_item_id
            // porque eles podem ter subitens diferentes. Cada 'add' cria uma nova linha.
            add: (item) => {
                set((state) => ({
                    items: [...state.items, item],
                }));
            },

            remove: (itemId) => {
                set((state) => ({
                    items: state.items.filter((item) => item.itemId !== itemId),
                }));
            },

            setQty: (itemId, qty) => {
                if (qty < 1) {
                    get().remove(itemId);
                    return;
                }
                set((state) => ({
                    items: state.items.map((item) =>
                        item.itemId === itemId ? { ...item, qty } : item
                    ),
                }));
            },

            total_cents: () => {
                return get().items.reduce((total, item) => total + item.price_cents * item.qty, 0);
            },

            clearCart: () => {
                set({ items: [] });
            },
        }),
        {
            name: "digital-menu-cart-storage", // nome da chave no localStorage
        }
    )
);