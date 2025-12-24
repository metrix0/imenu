import { create } from "zustand";
import { LoyaltyProgram } from "@/lib/types/types";

type LoyaltyStore = {
  // State
  program: LoyaltyProgram | null;
  loading: boolean;
  
  // Actions
  setProgram: (program: LoyaltyProgram | null) => void;
  updateField: (field: keyof LoyaltyProgram, value: any) => void;
  
  // Async Actions (Calls API)
  fetchProgram: (restaurantId: string) => Promise<void>;
  saveProgram: () => Promise<void>;
};

export const useLoyaltyStore = create<LoyaltyStore>((set, get) => ({
  program: null,
  loading: false,

  setProgram: (program) => set({ program }),

  updateField: (field, value) => {
    const current = get().program;
    if (!current) return;
    set({ program: { ...current, [field]: value } });
  },

  fetchProgram: async (restaurantId: string) => {
    set({ loading: true });
    try {
      // Chamada para a API que criaremos
      const res = await fetch(`/api/loyalty/config?restaurant_id=${restaurantId}`);
      if (res.ok) {
        const data = await res.json();
        set({ program: data });
      } else {
        // Se não existir, pode ser null ou criar um default no backend
        set({ program: null });
      }
    } catch (error) {
      console.error("Failed to fetch loyalty program", error);
    } finally {
      set({ loading: false });
    }
  },

  saveProgram: async () => {
    const { program } = get();
    if (!program) return;

    set({ loading: true });
    try {
      const res = await fetch("/api/loyalty/config", {
        method: "POST", // Upsert logic
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(program),
      });
      
      if (res.ok) {
        const updated = await res.json();
        set({ program: updated });
      }
    } catch (error) {
      console.error("Failed to save loyalty program", error);
    } finally {
      set({ loading: false });
    }
  },
}));