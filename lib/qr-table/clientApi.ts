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
