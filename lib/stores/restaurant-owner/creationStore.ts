// lib/creationStore.ts
"use client";
import { create } from "zustand";
import { persist, createJSONStorage } from 'zustand/middleware';
import type { FiscalChannels } from '@/lib/nfce/channels';

type PlusSnapshot = { restaurantId: string; active: boolean; checkedAt: number };
export type FiscalSnapshot = { restaurantId: string; available: boolean; archive: boolean; configured: boolean; enabled: boolean; channels: FiscalChannels; checkedAt: number };

type OnboardingCompletion = { restaurantId: string; slug: string; completedAt: string };

type CreationState = {
    restaurantId: string | null;
    email: string | null; 
    productSelectionCompleted: boolean;
    setRestaurantId: (id: string) => void;
    setEmail: (email: string) => void;
    setProductSelectionCompleted: (completed: boolean) => void;
    clear: () => void;
    plusSnapshot: PlusSnapshot | null;
    fiscalSnapshot: FiscalSnapshot | null;
    rememberPlus: (restaurantId: string, active: boolean, checkedAt: number) => void;
    rememberFiscal: (snapshot: FiscalSnapshot) => void;
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
    plusSnapshot: null,
    fiscalSnapshot: null,
};

export const useCreationStore = create<CreationState>()(
    persist(
        (set) => ({
            ...emptyCreation,
            setRestaurantId: (id) => set(state => state.restaurantId === id ? { restaurantId: id } : { restaurantId: id, plusSnapshot: null, fiscalSnapshot: null }),
            rememberPlus: (restaurantId, active, checkedAt) => set(state =>
                state.restaurantId !== restaurantId || (state.plusSnapshot?.checkedAt ?? 0) > checkedAt
                    ? state : { plusSnapshot: { restaurantId, active, checkedAt } }),
            rememberFiscal: snapshot => set(state =>
                state.restaurantId !== snapshot.restaurantId || (state.fiscalSnapshot?.checkedAt ?? 0) > snapshot.checkedAt
                    ? state : { fiscalSnapshot: snapshot }),
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

/** Cached presentation only: every paid operation still requires server authorization. */
export function useRestaurantPlus(restaurantId: string | null | undefined): boolean | null {
    return useCreationStore(state => restaurantId && state.plusSnapshot?.restaurantId === restaurantId
        ? state.plusSnapshot.active : null);
}
