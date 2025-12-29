import { create } from "zustand";
import { Order, LoyaltyBalance, LoyaltyProgram } from "@/lib/types/types";

type HistoryStep = "input_phone" | "waiting_code" | "view_history";

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

  // AUTH Actions (Novas)
  requestOtp: () => Promise<void>;
  validateOtp: (code: string, restaurantId: string) => Promise<void>;

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
    error: null,
    loading: false 
  }),

  // 1. Enviar Código via WhatsApp
  requestOtp: async () => {
    const { customer_phone } = get();
    
    if (!customer_phone || customer_phone.length < 8) {
        set({ error: "Digite um número válido." });
        return;
    }

    set({ loading: true, error: null });

    try {
        const res = await fetch("/api/auth/send-otp", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ phone: customer_phone }),
        });

        if (!res.ok) throw new Error("Erro ao enviar código.");

        set({ step: "waiting_code", loading: false });

    } catch (error) {
        console.error(error);
        set({ error: "Erro ao enviar SMS. Tente novamente.", loading: false });
    }
  },

  // 2. Validar Código e Gerar Cookie
  validateOtp: async (code: string, restaurantId: string) => {
      const { customer_phone } = get();
      set({ loading: true, error: null });

      try {
          // Verifica o código
          const res = await fetch("/api/auth/verify-otp", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ phone: customer_phone, code }),
          });

          if (!res.ok) {
              const data = await res.json();
              throw new Error(data.error || "Código inválido");
          }

          // Se deu certo, o Cookie já foi criado pelo backend.
          // Agora buscamos os dados.
          await get().fetchHistory(restaurantId);

      } catch (error: any) {
          console.error(error);
          set({ error: error.message, loading: false });
      }
  },

  fetchHistory: async (restaurantId: string) => {
    set({ loading: true, error: null });
    
    try {
      // NOTE: Não enviamos mais o 'phone' no body. O backend pega do Cookie.
      const res = await fetch("/api/loyalty/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ restaurant_id: restaurantId }), 
      });

      if (res.status === 401) {
          // Se der 401, o cookie expirou ou é inválido
          set({ step: "input_phone", error: "Sessão expirada. Identifique-se novamente." });
          return;
      }

      if (!res.ok) throw new Error("Erro ao buscar histórico");

      const data = await res.json();
      
      set({
        loyaltyBalance: data.balance, // Pode ser null se cliente nunca comprou
        orders: data.orders || [],
        program: data.program || null, // ✅ Salva as regras vindas da API
        step: "view_history",
      });

    } catch (error) {
      console.error(error);
      set({ error: "Ocorreu um erro ao carregar seus pontos.", loading: false });
    }
  },
}));