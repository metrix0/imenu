"use client";

import { useEffect } from "react";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";

type Props = {
    enabled: boolean;
};

const PICKUP_LABEL_TEXT = "Retirar pedido no balcão";

export default function PickupAvailabilityGuard({ enabled }: Props) {
    useEffect(() => {
        if (enabled) return;

        const checkout = useCheckoutStore.getState() as any;

        if (checkout.is_pickup) {
            useCheckoutStore.setState({ is_pickup: false } as any);
        }

        checkout.setField?.("delivery_fee_cents", null);
        checkout.setField?.("delivery_time_minutes", null);

        const hidePickupOption = () => {
            document.querySelectorAll("label").forEach((label) => {
                if (
                    label.textContent
                        ?.replace(/\s+/g, " ")
                        .includes(PICKUP_LABEL_TEXT)
                ) {
                    label.style.display = "none";
                    label.setAttribute("aria-hidden", "true");
                }
            });
        };

        hidePickupOption();

        const observer = new MutationObserver(hidePickupOption);
        observer.observe(document.body, {
            childList: true,
            subtree: true,
        });

        return () => observer.disconnect();
    }, [enabled]);

    return null;
}
