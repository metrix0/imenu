import { create } from "zustand";
import { persist } from "zustand/middleware";

type Rule = {
    radius_km: number;
    time_minutes: number;
    fee_cents: number | null;
};

interface RestauranteConfigState {
    deliveryRules: Record<string, Rule[]>;   // restaurantId → rules
    minOrder: Record<string, number>;        // restaurantId → min order

    setDeliveryRules: (id: string, rules: Rule[]) => void;
    setMinOrder: (id: string, value: number) => void;
    clearRestaurant: (id: string) => void;
}

export const useRestauranteConfig = create<RestauranteConfigState>()(
    persist(
        (set) => ({
            deliveryRules: {},
            minOrder: {},

            setDeliveryRules: (id, rules) =>
                set((state) => ({
                    deliveryRules: { ...state.deliveryRules, [id]: rules },
                })),

            setMinOrder: (id, value) =>
                set((state) => ({
                    minOrder: { ...state.minOrder, [id]: value },
                })),

            clearRestaurant: (id) =>
                set((state) => {
                    const newRules = { ...state.deliveryRules };
                    const newMin = { ...state.minOrder };

                    delete newRules[id];
                    delete newMin[id];

                    return {
                        deliveryRules: newRules,
                        minOrder: newMin,
                    };
                }),
        }),
        {
            name: "restaurante-config-cache",
        }
    )
);
