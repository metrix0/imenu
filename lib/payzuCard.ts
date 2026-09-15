import { createHmac, timingSafeEqual } from "node:crypto";
import * as https from "node:https";

const DEFAULT_PAYZU_CARD_BASE_URL = "https://api.payzu.io/v1";
const PAYZU_CARD_REQUEST_TIMEOUT_MS = 10_000;
const WEBHOOK_TOLERANCE_MS = 5 * 60 * 1000;

type PayZuCardTokenResponse = {
    access_token?: string;
    expires_in?: number;
};

type PayZuCardErrorPayload = {
    message?: string;
    error?: string;
    errors?: Array<{ message?: string; description?: string }>;
};

export type PayZuCardInput = {
    number: string;
    holder: string;
    expiration: string;
    cvv: string;
};

export type PayZuCardCharge = {
    id?: string;
    externalId?: string;
    amount?: number;
    createdAt?: string;
    updatedAt?: string;
    paymentType?: string;
    creditCardPayment?: {
        status?: number;
        reasonCode?: number;
        reasonMessage?: string;
        returnCode?: string;
        returnMessage?: string;
    };
    recurrence?: {
        recurrentPaymentId?: string;
        interval?: string;
        status?: string;
        amount?: number;
        nextRecurrency?: string;
        endDate?: string;
    };
    recurrenceCycle?: number;
};

export class PayZuCardApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "PayZuCardApiError";
        this.status = status;
    }
}

type CardConfig = {
    baseUrl: string;
    clientId: string;
    clientSecret: string;
    cert: string;
    key: string;
    ca: string;
};

let tokenCache: { token: string; expiresAt: number } | null = null;

function normalizePem(value: string): string {
    return value.replace(/\\n/g, "\n").trim();
}

function getCardConfig(): CardConfig {
    const clientId = process.env.PAYZU_CARD_CLIENT_ID?.trim() || "";
    const clientSecret = process.env.PAYZU_CARD_CLIENT_SECRET?.trim() || "";
    const cert = process.env.PAYZU_CARD_CLIENT_CERT?.trim() || "";
    const key = process.env.PAYZU_CARD_CLIENT_KEY?.trim() || "";
    const ca = process.env.PAYZU_CARD_CA_CERT?.trim() || "";

    if (!clientId || !clientSecret || !cert || !key || !ca) {
        throw new PayZuCardApiError(
            "Pagamento por cartão PayZu ainda não configurado.",
            503
        );
    }

    return {
        baseUrl: (
            process.env.PAYZU_CARD_BASE_URL?.trim() ||
            DEFAULT_PAYZU_CARD_BASE_URL
        ).replace(/\/+$/, ""),
        clientId,
        clientSecret,
        cert: normalizePem(cert),
        key: normalizePem(key),
        ca: normalizePem(ca),
    };
}

