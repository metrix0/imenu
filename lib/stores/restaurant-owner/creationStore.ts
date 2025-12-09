// lib/creationStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';

type RegisterData = {
    email: string;
    fullName: string;
    phone: string;
    // Não guardamos senha por segurança, o usuário digita de novo
};


type CreationState = {
    restaurantId: string | null;
    email: string | null; 
    setRestaurantId: (id: string) => void;
    setEmail: (email: string) => void;
    draftRegisterData: RegisterData | null;
    setDraftRegisterData: (data: RegisterData) => void;
    clear: () => void;
};

export const useCreationStore = create<CreationState>()(
    persist(
        (set) => ({
            restaurantId: null,
            email: null,
            draftRegisterData: null,

            setRestaurantId: (id) => set({ restaurantId: id }),
            setEmail: (email) => set({ email: email }),
            setDraftRegisterData: (data) => set({ draftRegisterData: data }), 
            clear: () => set({ restaurantId: null, email: null }), 
        }),
        {
            name: 'restaurant-creation-storage',
            storage: createJSONStorage(() => localStorage),
        }
    )
);