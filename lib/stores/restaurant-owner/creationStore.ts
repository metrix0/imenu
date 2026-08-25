// lib/creationStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';

type CreationState = {
    restaurantId: string | null;
    email: string | null; 
    productSelectionCompleted: boolean;
    setRestaurantId: (id: string) => void;
    setEmail: (email: string) => void;
    setProductSelectionCompleted: (completed: boolean) => void;
    clear: () => void;
    restaurantSlug?: string | null;
    setRestaurantSlug: (slug: string | null) => void;
};

export const useCreationStore = create<CreationState>()(
    persist(
        (set) => ({
            restaurantId: null,
            email: null,
            productSelectionCompleted: false,
            setRestaurantId: (id) => set({ restaurantId: id }),
            setEmail: (email) => set({ email: email }), 
            setProductSelectionCompleted: (completed) =>
                set({ productSelectionCompleted: completed }),
            clear: () => set({
                restaurantId: null,
                email: null,
                productSelectionCompleted: false,
            }),
            restaurantSlug : null,
            setRestaurantSlug: (slug) => set({ restaurantSlug: slug }),
        }),
        {
            name: 'restaurant-creation-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);
