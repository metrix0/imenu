// lib/stores/promotionsStore.ts
import { create } from "zustand";

interface PromotionsState {
    selectedItemIds: string[];
    toggleItem: (id: string) => void;
    selectMany: (ids: string[]) => void;
    clear: () => void;
}

export const usePromotionsStore = create<PromotionsState>((set) => ({
    selectedItemIds: [],
    toggleItem: (id) =>
        set((s) => ({
            selectedItemIds: s.selectedItemIds.includes(id)
                ? s.selectedItemIds.filter((x) => x !== id)
                : [...s.selectedItemIds, id],
        })),
    selectMany: (ids) => set({ selectedItemIds: ids }),
    clear: () => set({ selectedItemIds: [] }),
}));
