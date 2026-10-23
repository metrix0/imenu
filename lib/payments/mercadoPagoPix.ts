const MERCADO_PAGO_API_BASE_URL = "https://api.mercadopago.com";
const MERCADO_PAGO_REQUEST_TIMEOUT_MS = 10_000;
const MERCADO_PAGO_MAX_ATTEMPTS = 4;

export type MercadoPagoPixPayment = {
    id: string;
    status: string;
    amount: number;
    externalReference: string | null;
    paymentMethodId: string | null;
    paidAt: string | null;
    feeCents: number | null;
    qrCodeText: string | null;
    qrCodeBase64: string | null;
    qrCodeUrl: string | null;
};

type MercadoPagoPaymentResponse = {
    id?: string | number;
    fee_details?: Array<{ amount?: number; fee_payer?: string }>;
    status?: string;
    transaction_amount?: number;
    external_reference?: string | null;
    date_approved?: string | null;
    payment_method_id?: string | null;
    point_of_interaction?: {
        transaction_data?: {
            qr_code?: string | null;
            qr_code_base64?: string | null;
            ticket_url?: string | null;
        } | null;
    } | null;
};

type MercadoPagoPaymentSearchResponse = {
    results?: MercadoPagoPaymentResponse[];
};

export class MercadoPagoPixApiError extends Error {
    status: number;
    code: string | null;

    constructor(message: string, status = 500, code: string | null = null) {
        super(message);
        this.name = "MercadoPagoPixApiError";
        this.status = status;
        this.code = code;
    }
}

function getAccessToken(): string {
    const token = process.env.MERCADO_PAGO_ACCESS_TOKEN?.trim();
    if (!token) {
        throw new MercadoPagoPixApiError(
            "MERCADO_PAGO_ACCESS_TOKEN não configurado.",
            503
        );
    }
    return token;
}

function normalizePayment(
    payment: MercadoPagoPaymentResponse
): MercadoPagoPixPayment | null {
    if (payment.id === undefined || payment.id === null) return null;

    const transactionData =
        payment.point_of_interaction?.transaction_data || null;

    return {
        id: String(payment.id),
        status: String(payment.status || "pending"),
        amount: Number(payment.transaction_amount) || 0,
        externalReference: payment.external_reference
            ? String(payment.external_reference)
            : null,
        paymentMethodId: payment.payment_method_id
            ? String(payment.payment_method_id)
            : null,
        paidAt: payment.date_approved || null,
        feeCents: Array.isArray(payment.fee_details) && payment.fee_details.every(
            fee => Number.isFinite(fee.amount) && Number(fee.amount) >= 0 && ["collector", "payer"].includes(fee.fee_payer || "")
        ) ? payment.fee_details.reduce((sum, fee) => sum + (fee.fee_payer === "collector" ? Math.round(Number(fee.amount) * 100) : 0), 0) : null,
        qrCodeText: transactionData?.qr_code || null,
        qrCodeBase64: transactionData?.qr_code_base64 || null,
        qrCodeUrl: transactionData?.ticket_url || null,
    };
}

function errorMessage(payload: any, status: number): {
    message: string;
    code: string | null;
} {
    const code =
        typeof payload?.error === "string"
            ? payload.error
            : typeof payload?.code === "string"
              ? payload.code
              : null;
    const message =
        payload?.message ||
        payload?.cause?.[0]?.description ||
        payload?.cause?.[0]?.code ||
        code ||
        `Mercado Pago retornou HTTP ${status}.`;

    return { message: String(message), code };
}

async function mercadoPagoRequest<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = MERCADO_PAGO_REQUEST_TIMEOUT_MS
): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
        const response = await fetch(`${MERCADO_PAGO_API_BASE_URL}${path}`, {
            ...init,
            headers: {
                accept: "application/json",
                Authorization: `Bearer ${getAccessToken()}`,
                ...(init.body ? { "content-type": "application/json" } : {}),
                ...(init.headers || {}),
            },
            cache: "no-store",
            signal: controller.signal,
        });

        const text = await response.text();
        let payload: any = {};
        if (text) {
            try {
                payload = JSON.parse(text);
            } catch {
                payload = { message: text };
            }
        }

        if (!response.ok) {
            const parsed = errorMessage(payload, response.status);
            throw new MercadoPagoPixApiError(
                parsed.message,
                response.status,
                parsed.code
            );
        }

        return payload as T;
    } catch (error) {
        if (error instanceof MercadoPagoPixApiError) throw error;

        if (error instanceof Error && error.name === "AbortError") {
            throw new MercadoPagoPixApiError(
                "Tempo limite excedido ao chamar o Mercado Pago.",
                504
            );
        }

        throw new MercadoPagoPixApiError(
            error instanceof Error
                ? error.message
                : "Falha de rede ao chamar o Mercado Pago.",
            502
        );
    } finally {
        clearTimeout(timeout);
    }
}

