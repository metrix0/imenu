// lib/creationStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';

type CreationState = {
    restaurantId: string | null;
    setRestaurantId: (id: string) => void;
    clear: () => void;
};

export const useCreationStore = create<CreationState>()(
    persist(
        (set) => ({
            restaurantId: null,
            setRestaurantId: (id) => set({ restaurantId: id }),
            clear: () => set({ restaurantId: null }),
        }),
        {
            name: 'restaurant-creation-storage', // Key in localStorage
            storage: createJSONStorage(() => localStorage),
        }
    )
);