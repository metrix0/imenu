"use client";

import { supabase } from "@/lib/database/supabaseClient";
import type { PaymentCheckoutInput } from "@/lib/payments/types";
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

export type QrTableCheckoutResult = {
    active: boolean;
    recurring?: boolean;
    paymentMethod: "pix" | "credit_card";
    paymentStatus: string | null;
    transactionId?: string;
    qrCodeText?: string | null;
    qrCodeBase64?: string | null;
    qrCodeUrl?: string | null;
};

export async function startQrTableCheckout(
    restaurantId: string,
    source: QrTableSource,
    payment: PaymentCheckoutInput,
    options: { renew?: boolean } = {}
): Promise<QrTableCheckoutResult> {
    const response = await qrTableAuthenticatedFetch("/api/qr-table/checkout", {
        method: "POST",
        body: JSON.stringify({
            restaurantId,
            source,
            paymentMethod: payment.method,
            card: payment.method === "credit_card" ? payment.card : undefined,
            renew: options.renew === true,
        }),
    });
    const payload = (await response.json()) as QrTableCheckoutResult & {
        error?: string;
    };

    if (!response.ok) {
        throw new Error(
            payload.error || "Não foi possível processar o pagamento."
        );
    }

    return payload;
}

export async function updateQrTableDesign(
    restaurantId: string,
    template: string,
    color: string
): Promise<void> {
    const response = await qrTableAuthenticatedFetch("/api/qr-table/design", {
        method: "POST",
        body: JSON.stringify({ restaurantId, template, color }),
    });
    const payload = (await response.json()) as { error?: string };

    if (!response.ok) {
        throw new Error(
            payload.error || "Não foi possível salvar o design."
        );
    }
}

export type QrTableReconcileResult = {
    active: boolean;
    activatedNow: boolean;
    status: string;
    paymentStatus: string | null;
};

export async function reconcileQrTableCheckout(
    restaurantId?: string | null,
    options: { renew?: boolean } = {}
): Promise<QrTableReconcileResult> {
    const response = await qrTableAuthenticatedFetch("/api/qr-table/reconcile", {
        method: "POST",
        body: JSON.stringify({
            ...(restaurantId ? { restaurantId } : {}),
            renew: options.renew === true,
        }),
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
