// lib/creationStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';

type CreationState = {
    restaurantId: string | null;
    email: string | null; 
    setRestaurantId: (id: string) => void;
    setEmail: (email: string) => void;
    clear: () => void;
};

export const useCreationStore = create<CreationState>()(
    persist(
        (set) => ({
            restaurantId: null,
            email: null, 
            setRestaurantId: (id) => set({ restaurantId: id }),
            setEmail: (email) => set({ email: email }), 
            clear: () => set({ restaurantId: null, email: null }), 
        }),
        {
            name: 'restaurant-creation-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);