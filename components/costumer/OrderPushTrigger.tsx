"use client";

import { useEffect } from "react";

export default function OrderPushTrigger({ orderId }: { orderId: string }) {
    useEffect(() => {
        if (!orderId) return;

        void fetch("/api/push/order-ready", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId }),
            keepalive: true,
        }).catch((error) => {
            console.warn("[ORDER_PUSH_TRIGGER] Notification failed:", error);
        });
    }, [orderId]);

    return null;
}
