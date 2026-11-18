// lib/creationStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';

type OnboardingCompletion = { restaurantId: string; slug: string; completedAt: string };

type CreationState = {
    restaurantId: string | null;
    email: string | null; 
    productSelectionCompleted: boolean;
    setRestaurantId: (id: string) => void;
    setEmail: (email: string) => void;
    setProductSelectionCompleted: (completed: boolean) => void;
    clear: () => void;
    onboardingCompletion: OnboardingCompletion | null;
    completeOnboarding: (restaurantId: string, slug: string, completedAt: string | null) => void;
    restaurantSlug?: string | null;
    setRestaurantSlug: (slug: string | null) => void;
};

const emptyCreation = {
    restaurantId: null,
    email: null,
    productSelectionCompleted: false,
    onboardingCompletion: null,
};

export const useCreationStore = create<CreationState>()(
    persist(
        (set) => ({
            ...emptyCreation,
            setRestaurantId: (id) => set({ restaurantId: id }),
            setEmail: (email) => set({ email: email }), 
            setProductSelectionCompleted: (completed) =>
                set({ productSelectionCompleted: completed }),
            clear: () => set(emptyCreation),
            completeOnboarding: (restaurantId, slug, completedAt) => set({
                ...emptyCreation,
                restaurantId,
                restaurantSlug: slug,
                onboardingCompletion: completedAt ? { restaurantId, slug, completedAt } : null,
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