export async function getMercadoPagoPixPayment(input: {
    id: string;
}): Promise<MercadoPagoPixPayment | null> {
    const payload = await mercadoPagoRequest<MercadoPagoPaymentResponse>(
        `/v1/payments/${encodeURIComponent(input.id)}`
    );
    return normalizePayment(payload);
}

async function findMercadoPagoPixPaymentByReference(
    externalReference: string
): Promise<MercadoPagoPixPayment | null> {
    const params = new URLSearchParams({
        external_reference: externalReference,
        sort: "date_created",
        criteria: "desc",
        limit: "20",
    });
    const payload = await mercadoPagoRequest<MercadoPagoPaymentSearchResponse>(
        `/v1/payments/search?${params.toString()}`
    );

    const exact = (payload.results || []).find(
        (payment) =>
            String(payment.external_reference || "") === externalReference &&
            String(payment.payment_method_id || "").toLowerCase() === "pix"
    );

    return exact ? normalizePayment(exact) : null;
}

export async function createMercadoPagoPixCharge(input: {
    amount: number;
    notificationUrl: string;
    externalReference: string;
    payerName?: string | null;
    payerEmail?: string | null;
    idempotencyKey: string;
}): Promise<MercadoPagoPixPayment> {
    const body = JSON.stringify({
        transaction_amount: input.amount,
        description: `iMenu ${input.externalReference}`.slice(0, 255),
        payment_method_id: "pix",
        external_reference: input.externalReference,
        notification_url: input.notificationUrl,
        payer: {
            email:
                input.payerEmail ||
                `cliente_${input.externalReference.replace(
                    /[^a-zA-Z0-9]/g,
                    ""
                )}@fake.com`,
            ...(input.payerName?.trim()
                ? { first_name: input.payerName.trim().slice(0, 100) }
                : {}),
        },
    });

    let lastError: unknown = null;

    for (let attempt = 1; attempt <= MERCADO_PAGO_MAX_ATTEMPTS; attempt += 1) {
        try {
            const payload =
                await mercadoPagoRequest<MercadoPagoPaymentResponse>(
                    "/v1/payments",
                    {
                        method: "POST",
                        headers: {
                            "X-Idempotency-Key": input.idempotencyKey,
                        },
                        body,
                    }
                );
            const payment = normalizePayment(payload);

            if (
                !payment ||
                !payment.id ||
                payment.externalReference !== input.externalReference ||
                payment.paymentMethodId !== "pix" ||
                Math.round(payment.amount * 100) !== Math.round(input.amount * 100)
            ) {
                throw new MercadoPagoPixApiError(
                    "O Mercado Pago retornou uma cobrança Pix inválida.",
                    502
                );
            }

            return payment;
        } catch (error) {
            lastError = error;

            try {
                const existing =
                    await findMercadoPagoPixPaymentByReference(
                        input.externalReference
                    );
                if (existing && existing.paymentMethodId === "pix" && Math.round(existing.amount * 100) === Math.round(input.amount * 100)) return existing;
            } catch (lookupError) {
                console.error(
                    "[MERCADO_PAGO_PIX] Falha ao reconciliar criação:",
                    lookupError
                );
            }

            const retryable =
                error instanceof MercadoPagoPixApiError &&
                (error.status === 409 ||
                    error.status === 429 ||
                    error.status >= 500);

            if (!retryable || attempt === MERCADO_PAGO_MAX_ATTEMPTS) {
                throw error;
            }

            await new Promise((resolve) =>
                setTimeout(resolve, 250 * attempt)
            );
        }
    }

    throw lastError instanceof Error
        ? lastError
        : new MercadoPagoPixApiError(
              "Não foi possível criar a cobrança Pix.",
              502
          );
}

export function isMercadoPagoPixFailureStatus(status: string): boolean {
    return [
        "rejected",
        "cancelled",
        "canceled",
        "refunded",
        "charged_back",
        "expired",
    ].includes(String(status || "").toLowerCase());
}
