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

export type QrTableCheckoutPayment =
    | { method: "pix" }
    | {
          method: "credit_card";
          card: {
              number: string;
              holder: string;
              expiration: string;
              cvv: string;
          };
      };

export type QrTableCheckoutResult = {
    active: boolean;
    recurring?: boolean;
    paymentMethod: "pix" | "credit_card";
    paymentStatus: string | null;
    transactionId?: string;
    qrCodeText?: string | null;
    qrCodeBase64?: string | null;
    qrCodeUrl?: string | null;
    warning?: string;
};

export async function startQrTableCheckout(
    restaurantId: string,
    source: QrTableSource,
    payment?: QrTableCheckoutPayment
): Promise<QrTableCheckoutResult> {
    if (!payment) {
        throw new Error("Escolha uma forma de pagamento.");
    }

    const response = await qrTableAuthenticatedFetch("/api/qr-table/checkout", {
        method: "POST",
        body: JSON.stringify({
            restaurantId,
            source,
            paymentMethod: payment.method,
            card: payment.method === "credit_card" ? payment.card : undefined,
        }),
    });
    const payload = (await response.json()) as QrTableCheckoutResult & {
        error?: string;
    };

    if (!response.ok) {
        throw new Error(payload.error || "Não foi possível processar o pagamento.");
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
