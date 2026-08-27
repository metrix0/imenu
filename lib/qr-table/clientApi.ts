"use client";

import { supabase } from "@/lib/database/supabaseClient";
import type { QrTableSource } from "@/lib/qr-table/types";

async function getAccessToken(): Promise<string> {
    const {
        data: { session },
    } = await supabase.auth.getSession();

    if (!session?.access_token) {
        throw new Error("Sua sessão expirou. Entre novamente.");
    }

    return session.access_token;
}

export async function qrTableAuthenticatedFetch(
    input: string,
    init: RequestInit = {}
): Promise<Response> {
    const token = await getAccessToken();
    return fetch(input, {
        ...init,
        headers: {
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers,
            Authorization: `Bearer ${token}`,
        },
    });
}

export async function startQrTableCheckout(
    restaurantId: string,
    source: QrTableSource
): Promise<void> {
    const response = await qrTableAuthenticatedFetch("/api/qr-table/checkout", {
        method: "POST",
        body: JSON.stringify({ restaurantId, source }),
    });
    const payload = (await response.json()) as {
        checkoutUrl?: string;
        error?: string;
    };

    if (!response.ok || !payload.checkoutUrl) {
        throw new Error(
            payload.error || "Não foi possível abrir o pagamento."
        );
    }

    window.location.assign(payload.checkoutUrl);
}

export type QrTableReconcileResult = {
    active: boolean;
    activatedNow: boolean;
    status: string;
    paymentStatus: string | null;
};

export async function reconcileQrTableCheckout(
    restaurantId?: string | null
): Promise<QrTableReconcileResult> {
    const response = await qrTableAuthenticatedFetch("/api/qr-table/reconcile", {
        method: "POST",
        body: JSON.stringify(restaurantId ? { restaurantId } : {}),
        cache: "no-store",
    });
    const payload = (await response.json()) as QrTableReconcileResult & {
        error?: string;
    };

    if (!response.ok) {
        throw new Error(
            payload.error || "Não foi possível confirmar o pagamento."
        );
    }

    return payload;
}
