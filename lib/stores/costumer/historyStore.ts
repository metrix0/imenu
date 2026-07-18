import { create } from "zustand";
import {
    LoyaltyBalance,
    LoyaltyProgram,
    Order,
} from "@/lib/types/types";

type HistoryStep = "input_phone" | "view_history";

type HistoryStore = {
    isOpen: boolean;
    step: HistoryStep;
    loading: boolean;
    error: string | null;

    customer_phone: string;
    loyaltyBalance: LoyaltyBalance | null;
    program: LoyaltyProgram | null;
    orders: Order[];

    openModal: () => void;
    closeModal: () => void;
    setPhone: (phone: string) => void;
    reset: () => void;
    fetchHistory: (restaurantId: string) => Promise<void>;
};

function normalizePhone(value: string): string {
    let digits = String(value || "").replace(/\D/g, "");

    if (
        digits.startsWith("55") &&
        (digits.length === 12 || digits.length === 13)
    ) {
        digits = digits.slice(2);
    }

    return digits.slice(0, 11);
}

export const useHistoryStore = create<HistoryStore>(
    (set, get) => ({
        isOpen: false,
        step: "input_phone",
        loading: false,
        error: null,

        customer_phone: "",
        loyaltyBalance: null,
        program: null,
        orders: [],

        openModal: () => set({ isOpen: true }),

        closeModal: () => set({ isOpen: false }),

        setPhone: (phone) =>
            set({
                customer_phone: phone,
                error: null,
            }),

        reset: () =>
            set({
                step: "input_phone",
                customer_phone: "",
                loyaltyBalance: null,
                program: null,
                orders: [],
                error: null,
                loading: false,
            }),

        fetchHistory: async (restaurantId: string) => {
            const cleanPhone = normalizePhone(
                get().customer_phone
            );

            if (
                !restaurantId ||
                (cleanPhone.length !== 10 &&
                    cleanPhone.length !== 11)
            ) {
                set({
                    error: "Digite um número de WhatsApp válido.",
                    loading: false,
                });
                return;
            }

            set({
                loading: true,
                error: null,
            });

            try {
                const response = await fetch(
                    "/api/loyalty/status",
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "application/json",
                        },
                        body: JSON.stringify({
                            restaurant_id: restaurantId,
                            phone: cleanPhone,
                        }),
                    }
                );

                const result = await response.json();

                if (!response.ok) {
                    throw new Error(
                        result?.error ||
                            "Erro ao buscar histórico."
                    );
                }

                set({
                    loyaltyBalance:
                        result.balance || null,
                    orders: Array.isArray(result.orders)
                        ? result.orders
                        : [],
                    program: result.program || null,
                    step: "view_history",
                    loading: false,
                    error: null,
                });
            } catch (error) {
                console.error(
                    "[FIDELIDADE] Falha ao carregar histórico:",
                    error
                );

                set({
                    error:
                        error instanceof Error
                            ? error.message
                            : "Ocorreu um erro ao carregar seus pontos.",
                    loading: false,
                });
            }
        },
    })
);
