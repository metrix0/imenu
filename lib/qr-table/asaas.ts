import * as https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";

import { selectFixieUrl } from "@/lib/fixie";

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

const ASAAS_REQUEST_TIMEOUT_MS = 10_000;

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

function getFixieUrl(selectionKey: string): string {
    const fixieUrl = selectFixieUrl(selectionKey);
    if (!fixieUrl) {
        throw new AsaasApiError(
            "A conexão do iMenu QR Code Mesa com o Asaas ainda não foi configurada.",
            503
        );
    }
    return fixieUrl;
}

export async function asaasRequest<T>(
    path: string,
    init: RequestInit = {},
    timeoutMs = ASAAS_REQUEST_TIMEOUT_MS
): Promise<T> {
    const target = new URL(`${getAsaasBaseUrl()}${path}`);
    const body = typeof init.body === "string" ? init.body : undefined;
    const agent = new HttpsProxyAgent(getFixieUrl(`${path}:${body ?? ""}`));
    const headers: Record<string, string> = {
        accept: "application/json",
        access_token: getAsaasApiKey(),
        "user-agent": "iMenu/1.0",
        ...(body
            ? {
                  "content-type": "application/json",
                  "content-length": String(Buffer.byteLength(body)),
              }
            : {}),
    };

    if (init.headers) {
        new Headers(init.headers).forEach((value, key) => {
            headers[key] = value;
        });
    }

    return new Promise<T>((resolve, reject) => {
        const request = https.request(
            target,
            {
                method: init.method || "GET",
                agent,
                headers,
                timeout: timeoutMs,
            },
            (response) => {
                const chunks: Buffer[] = [];

                response.on("data", (chunk) => {
                    chunks.push(
                        Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
                    );
                });
                response.on("error", reject);
                response.on("end", () => {
                    const status = response.statusCode ?? 500;
                    const text = Buffer.concat(chunks).toString("utf8");
                    let payload: unknown = null;

                    if (text) {
                        try {
                            payload = JSON.parse(text);
                        } catch {
                            payload = null;
                        }
                    }

                    if (status < 200 || status >= 300) {
                        const errorPayload = payload as AsaasErrorPayload | null;
                        const message =
                            errorPayload?.errors?.[0]?.description ||
                            "Não foi possível concluir a operação no Asaas.";
                        reject(new AsaasApiError(message, status));
                        return;
                    }

                    if (status === 204) {
                        resolve(undefined as T);
                        return;
                    }

                    if (payload === null) {
                        reject(
                            new AsaasApiError(
                                "O Asaas retornou uma resposta inválida.",
                                status
                            )
                        );
                        return;
                    }

                    resolve(payload as T);
                });
            }
        );

        request.on("timeout", () => {
            request.destroy(
                new Error("Tempo limite excedido ao chamar o Asaas.")
            );
        });
        request.on("error", reject);
        if (body) request.write(body);
        request.end();
    });
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