function parseJson(text: string): any {
    if (!text) return null;
    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

function cardErrorMessage(data: PayZuCardErrorPayload | null): string {
    return (
        data?.errors?.[0]?.description ||
        data?.errors?.[0]?.message ||
        data?.message ||
        data?.error ||
        "Não foi possível concluir a operação no PayZu."
    );
}

async function rawCardRequest(
    path: string,
    options: {
        method?: string;
        body?: string;
        authorization?: string;
    } = {}
): Promise<{ status: number; data: any }> {
    const config = getCardConfig();
    const target = new URL(`${config.baseUrl}${path}`);
    const body = options.body;

    return new Promise((resolve, reject) => {
        const request = https.request(
            target,
            {
                method: options.method || "GET",
                cert: config.cert,
                key: config.key,
                ca: config.ca,
                timeout: PAYZU_CARD_REQUEST_TIMEOUT_MS,
                headers: {
                    accept: "application/json",
                    ...(options.authorization
                        ? { Authorization: options.authorization }
                        : {}),
                    ...(body
                        ? {
                              "Content-Type": "application/json",
                              "Content-Length": String(Buffer.byteLength(body)),
                          }
                        : {}),
                },
            },
            (response) => {
                const chunks: Buffer[] = [];
                response.on("data", (chunk) =>
                    chunks.push(
                        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
                    )
                );
                response.on("error", reject);
                response.on("end", () => {
                    const status = response.statusCode ?? 500;
                    resolve({
                        status,
                        data: parseJson(Buffer.concat(chunks).toString("utf8")),
                    });
                });
            }
        );

        request.on("timeout", () => {
            request.destroy(
                new Error("Tempo limite excedido ao chamar o PayZu Cartão.")
            );
        });
        request.on("error", reject);
        if (body) request.write(body);
        request.end();
    });
}

async function getAccessToken(forceRefresh = false): Promise<string> {
    if (
        !forceRefresh &&
        tokenCache &&
        tokenCache.expiresAt > Date.now() + 60_000
    ) {
        return tokenCache.token;
    }

    const config = getCardConfig();
    const basic = Buffer.from(
        `${config.clientId}:${config.clientSecret}`
    ).toString("base64");
    const response = await rawCardRequest("/token", {
        method: "POST",
        authorization: `Basic ${basic}`,
        body: JSON.stringify({ grant_type: "client_credentials" }),
    });

    if (response.status < 200 || response.status >= 300) {
        throw new PayZuCardApiError(
            cardErrorMessage(response.data as PayZuCardErrorPayload | null),
            response.status
        );
    }

    const payload = response.data as PayZuCardTokenResponse;
    if (!payload.access_token) {
        throw new PayZuCardApiError(
            "O PayZu não retornou o token de autenticação do cartão.",
            502
        );
    }

    tokenCache = {
        token: payload.access_token,
        expiresAt:
            Date.now() + Math.max(60, Number(payload.expires_in) || 3600) * 1000,
    };
    return payload.access_token;
}

async function cardRequest<T>(
    path: string,
    options: { method?: string; body?: string } = {},
    retryAuth = true
): Promise<T> {
    const token = await getAccessToken();
    const response = await rawCardRequest(path, {
        ...options,
        authorization: `Bearer ${token}`,
    });

    if (response.status === 401 && retryAuth) {
        tokenCache = null;
        await getAccessToken(true);
        return cardRequest<T>(path, options, false);
    }

    if (response.status < 200 || response.status >= 300) {
        throw new PayZuCardApiError(
            cardErrorMessage(response.data as PayZuCardErrorPayload | null),
            response.status
        );
    }

    return response.data as T;
}

export async function createPayZuCardRecurringCharge(input: {
    amountCents: number;
    externalId: string;
    customerName: string;
    postbackUrl: string;
    card: PayZuCardInput;
}): Promise<PayZuCardCharge> {
    return cardRequest<PayZuCardCharge>("/charges", {
        method: "POST",
        body: JSON.stringify({
            amount: input.amountCents,
            externalId: input.externalId,
            postbackUrl: input.postbackUrl,
            paymentType: "creditcard",
            customer: {
                name: input.customerName,
            },
            cart: [
                {
                    name: "iMenu QR Code Mesa",
                    quantity: 1,
                    sku: "IMENU-QR-MESA",
                    unitPrice: input.amountCents,
                },
            ],
            creditCardPayment: {
                installments: 1,
                authenticate: false,
                card: {
                    number: input.card.number.replace(/\D/g, ""),
                    holder: input.card.holder.trim(),
                    expiration: input.card.expiration.trim(),
                    cvv: input.card.cvv.replace(/\D/g, ""),
                },
            },
            recurrence: {
                interval: "Monthly",
            },
        }),
    });
}

export async function getPayZuCardCharge(
    chargeId: string
): Promise<PayZuCardCharge> {
    return cardRequest<PayZuCardCharge>(
        `/charges/${encodeURIComponent(chargeId)}`
    );
}

export async function deactivatePayZuCardRecurrence(
    recurrenceId: string
): Promise<void> {
    await cardRequest(
        `/charges/recurrences/${encodeURIComponent(recurrenceId)}/deactivate`,
        { method: "PUT" }
    );
}

export function verifyPayZuCardWebhookSignature(
    rawBody: string,
    headers: Headers
): boolean {
    const secret = process.env.PAYZU_CARD_WEBHOOK_SECRET?.trim() || "";
    const timestamp = headers.get("x-webhook-timestamp")?.trim() || "";
    const nonce = headers.get("x-webhook-nonce")?.trim() || "";
    const signature = headers.get("x-webhook-signature")?.trim() || "";

    if (
        !secret ||
        !timestamp ||
        !nonce ||
        !/^[0-9a-f]{64}$/i.test(signature)
    ) {
        return false;
    }

    const timestampMs = Number(timestamp);
    if (
        !Number.isFinite(timestampMs) ||
        Math.abs(Date.now() - timestampMs) > WEBHOOK_TOLERANCE_MS
    ) {
        return false;
    }

    const expected = createHmac("sha256", secret)
        .update(`${timestamp}.${nonce}.${rawBody}`)
        .digest("hex");

    return timingSafeEqual(
        Buffer.from(expected, "hex"),
        Buffer.from(signature, "hex")
    );
}
