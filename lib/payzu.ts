const PAYZU_BASE_URL = "https://api.payzu.processamento.com/v1";
const PAYZU_REQUEST_TIMEOUT_MS = 10_000;

export type PayZuTransaction = {
    id: string;
    status: string;
    amount: number | string;
    type?: string | null;
    method?: string | null;
    qrCodeText?: string | null;
    qrCodeBase64?: string | null;
    qrCodeUrl?: string | null;
    clientReference?: string | null;
    refundStatus?: string | null;
    refundAmount?: number | string | null;
    cancellationReason?: string | null;
};

export class PayZuApiError extends Error {
    status: number;
    requestId?: string;

    constructor(message: string, status: number, requestId?: string) {
        super(message);
        this.name = "PayZuApiError";
        this.status = status;
        this.requestId = requestId;
    }
}

function getPayZuToken(): string {
    const token = process.env.PAYZU_TOKEN?.trim();

    if (!token) {
        throw new PayZuApiError("PayZu não configurado.", 500);
    }

    return token;
}

async function parseJson(response: Response): Promise<any> {
    const text = await response.text();
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

async function requestPayZu(
    path: string,
    init: RequestInit = {}
): Promise<{ response: Response; data: any }> {
    const controller = new AbortController();
    const timeout = setTimeout(
        () => controller.abort(),
        PAYZU_REQUEST_TIMEOUT_MS
    );

    try {
        const response = await fetch(`${PAYZU_BASE_URL}${path}`, {
            ...init,
            headers: {
                Authorization: `Bearer ${getPayZuToken()}`,
                ...(init.body ? { "Content-Type": "application/json" } : {}),
                ...(init.headers || {}),
            },
            cache: "no-store",
            signal: controller.signal,
        });

        return {
            response,
            data: await parseJson(response),
        };
    } finally {
        clearTimeout(timeout);
    }
}

function errorFromResponse(response: Response, data: any): PayZuApiError {
    const requestId = data?.requestId ? String(data.requestId) : undefined;
    const message =
        typeof data?.message === "string" && data.message.trim()
            ? data.message
            : `PayZu respondeu com HTTP ${response.status}.`;

    return new PayZuApiError(message, response.status, requestId);
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isPayZuPaymentRef(value: unknown): boolean {
    return /^PAYZU/i.test(String(value ?? "").trim());
}

export async function getPayZuPixCharge(params: {
    id?: string;
    clientReference?: string;
}): Promise<PayZuTransaction | null> {
    const search = new URLSearchParams();

    if (params.id) search.set("id", params.id);
    if (params.clientReference) {
        search.set("clientReference", params.clientReference);
    }

    if (!search.size) {
        throw new Error("PayZu charge lookup requires an identifier.");
    }

    const { response, data } = await requestPayZu(
        `/pix?${search.toString()}`,
        { method: "GET" }
    );

    if (response.status === 404) return null;
    if (!response.ok) throw errorFromResponse(response, data);

    return data as PayZuTransaction;
}

export async function createPayZuPixCharge(input: {
    amount: number;
    callbackUrl: string;
    clientReference: string;
}): Promise<PayZuTransaction> {
    const payload = {
        amount: input.amount,
        callbackUrl: input.callbackUrl,
        clientReference: input.clientReference,
        expiresIn: 86_400,
    };

    let lastError: unknown = null;

    for (let attempt = 0; attempt < 4; attempt += 1) {
        try {
            const { response, data } = await requestPayZu("/pix", {
                method: "POST",
                body: JSON.stringify(payload),
            });

            if (response.ok) {
                return data as PayZuTransaction;
            }

            if (response.status === 409) {
                const existing = await getPayZuPixCharge({
                    clientReference: input.clientReference,
                });
                if (existing) return existing;
            }

            const responseError = errorFromResponse(response, data);
            lastError = responseError;

            if (response.status !== 429 && response.status < 500) {
                throw responseError;
            }
        } catch (error) {
            lastError = error;

            if (
                error instanceof PayZuApiError &&
                error.status !== 429 &&
                error.status < 500
            ) {
                throw error;
            }

            try {
                const existing = await getPayZuPixCharge({
                    clientReference: input.clientReference,
                });
                if (existing) return existing;
            } catch {
                // The lookup is best-effort; retry the idempotent creation below.
            }
        }

        if (attempt < 3) {
            await sleep(500 * 2 ** attempt);
        }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error("Não foi possível gerar o Pix.");
}

export async function refundPayZuPixCharge(input: {
    transactionId: string;
    clientReference: string;
}): Promise<PayZuTransaction> {
    const { response, data } = await requestPayZu(
        `/refund/${encodeURIComponent(input.transactionId)}`,
        {
            method: "POST",
            body: JSON.stringify({
                description: "Estorno solicitado pelo restaurante no iMenu",
                clientReference: input.clientReference,
            }),
        }
    );

    if (!response.ok) throw errorFromResponse(response, data);

    return data as PayZuTransaction;
}
