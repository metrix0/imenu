"use client";

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { CartItem, CartStore } from "@/lib/types";

export const useCartStore = create<CartStore>()(
    persist(
        (set, get) => ({
            items: [],

            add: (item: CartItem) => {
                const exists = get().items.find(i => i.itemId === item.itemId);

                if (exists) {
                    // Increase quantity if same config already exists
                    set({
                        items: get().items.map(i =>
                            i.itemId === item.itemId
                                ? { ...i, qty: i.qty + item.qty }
                                : i
                        ),
                    });
                } else {
                    set({ items: [...get().items, item] });
                }
            },

            remove: (itemId: string) => {
                set({
                    items: get().items.filter(i => i.itemId !== itemId),
                });
            },

            setQty: (itemId: string, qty: number) => {
                set({
                    items: get().items.map(i =>
                        i.itemId === itemId ? { ...i, qty } : i
                    ),
                });
            },

            total_cents: () => {
                return get().items.reduce(
                    (acc, item) => acc + item.price_cents * item.qty,
                    0
                );
            },

            clearCart: () => {
                set({ items: [] });
            },
        }),
        {
            name: "cart-storage",
            storage: createJSONStorage(() => localStorage),
        }
    )
);
