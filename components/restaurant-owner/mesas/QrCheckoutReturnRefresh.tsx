"use client";

import { useEffect } from "react";

const CHECKOUT_RETURN_PATHS = new Set([
    "/painel/mesas",
    "/painel/configuracoes",
    "/restaurante/criar/localizacao",
]);
const CHECKOUT_RETURN_STATES = new Set(["success", "cancel", "expired"]);

export default function QrCheckoutReturnRefresh() {
    useEffect(() => {
        if (!CHECKOUT_RETURN_PATHS.has(window.location.pathname)) return;

        const checkoutState = new URLSearchParams(window.location.search).get(
            "checkout"
        );
        if (!checkoutState || !CHECKOUT_RETURN_STATES.has(checkoutState)) return;

        const navigation = performance.getEntriesByType("navigation")[0] as
            | PerformanceNavigationTiming
            | undefined;
        if (navigation?.type === "reload") return;

        window.location.reload();
    }, []);

    return null;
}
