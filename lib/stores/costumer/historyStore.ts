import { create } from "zustand";
import { Order, LoyaltyBalance, LoyaltyProgram } from "@/lib/types/types";

type HistoryStep = "input_phone" | "view_history";

type HistoryStore = {
  // UI State
  isOpen: boolean;
  step: HistoryStep;
  loading: boolean;
  error: string | null;

  // Data State
  customer_phone: string;
  loyaltyBalance: LoyaltyBalance | null;
  program: LoyaltyProgram | null; // ✅ Novo campo adicionado para as regras (meta/recompensa)
  orders: Order[]; 

  // Actions
  openModal: () => void;
  closeModal: () => void;
  setPhone: (phone: string) => void;
  reset: () => void;

  // Async Actions (Calls API)
  fetchHistory: (restaurantId: string) => Promise<void>;
};

export const useHistoryStore = create<HistoryStore>((set, get) => ({
  isOpen: false,
  step: "input_phone",
  loading: false,
  error: null,

  customer_phone: "",
  loyaltyBalance: null,
  program: null, // ✅ Inicializa como null
  orders: [],

  openModal: () => set({ isOpen: true }),
  
  closeModal: () => set({ isOpen: false }),

  setPhone: (phone) => set({ customer_phone: phone, error: null }),

  reset: () => set({ 
    step: "input_phone", 
    customer_phone: "", 
    loyaltyBalance: null, 
    program: null, // ✅ Reseta o programa
    orders: [], 
    error: null 
  }),

  fetchHistory: async (restaurantId: string) => {
    const { customer_phone } = get();
    
    // Validação simples (pode melhorar com regex se quiser)
    if (!customer_phone || customer_phone.length < 8) {
        set({ error: "Digite um número válido." });
        return;
    }

    set({ loading: true, error: null });

    try {
      const res = await fetch("/api/loyalty/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId, phone: customer_phone }),
      });

      if (!res.ok) {
        throw new Error("Erro ao buscar histórico");
      }

      const data = await res.json();
      
      set({
        loyaltyBalance: data.balance, // Pode ser null se cliente nunca comprou
        orders: data.orders || [],
        program: data.program || null, // ✅ Salva as regras vindas da API
        step: "view_history",
      });

    } catch (error) {
      console.error(error);
      set({ error: "Não encontramos pedidos para este número ou ocorreu um erro." });
    } finally {
      set({ loading: false });
    }
  },
}));