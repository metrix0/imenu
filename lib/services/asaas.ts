type AsaasErrorPayload = {
    errors?: Array<{ description?: string }>;
};

export class AsaasApiError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "AsaasApiError";
        this.status = status;
    }
}

function getAsaasBaseUrl(): string {
    return (
        process.env.ASAAS_API_BASE_URL?.trim() ||
        "https://api.asaas.com/v3"
    ).replace(/\/+$/, "");
}

function getAsaasApiKey(): string {
    const apiKey = process.env.ASAAS_API_KEY?.trim();
    if (!apiKey) {
        throw new AsaasApiError(
            "A cobrança do iMenu QR Code Mesa ainda não foi configurada.",
            503
        );
    }
    return apiKey;
}

export async function asaasRequest<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
    const response = await fetch(`${getAsaasBaseUrl()}${path}`, {
        ...init,
        headers: {
            accept: "application/json",
            access_token: getAsaasApiKey(),
            ...(init.body ? { "Content-Type": "application/json" } : {}),
            ...init.headers,
        },
        cache: "no-store",
    });

    if (!response.ok) {
        const payload = (await response
            .json()
            .catch(() => null)) as AsaasErrorPayload | null;
        const message =
            payload?.errors?.[0]?.description ||
            "Não foi possível concluir a operação no Asaas.";
        throw new AsaasApiError(message, response.status);
    }

    if (response.status === 204) return undefined as T;
    return (await response.json()) as T;
}

export function buildAsaasCheckoutUrl(checkoutId: string): string {
    const host = getAsaasBaseUrl().includes("api-sandbox.asaas.com")
        ? "https://sandbox.asaas.com"
        : "https://asaas.com";

    return `${host}/checkoutSession/show?id=${encodeURIComponent(checkoutId)}`;
}

export function formatAsaasDate(date: Date): string {
    return date.toISOString().slice(0, 10);
}
