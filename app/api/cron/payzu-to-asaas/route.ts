import { randomUUID } from "node:crypto";
import * as https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const PAYZU_BASE_URL = "https://api.payzu.processamento.com/v1";
const PAYZU_REQUEST_TIMEOUT_MS = 10_000;
const RESERVE_CENTS = 100;
const MAX_CREATE_ATTEMPTS = 4;

type PayZuPixType = "cpf" | "cnpj" | "phone" | "email" | "evp";

type PayZuBalance = {
    balanceAvailable?: number | string;
    balanceBlocked?: number | string;
};

type PayZuWithdrawal = {
    id?: string;
    status?: string;
    amount?: number | string;
    clientReference?: string | null;
    serviceFeeCharged?: number | string | null;
};

class PayZuRequestError extends Error {
    status: number;
    requestId?: string;

    constructor(message: string, status: number, requestId?: string) {
        super(message);
        this.name = "PayZuRequestError";
        this.status = status;
        this.requestId = requestId;
    }
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function getBearerToken(request: Request): string | null {
    const authorization = request.headers.get("authorization")?.trim();
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

function getSupabasePublicConfig(): { url: string; anonKey: string } {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim();
    const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) {
        throw new Error("Supabase public environment variables are missing.");
    }

    return { url, anonKey };
}

async function authorize(request: Request): Promise<NextResponse | null> {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { url, anonKey } = getSupabasePublicConfig();
    const authClient = createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    const {
        data: { user },
        error,
    } = await authClient.auth.getUser(accessToken);

    if (error || !user) {
        return NextResponse.json(
            { error: "Sessão inválida ou expirada." },
            { status: 401 }
        );
    }

    if (user.email?.trim().toLowerCase() !== ALLOWED_DEV_EMAIL) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    return null;
}

function getPayZuToken(): string {
    const token = process.env.PAYZU_TOKEN?.trim();
    if (!token) throw new Error("PAYZU_TOKEN não configurado.");
    return token;
}

function getFixieUrl(): string {
    const fixieUrl = process.env.FIXIE_URL?.trim();
    if (!fixieUrl) throw new Error("FIXIE_URL não configurado para o saque PayZu.");
    return fixieUrl;
}

function getDestination(): { pixKey: string; pixType: PayZuPixType } {
    const pixKey = process.env.ASAAS_PIX_KEY?.trim();
    const rawType = process.env.ASAAS_PIX_KEY_TYPE?.trim().toLowerCase();

    if (!pixKey) throw new Error("ASAAS_PIX_KEY não configurada.");

    if (
        rawType !== "cpf" &&
        rawType !== "cnpj" &&
        rawType !== "phone" &&
        rawType !== "email" &&
        rawType !== "evp"
    ) {
        throw new Error("ASAAS_PIX_KEY_TYPE inválido.");
    }

    return { pixKey, pixType: rawType };
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

function parseJsonText(text: string): any {
    if (!text) return null;

    try {
        return JSON.parse(text);
    } catch {
        return { message: text };
    }
}

async function payzuRequest<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
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
                Accept: "application/json",
                ...(init.body ? { "Content-Type": "application/json" } : {}),
                ...(init.headers || {}),
            },
            cache: "no-store",
            signal: controller.signal,
        });

        const data = await parseJson(response);
        if (!response.ok) {
            const requestId = data?.requestId
                ? String(data.requestId)
                : undefined;
            const message =
                typeof data?.message === "string" && data.message.trim()
                    ? data.message
                    : `PayZu respondeu com HTTP ${response.status}.`;
            throw new PayZuRequestError(message, response.status, requestId);
        }

        return data as T;
    } finally {
        clearTimeout(timeout);
    }
}

async function payzuRequestThroughFixie<T>(
    path: string,
    init: { method: "GET" | "POST"; body?: string }
): Promise<T> {
    const target = new URL(`${PAYZU_BASE_URL}${path}`);
    const agent = new HttpsProxyAgent(getFixieUrl());

    return new Promise((resolve, reject) => {
        const request = https.request(
            target,
            {
                method: init.method,
                agent,
                headers: {
                    Authorization: `Bearer ${getPayZuToken()}`,
                    Accept: "application/json",
                    ...(init.body
                        ? {
                              "Content-Type": "application/json",
                              "Content-Length": Buffer.byteLength(init.body),
                          }
                        : {}),
                },
                timeout: PAYZU_REQUEST_TIMEOUT_MS,
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
                    const data = parseJsonText(
                        Buffer.concat(chunks).toString("utf8")
                    );

                    if (status < 200 || status >= 300) {
                        const requestId = data?.requestId
                            ? String(data.requestId)
                            : undefined;
                        const message =
                            typeof data?.message === "string" && data.message.trim()
                                ? data.message
                                : `PayZu respondeu com HTTP ${status}.`;
                        reject(new PayZuRequestError(message, status, requestId));
                        return;
                    }

                    resolve(data as T);
                });
            }
        );

        request.on("timeout", () => {
            request.destroy(new Error("Tempo limite excedido ao chamar PayZu."));
        });
        request.on("error", reject);
        if (init.body) request.write(init.body);
        request.end();
    });
}

