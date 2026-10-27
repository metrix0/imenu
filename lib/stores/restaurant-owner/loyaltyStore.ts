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
  fetchProgram: (restaurantId: string) => Promise<boolean>;
  saveProgram: (snapshot?: LoyaltyProgram) => Promise<boolean>;
};

let loadVersion = 0;

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
    const version = ++loadVersion;
    set({ program: null, loading: true });
    try {
      // Chamada para a API que criaremos
      const res = await fetch(`/api/loyalty/config?restaurant_id=${restaurantId}`);
      if (res.ok) {
        const data = await res.json();
        if (version !== loadVersion) return false;
        set({ program: data });
        return true;
      } else {
        // Se não existir, pode ser null ou criar um default no backend
        if (version === loadVersion) set({ program: null });
        return false;
      }
    } catch (error) {
      console.error("Failed to fetch loyalty program", error);
      return false;
    } finally {
      if (version === loadVersion) set({ loading: false });
    }
  },

  saveProgram: async (snapshot) => {
    const program = snapshot || get().program;
    if (!program) return false;

    set({ loading: true });
    try {
      const res = await fetch("/api/loyalty/config", {
        method: "POST", // Upsert logic
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(program),
      });
      
      if (res.ok) {
        const updated = await res.json();
        // A response for an older edit must not overwrite the current draft.
        if (get().program === program) set({ program: updated });
        return true;
      }
      return false;
    } catch (error) {
      console.error("Failed to save loyalty program", error);
      return false;
    } finally {
      set({ loading: false });
    }
  },
}));
