import { randomUUID } from "node:crypto";
import * as https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";
import { asaasRequest } from "@/lib/services/asaas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const PAYZU_BASE_URL = "https://api.payzu.processamento.com/v1";
const PAYZU_REQUEST_TIMEOUT_MS = 10_000;
const PAYZU_TEST_AMOUNT_CENTS = 100;
const PAYZU_RESERVE_CENTS = 100;
const MAX_CREATE_ATTEMPTS = 4;
const RESTAURANT_TEST_AMOUNT_CENTS = 100;

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";
type PayZuPixType = "cpf" | "cnpj" | "phone" | "email" | "evp";

type RestaurantRow = {
    id: string;
    name: string | null;
    payment_info: string | null;
    payment_info_type: PixKeyType | null;
};

type AsaasTransfer = {
    id?: string;
    status?: string;
    failReason?: string | null;
};

type PayZuBalance = {
    balanceAvailable?: number | string;
};

type PayZuWithdrawal = {
    id?: string;
    status?: string;
    clientReference?: string | null;
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

function inferPixKeyType(value: string | null): PixKeyType | null {
    const raw = String(value || "").trim();
    if (!raw) return null;

    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(raw)) {
        return "EVP";
    }
    if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(raw)) return "EMAIL";
    if (/^\d{2}\.\d{3}\.\d{3}\/\d{4}-\d{2}$/.test(raw)) return "CNPJ";
    if (/^\d{3}\.\d{3}\.\d{3}-\d{2}$/.test(raw)) return "CPF";
    if (/^\+55\D*\d{2}\D*\d{8,9}$/.test(raw) || /^\(\d{2}\)\s*\d{4,5}-?\d{4}$/.test(raw)) {
        return "PHONE";
    }

    const digits = raw.replace(/\D/g, "");
    if (digits.length === 14) return "CNPJ";
    if (digits.length === 13 && digits.startsWith("55")) return "PHONE";
    return null;
}

function normalizePixKey(value: string, type: PixKeyType): string {
    const raw = value.trim();
    if (type === "EMAIL" || type === "EVP") return raw;

    let digits = raw.replace(/\D/g, "");
    if (type === "PHONE" && digits.length === 13 && digits.startsWith("55")) {
        digits = digits.slice(2);
    }
    return digits;
}

function resolvePixKeyType(row: RestaurantRow): PixKeyType | null {
    return row.payment_info_type || inferPixKeyType(row.payment_info);
}

async function getAsaasBalanceCents(): Promise<number> {
    const payload = await asaasRequest<{ balance?: number }>("/finance/balance");
    const balance = Number(payload.balance);
    if (!Number.isFinite(balance)) {
        throw new Error("Saldo inválido retornado pelo Asaas.");
    }
    return Math.round(balance * 100);
}

function getPayZuToken(): string {
    const token = process.env.PAYZU_TOKEN?.trim();
    if (!token) throw new Error("PAYZU_TOKEN não configurado.");
    return token;
}

function getFixieUrl(): string {
    const fixieUrl = process.env.FIXIE_URL?.trim();
    if (!fixieUrl) throw new Error("FIXIE_URL não configurado para o saque PayZu de teste.");
    return fixieUrl;
}