async function getExistingWithdrawal(
    clientReference: string
): Promise<PayZuWithdrawal | null> {
    try {
        return await payzuRequestThroughFixie<PayZuWithdrawal>(
            `/withdraw?clientReference=${encodeURIComponent(clientReference)}`,
            { method: "GET" }
        );
    } catch (error) {
        if (error instanceof PayZuRequestError && error.status === 404) {
            return null;
        }
        throw error;
    }
}

async function getAvailableBalanceCents(): Promise<number> {
    const balance = await payzuRequest<PayZuBalance>("/user/balance", {
        method: "GET",
    });
    const available = Number(balance.balanceAvailable);

    if (!Number.isFinite(available) || available < 0) {
        throw new Error("Saldo disponível inválido retornado pela PayZu.");
    }

    return Math.round(available * 100);
}

async function validateDestinationPixKey(pixKey: string): Promise<void> {
    await payzuRequest(
        `/user/dict?key=${encodeURIComponent(pixKey)}`,
        { method: "GET" }
    );
}

async function createWithdrawal(input: {
    amountCents: number;
    pixKey: string;
    pixType: PayZuPixType;
    clientReference: string;
}): Promise<PayZuWithdrawal> {
    const payload = {
        amount: input.amountCents / 100,
        pixKey: input.pixKey,
        pixType: input.pixType,
        clientReference: input.clientReference,
        description: "Transferência PayZu para Asaas",
    };

    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
        try {
            const existing = await getExistingWithdrawal(
                input.clientReference
            );
            if (existing) return existing;

            return await payzuRequestThroughFixie<PayZuWithdrawal>("/withdraw", {
                method: "POST",
                body: JSON.stringify(payload),
            });
        } catch (error) {
            lastError = error;

            if (
                error instanceof PayZuRequestError &&
                error.status !== 409 &&
                error.status !== 429 &&
                error.status < 500
            ) {
                throw error;
            }

            try {
                const existing = await getExistingWithdrawal(
                    input.clientReference
                );
                if (existing) return existing;
            } catch {
                // Best-effort reconciliation before retrying the same idempotent reference.
            }
        }

        if (attempt < MAX_CREATE_ATTEMPTS - 1) {
            await sleep(500 * 2 ** attempt);
        }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error("Não foi possível criar a transferência PayZu.");
}

export async function POST(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    const clientReference = `imenu-payzu-asaas-${randomUUID()}`;

    try {
        const balanceBeforeCents = await getAvailableBalanceCents();
        const amountCents = balanceBeforeCents - RESERVE_CENTS;

        if (amountCents <= 0) {
            return NextResponse.json({
                success: true,
                skipped: true,
                reason: "reserve_only",
                clientReference,
                balanceBeforeCents,
                reserveCents: RESERVE_CENTS,
            });
        }

        const destination = getDestination();
        await validateDestinationPixKey(destination.pixKey);

        const withdrawal = await createWithdrawal({
            amountCents,
            pixKey: destination.pixKey,
            pixType: destination.pixType,
            clientReference,
        });

        console.log("[PAYZU_TO_ASAAS] Transferência criada", {
            clientReference,
            amountCents,
            transactionId: withdrawal.id || null,
            status: withdrawal.status || null,
        });

        return NextResponse.json({
            success: true,
            skipped: false,
            clientReference,
            amountCents,
            reserveCents: RESERVE_CENTS,
            balanceBeforeCents,
            transactionId: withdrawal.id || null,
            transactionStatus: withdrawal.status || null,
        });
    } catch (error) {
        const requestId =
            error instanceof PayZuRequestError ? error.requestId : undefined;
        const message =
            error instanceof Error ? error.message : "Erro interno.";

        console.error("[PAYZU_TO_ASAAS] Falha", {
            clientReference,
            message,
            requestId,
        });

        return NextResponse.json(
            {
                success: false,
                error: message,
                ...(requestId ? { requestId } : {}),
            },
            { status: 500 }
        );
    }
}
