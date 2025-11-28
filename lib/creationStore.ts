// lib/creationStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';

type CreationState = {
    restaurantId: string | null;
    email: string | null;
    // Novos campos
    fullName: string | null;
    phone: string | null;

    setRestaurantId: (id: string) => void;
    setEmail: (email: string) => void;
    // Novos setters
    setFullName: (name: string) => void;
    setPhone: (phone: string) => void;
    
    clear: () => void;
};

export const useCreationStore = create<CreationState>()(
    persist(
        (set) => ({
            restaurantId: null,
            email: null,
            fullName: null,
            phone: null,

            setRestaurantId: (id) => set({ restaurantId: id }),
            setEmail: (email) => set({ email: email }),
            setFullName: (name) => set({ fullName: name }),
            setPhone: (phone) => set({ phone: phone }),

            clear: () => set({ 
                restaurantId: null, 
                email: null, 
                fullName: null, 
                phone: null 
            }), 
        }),
        {
            name: 'restaurant-creation-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);