function getPayZuDestination(): { pixKey: string; pixType: PayZuPixType } {
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

async function getPayZuAvailableBalanceCents(): Promise<number> {
    const balance = await payzuRequest<PayZuBalance>("/user/balance", {
        method: "GET",
    });
    const available = Number(balance.balanceAvailable);

    if (!Number.isFinite(available) || available < 0) {
        throw new Error("Saldo disponível inválido retornado pela PayZu.");
    }

    return Math.round(available * 100);
}

async function createPayZuTestWithdrawal(input: {
    pixKey: string;
    pixType: PayZuPixType;
    clientReference: string;
}): Promise<PayZuWithdrawal> {
    const payload = {
        amount: PAYZU_TEST_AMOUNT_CENTS / 100,
        pixKey: input.pixKey,
        pixType: input.pixType,
        clientReference: input.clientReference,
        description: "Teste PayZu para Asaas - iMenu",
    };

    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_CREATE_ATTEMPTS; attempt += 1) {
        try {
            const existing = await getExistingWithdrawal(input.clientReference);
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
                const existing = await getExistingWithdrawal(input.clientReference);
                if (existing) return existing;
            } catch {
                // Best-effort reconciliation before retrying the same reference.
            }
        }

        if (attempt < MAX_CREATE_ATTEMPTS - 1) {
            await sleep(500 * 2 ** attempt);
        }
    }

    if (lastError instanceof Error) throw lastError;
    throw new Error("Não foi possível criar a transferência de teste PayZu.");
}

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    try {
        const { rows } = await query<RestaurantRow>(
            `
            SELECT id, name, payment_info, payment_info_type
            FROM public.restaurants
            WHERE payment_info IS NOT NULL
              AND BTRIM(payment_info) <> ''
            ORDER BY COALESCE(name, 'Restaurante') ASC
            `
        );

        return NextResponse.json({
            restaurants: rows
                .filter((row) => Boolean(resolvePixKeyType(row)))
                .map((row) => ({
                    id: row.id,
                    name: row.name || "Restaurante",
                    pixKeyType: resolvePixKeyType(row),
                })),
        });
    } catch (error) {
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro interno." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    let body: { action?: unknown; restaurantId?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    if (body.action === "payzu_to_asaas") {
        const clientReference = `imenu-test-payzu-asaas-${randomUUID()}`;

        try {
            const balanceBeforeCents = await getPayZuAvailableBalanceCents();
            if (
                balanceBeforeCents <
                PAYZU_TEST_AMOUNT_CENTS + PAYZU_RESERVE_CENTS
            ) {
                return NextResponse.json(
                    {
                        error: "Saldo PayZu insuficiente para enviar R$ 1,00 e manter R$ 1,00 de reserva.",
                        balanceBeforeCents,
                    },
                    { status: 409 }
                );
            }

            const destination = getPayZuDestination();
            await payzuRequest(
                `/user/dict?key=${encodeURIComponent(destination.pixKey)}`,
                { method: "GET" }
            );

            const withdrawal = await createPayZuTestWithdrawal({
                pixKey: destination.pixKey,
                pixType: destination.pixType,
                clientReference,
            });

            return NextResponse.json({
                success: true,
                action: "payzu_to_asaas",
                amountCents: PAYZU_TEST_AMOUNT_CENTS,
                balanceBeforeCents,
                transactionId: withdrawal.id || null,
                transactionStatus: withdrawal.status || null,
            });
        } catch (error) {
            const requestId =
                error instanceof PayZuRequestError ? error.requestId : undefined;
            return NextResponse.json(
                {
                    error: error instanceof Error ? error.message : "Erro interno.",
                    ...(requestId ? { requestId } : {}),
                },
                { status: 500 }
            );
        }
    }

    if (body.action === "restaurant") {
        const restaurantId = String(body.restaurantId || "").trim();
        if (!restaurantId) {
            return NextResponse.json(
                { error: "Selecione um restaurante." },
                { status: 400 }
            );
        }

        try {
            const { rows } = await query<RestaurantRow>(
                `
                SELECT id, name, payment_info, payment_info_type
                FROM public.restaurants
                WHERE id = $1
                LIMIT 1
                `,
                [restaurantId]
            );
            const restaurant = rows[0];
            if (!restaurant) {
                return NextResponse.json(
                    { error: "Restaurante não encontrado." },
                    { status: 404 }
                );
            }

            const keyType = resolvePixKeyType(restaurant);
            if (!restaurant.payment_info || !keyType) {
                return NextResponse.json(
                    { error: "O restaurante não possui uma chave PIX válida." },
                    { status: 409 }
                );
            }

            const balanceCents = await getAsaasBalanceCents();
            if (balanceCents < RESTAURANT_TEST_AMOUNT_CENTS) {
                return NextResponse.json(
                    {
                        error: "Saldo Asaas insuficiente para o teste de R$ 1,00.",
                        balanceCents,
                    },
                    { status: 409 }
                );
            }

            const transfer = await asaasRequest<AsaasTransfer>("/transfers", {
                method: "POST",
                body: JSON.stringify({
                    value: RESTAURANT_TEST_AMOUNT_CENTS / 100,
                    operationType: "PIX",
                    pixAddressKey: normalizePixKey(
                        restaurant.payment_info,
                        keyType
                    ),
                    pixAddressKeyType: keyType,
                    description: `Teste repasse iMenu - ${restaurant.name || "Restaurante"}`.slice(0, 140),
                    externalReference: `imenu-payout-test-${randomUUID()}`,
                }),
            });

            if (transfer.status === "CANCELLED") {
                return NextResponse.json(
                    {
                        error:
                            transfer.failReason ||
                            "Transferência de teste cancelada pelo Asaas.",
                    },
                    { status: 409 }
                );
            }

            return NextResponse.json({
                success: true,
                action: "restaurant",
                amountCents: RESTAURANT_TEST_AMOUNT_CENTS,
                restaurantId: restaurant.id,
                restaurantName: restaurant.name || "Restaurante",
                transactionId: transfer.id || null,
                transactionStatus: transfer.status || null,
            });
        } catch (error) {
            return NextResponse.json(
                { error: error instanceof Error ? error.message : "Erro interno." },
                { status: 500 }
            );
        }
    }

    return NextResponse.json({ error: "Ação inválida." }, { status: 400 });
}