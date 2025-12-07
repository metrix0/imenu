// lib/stores/costumer/checkoutStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

interface CheckoutState {
    step: "cart" | "info" | "checkout";

    restaurantId: string | null;

    cep: string;
    rua: string;
    bairro: string;
    numero: string;
    cidade: string;
    estado: string;
    complemento: string;

    nome: string;
    celular: string;

    pagamento: "pix" | "cartao" | "dinheiro" | "trazer-maquininha";

    delivery_fee_cents: number | null | boolean;
    delivery_time_minutes: number | null;

    showAddressWarning: boolean;

    setStep: (s: CheckoutState["step"]) => void;
    setField: (key: string, value: string | number | boolean | null) => void;

    setShowAddressWarning: (v: boolean) => void;

    setRestaurantId: (id: string) => void;
}

export const useCheckoutStore = create<CheckoutState>()(
    persist(
        (set) => ({
            step: "cart",

            restaurantId: null,

            cep: "",
            rua: "",
            bairro: "",
            numero: "",
            cidade: "",
            estado: "",
            complemento: "",
            nome: "",
            celular: "",
            pagamento: "pix",

            delivery_fee_cents: false, // false = nao calculado, null = muito longe, number = valor da fee
            delivery_time_minutes: null,

            // ⚠️ UI state (do NOT persist)
            showAddressWarning: false,

            setStep: (s) => set({ step: s }),

            setField: (key, value) =>
                set({ [key]: value } as any),


            setShowAddressWarning: (v) =>
                set({ showAddressWarning: v }),

            setRestaurantId: (id) => set({ restaurantId: id }),
        }),
        {
            name: "checkout-store",

            // 🔥 Only persist REAL checkout data, not UI flags
            partialize: (state) => ({
                restaurantId: state.restaurantId,

                cep: state.cep,
                rua: state.rua,
                numero: state.numero,
                cidade: state.cidade,
                estado: state.estado,
                complemento: state.complemento,
                nome: state.nome,
                celular: state.celular,
                pagamento: state.pagamento,
                //
                // delivery_fee_cents: state.delivery_fee_cents,
                // delivery_time_minutes: state.delivery_time_minutes,
            }),
        }
    )
);
