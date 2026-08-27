// lib/stores/costumer/checkoutStore.ts
import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CouponDiscountType = "percent" | "fixed" | "delivery";

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

    pagamento: "pix" | "pix-entrega" | "cartao" | "dinheiro" | "trazer-maquininha";

    delivery_fee_cents: number | null | boolean;
    delivery_time_minutes: number | null;
    scheduled_for: string | null;

    // ✅ coupon (RAW, from Supabase – persisted)
    coupon_id: string | null;
    coupon_code: string | null;
    coupon_type: CouponDiscountType | null;
    coupon_value: number | null;        // percent OR cents
    coupon_max_value: number | null;    // cents
    coupon_min_order: number | null;    // cents
    coupon_one_coupon_per_user: null,

    // ✅ coupon (CALCULATED, frontend preview)
    coupon_discount_cents: number | null;

    showAddressWarning: boolean;
    cepTrigger: boolean;

    setStep: (s: CheckoutState["step"]) => void;
    setField: (key: string, value: string | number | boolean | null) => void;

    setShowAddressWarning: (v: boolean) => void;
    setRestaurantId: (id: string) => void;

    isContinueBlocked: boolean;
    setContinueBlocked: (v: boolean) => void;
}

function getActiveCheckoutModalRoot() {
    if (typeof document === "undefined") return null;

    const roots = Array.from(
        document.querySelectorAll<HTMLElement>(".fixed.inset-0.z-41")
    ).filter((element) => element.getClientRects().length > 0);

    return roots[roots.length - 1] ?? null;
}

function resetCheckoutModalScroll() {
    const root = getActiveCheckoutModalRoot();
    if (!root) return;

    const scrollTargets = [
        root,
        ...root.querySelectorAll<HTMLElement>(".overflow-y-auto"),
    ];

    scrollTargets.forEach((element) => {
        element.scrollTop = 0;
    });
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

            delivery_fee_cents: false, // false = nao calculado, null = muito longe, number = valor
            delivery_time_minutes: null,
            scheduled_for: null,

            // ✅ coupon defaults
            coupon_id: null,
            coupon_code: null,
            coupon_type: null,
            coupon_value: null,
            coupon_max_value: null,
            coupon_min_order: null,
            coupon_discount_cents: null,
            coupon_one_coupon_per_user: null,

            // ⚠️ UI state (do NOT persist)
            showAddressWarning: false,
            cepTrigger: false,

            setStep: (s) => {
                set({ step: s });

                if (typeof window !== "undefined") {
                    const reset = () => resetCheckoutModalScroll();

                    reset();
                    requestAnimationFrame(() => {
                        requestAnimationFrame(reset);
                    });
                    window.setTimeout(reset, 340);
                }
            },

            setField: (key, value) => {
                const normalizedValue =
                    (key === "coupon_max_value" || key === "coupon_min_order") && value !== null
                        ? Math.round(Number(value) * 100)
                        : value;

                if (key === "cep") {
                    set({
                        cep: String(normalizedValue ?? ""),
                        rua: "",
                        bairro: "",
                        cidade: "",
                        estado: "",
                        delivery_fee_cents: false,
                        delivery_time_minutes: null,
                    });
                    return;
                }

                set({ [key]: normalizedValue } as any);
            },

            setShowAddressWarning: (v) =>
                set({ showAddressWarning: v }),

            setRestaurantId: (id) =>
                set({ restaurantId: id }),

            isContinueBlocked: false,
            setContinueBlocked: (v) => set({ isContinueBlocked: v }),
        }),
        {
            name: "checkout-store",

            // 🔥 persist ONLY real checkout data
            partialize: (state) => ({
                restaurantId: state.restaurantId,

                cep: state.cep,
                rua: state.rua,
                bairro: state.bairro,
                numero: state.numero,
                cidade: state.cidade,
                estado: state.estado,
                complemento: state.complemento,
                nome: state.nome,
                celular: state.celular,
                pagamento: state.pagamento,

            }),
        }
    )
);

type CheckoutSwipeWindow = Window & {
    __imenuCheckoutSwipeInstalled?: boolean;
};

if (typeof window !== "undefined") {
    const checkoutWindow = window as CheckoutSwipeWindow;

    if (!checkoutWindow.__imenuCheckoutSwipeInstalled) {
        checkoutWindow.__imenuCheckoutSwipeInstalled = true;

        let touchStart: {
            x: number;
            y: number;
            root: HTMLElement;
        } | null = null;

        document.addEventListener(
            "touchstart",
            (event) => {
                const target = event.target;
                if (!(target instanceof Element)) {
                    touchStart = null;
                    return;
                }

                const root = target.closest(
                    ".fixed.inset-0.z-41"
                ) as HTMLElement | null;
                const touch = event.touches[0];

                if (!root || !touch) {
                    touchStart = null;
                    return;
                }

                touchStart = {
                    x: touch.clientX,
                    y: touch.clientY,
                    root,
                };
            },
            { passive: true }
        );

        document.addEventListener(
            "touchend",
            (event) => {
                if (!touchStart) return;

                const start = touchStart;
                touchStart = null;

                if (start.root.getClientRects().length === 0) return;

                const touch = event.changedTouches[0];
                if (!touch) return;

                const deltaX = touch.clientX - start.x;
                const deltaY = touch.clientY - start.y;

                const isLeftSwipe =
                    deltaX <= -70 &&
                    Math.abs(deltaX) > Math.abs(deltaY) * 1.25;

                if (!isLeftSwipe) return;

                const state = useCheckoutStore.getState();
                if (state.step === "checkout") {
                    state.setStep("info");
                } else if (state.step === "info") {
                    state.setStep("cart");
                }
            },
            { passive: true }
        );
    }
}
