import * as https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";

import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const ASAAS_BASE_URL = (
    process.env.ASAAS_API_BASE_URL?.trim() || "https://api.asaas.com/v3"
).replace(/\/+$/, "");
const ASAAS_REQUEST_TIMEOUT_MS = 10_000;

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

type PayableRestaurant = {
    restaurant_id: string;
    restaurant_name: string;
    payment_info: string | null;
    payment_info_type: PixKeyType | null;
    gross_cents: number | string;
    pix_order_count: number | string;
};

type AsaasTransfer = {
    id?: string;
    status?: string;
    externalReference?: string | null;
    failReason?: string | null;
};

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

function getAsaasApiKey(): string | null {
    return process.env.ASAAS_API_KEY?.trim() || null;
}

function getFixieUrl(): string {
    const fixieUrl = process.env.FIXIE_URL?.trim();
    if (!fixieUrl) throw new Error("FIXIE_URL não configurado para os repasses Asaas.");
    return fixieUrl;
}

function parseJsonText(text: string): any {
    if (!text) return {};

    try {
        return JSON.parse(text);
    } catch {
        return { error: text };
    }
}

async function asaasRequest<T>(
    path: string,
    init: { method?: "GET" | "POST"; body?: string } = {}
): Promise<T> {
    const apiKey = getAsaasApiKey();
    if (!apiKey) throw new Error("ASAAS_API_KEY não configurada.");

    const target = new URL(`${ASAAS_BASE_URL}${path}`);
    const agent = new HttpsProxyAgent(getFixieUrl());

    return new Promise((resolve, reject) => {
        const request = https.request(
            target,
            {
                method: init.method || "GET",
                agent,
                headers: {
                    accept: "application/json",
                    access_token: apiKey,
                    ...(init.body
                        ? {
                              "content-type": "application/json",
                              "content-length": Buffer.byteLength(init.body),
                          }
                        : {}),
                },
                timeout: ASAAS_REQUEST_TIMEOUT_MS,
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
                    const payload = parseJsonText(
                        Buffer.concat(chunks).toString("utf8")
                    );

                    if (status < 200 || status >= 300) {
                        const message =
                            payload?.errors?.[0]?.description ||
                            payload?.error ||
                            `Asaas retornou HTTP ${status}.`;
                        reject(new Error(message));
                        return;
                    }

                    resolve(payload as T);
                });
            }
        );

        request.on("timeout", () => {
            request.destroy(new Error("Tempo limite excedido ao chamar Asaas."));
        });
        request.on("error", reject);
        if (init.body) request.write(init.body);
        request.end();
    });
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

function resolvePixKeyType(row: PayableRestaurant): PixKeyType | null {
    return row.payment_info_type || inferPixKeyType(row.payment_info);
}

async function getPayables(cutoffAt: Date): Promise<PayableRestaurant[]> {
    const { rows } = await query<PayableRestaurant>(
        `
        WITH last_payout AS (
            SELECT restaurant_id, MAX(created_at) AS last_created_at
            FROM public.payouts
            GROUP BY restaurant_id
        )
        SELECT
            r.id AS restaurant_id,
            COALESCE(r.name, 'Restaurante') AS restaurant_name,
            r.payment_info,
            r.payment_info_type,
            COALESCE(SUM(o.total_cents), 0)::bigint AS gross_cents,
            COUNT(*)::bigint AS pix_order_count
        FROM public.restaurants r
        LEFT JOIN last_payout lp ON lp.restaurant_id = r.id
        JOIN public.orders o
          ON o.restaurant_id = r.id
         AND o.payment_method = 'pix'
         AND o.payment_ref IS NOT NULL
         AND o.status IN ('paid', 'preparing', 'delivering', 'done')
         AND o.created_at > COALESCE(lp.last_created_at, '-infinity'::timestamptz)
         AND o.created_at <= $1
        GROUP BY r.id, r.name, r.payment_info, r.payment_info_type
        HAVING COALESCE(SUM(o.total_cents), 0) > 0
        ORDER BY gross_cents DESC, restaurant_name ASC
        `,
        [cutoffAt.toISOString()]
    );

    return rows;
}

async function getAsaasBalance(): Promise<number> {
    const payload = await asaasRequest<{ balance?: number }>("/finance/balance");
    const value = Number(payload.balance);
    if (!Number.isFinite(value)) throw new Error("Saldo inválido retornado pelo Asaas.");
    return Math.round(value * 100);
}

async function listRecentTransfers(fromDate: string): Promise<AsaasTransfer[]> {
    const transfers: AsaasTransfer[] = [];
    let offset = 0;

    for (let page = 0; page < 10; page += 1) {
        const params = new URLSearchParams({
            "dateCreated[ge]": fromDate,
            limit: "100",
            offset: String(offset),
        });
        const payload = await asaasRequest<{
            data?: AsaasTransfer[];
            hasMore?: boolean;
        }>(`/transfers?${params.toString()}`);

        transfers.push(...(Array.isArray(payload.data) ? payload.data : []));
        if (!payload.hasMore) break;
        offset += 100;
    }

    return transfers;
}

async function reconcileProcessingPayouts(): Promise<void> {
    if (!getAsaasApiKey()) return;

    const { rows } = await query<{ id: string; created_at: string | Date }>(
        `
        SELECT id, created_at
        FROM public.payouts
        WHERE status = 'processing'
        ORDER BY created_at ASC
        LIMIT 200
        `
    );
    if (rows.length === 0) return;

    const oldest = new Date(rows[0].created_at);
    oldest.setDate(oldest.getDate() - 1);
    const fromDate = oldest.toISOString().slice(0, 10);
    const transfers = await listRecentTransfers(fromDate);
    const byReference = new Map(
        transfers
            .filter((transfer) => transfer.externalReference)
            .map((transfer) => [transfer.externalReference as string, transfer])
    );

    for (const payout of rows) {
        const transfer = byReference.get(`imenu-payout-${payout.id}`);
        if (!transfer?.status) continue;

        if (transfer.status === "DONE") {
            await query(
                `UPDATE public.payouts SET status = 'paid', paid_at = NOW() WHERE id = $1 AND status = 'processing'`,
                [payout.id]
            );
        } else if (transfer.status === "CANCELLED") {
            await query(
                `UPDATE public.payouts SET status = 'cancelled' WHERE id = $1 AND status = 'processing'`,
                [payout.id]
            );
        }
    }
}

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    try {
        await reconcileProcessingPayouts();
        const now = new Date();
        const [payables, historyResult] = await Promise.all([
            getPayables(now),
            query<{
                id: string;
                restaurant_id: string;
                restaurant_name: string;
                amount_cents: number;
                gross_cents: number | null;
                payzu_fee_cents: number | null;
                discount_cents: number | null;
                status: string;
                created_at: string | Date;
                paid_at: string | Date | null;
            }>(
                `
                SELECT
                    p.id,
                    p.restaurant_id,
                    COALESCE(r.name, 'Restaurante') AS restaurant_name,
                    p.amount_cents,
                    p.gross_cents,
                    p.payzu_fee_cents,
                    p.discount_cents,
                    p.status,
                    p.created_at,
                    p.paid_at
                FROM public.payouts p
                JOIN public.restaurants r ON r.id = p.restaurant_id
                ORDER BY p.created_at DESC
                LIMIT 100
                `
            ),
        ]);

        let asaasBalanceCents: number | null = null;
        let asaasError: string | null = null;
        if (getAsaasApiKey()) {
            try {
                asaasBalanceCents = await getAsaasBalance();
            } catch (error) {
                asaasError = error instanceof Error ? error.message : "Erro ao consultar Asaas.";
            }
        }

        return NextResponse.json({
            asaasConfigured: Boolean(getAsaasApiKey()),
            asaasBalanceCents,
            asaasError,
            generatedAt: now.toISOString(),
            payables: payables.map((row) => ({
                restaurantId: row.restaurant_id,
                restaurantName: row.restaurant_name,
                grossCents: Number(row.gross_cents) || 0,
                payzuFeeCents: (Number(row.pix_order_count) || 0) * 10,
                pixKey: row.payment_info,
                pixKeyType: resolvePixKeyType(row),
                pixKeyTypeStored: row.payment_info_type,
                canSend: Boolean(row.payment_info && resolvePixKeyType(row)),
            })),
            history: historyResult.rows.map((row) => ({
                ...row,
                amount_cents: Number(row.amount_cents) || 0,
                gross_cents: row.gross_cents == null ? null : Number(row.gross_cents),
                payzu_fee_cents:
                    row.payzu_fee_cents == null ? null : Number(row.payzu_fee_cents),
                discount_cents:
                    row.discount_cents == null ? null : Number(row.discount_cents),
            })),
        });
    } catch (error) {
        console.error("[DEV PAYOUT] Falha ao carregar:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro interno." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    if (!getAsaasApiKey()) {
        return NextResponse.json(
            { error: "ASAAS_API_KEY não configurada." },
            { status: 503 }
        );
    }

    let body: {
        discountPercent?: unknown;
        adjustToOnePercent?: unknown;
        amounts?: unknown;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const adjustToOnePercent = body.adjustToOnePercent === true;
    const discountPercent = Number(body.discountPercent ?? 0.75);
    const amountOverrides =
        body.amounts &&
        typeof body.amounts === "object" &&
        !Array.isArray(body.amounts)
            ? (body.amounts as Record<string, unknown>)
            : {};

    if (
        !adjustToOnePercent &&
        (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100)
    ) {
        return NextResponse.json(
            { error: "A porcentagem deve estar entre 0 e 100." },
            { status: 400 }
        );
    }

    const cutoffAt = new Date();

    try {
        await reconcileProcessingPayouts();
        const payables = await getPayables(cutoffAt);
        const ambiguous = payables.filter(
            (row) => row.payment_info && !resolvePixKeyType(row)
        );
        if (ambiguous.length > 0) {
            return NextResponse.json(
                {
                    error: "Existem chaves PIX cadastradas com tipo ambíguo. Defina o tipo antes de enviar.",
                    blocked: ambiguous.map((row) => ({
                        restaurantId: row.restaurant_id,
                        restaurantName: row.restaurant_name,
                    })),
                },
                { status: 409 }
            );
        }

        const sendable = payables
            .filter((row) => row.payment_info && resolvePixKeyType(row))
            .map((row) => {
                const grossCents = Number(row.gross_cents) || 0;
                const payzuFeeCents = (Number(row.pix_order_count) || 0) * 10;
                const totalDiscountCents = adjustToOnePercent
                    ? Math.round(grossCents * 0.01)
                    : Math.round(grossCents * (discountPercent / 100));
                const discountCents = totalDiscountCents - payzuFeeCents;
                const calculatedNetCents = Math.max(
                    0,
                    grossCents - payzuFeeCents - discountCents
                );
                const requestedAmount = amountOverrides[row.restaurant_id];
                const netCents =
                    requestedAmount === undefined
                        ? calculatedNetCents
                        : Math.round(Number(requestedAmount));

                return {
                    row,
                    grossCents,
                    discountCents,
                    payzuFeeCents,
                    netCents,
                };
            });

        const invalidAmount = sendable.find(
            (item) =>
                !Number.isFinite(item.netCents) ||
                item.netCents <= 0 ||
                item.netCents > item.grossCents
        );
        if (invalidAmount) {
            return NextResponse.json(
                {
                    error: `Valor de repasse inválido para ${invalidAmount.row.restaurant_name}.`,
                },
                { status: 400 }
            );
        }

        if (sendable.length === 0) {
            return NextResponse.json(
                { error: "Nenhum restaurante com valor e chave PIX válidos para pagar." },
                { status: 400 }
            );
        }

        const totalNetCents = sendable.reduce((sum, item) => sum + item.netCents, 0);
        const balanceCents = await getAsaasBalance();
        if (balanceCents < totalNetCents) {
            return NextResponse.json(
                {
                    error: "Saldo Asaas insuficiente para enviar todos os repasses.",
                    balanceCents,
                    requiredCents: totalNetCents,
                },
                { status: 409 }
            );
        }

        const results: Array<{
            restaurantId: string;
            restaurantName: string;
            amountCents: number;
            status: "paid" | "processing" | "failed";
            message?: string;
        }> = [];

        for (const item of sendable) {
            const keyType = resolvePixKeyType(item.row)!;
            const pixKey = normalizePixKey(item.row.payment_info!, keyType);

            const payoutInsert = await query<{ id: string }>(
                `
                INSERT INTO public.payouts (
                    restaurant_id,
                    amount_cents,
                    gross_cents,
                    payzu_fee_cents,
                    discount_cents,
                    pix_address_key,
                    status,
                    created_at,
                    paid_at
                )
                VALUES ($1, $2, $3, $4, $5, $6, 'processing', $7, NULL)
                RETURNING id
                `,
                [
                    item.row.restaurant_id,
                    item.netCents,
                    item.grossCents,
                    item.payzuFeeCents,
                    item.discountCents,
                    pixKey,
                    cutoffAt.toISOString(),
                ]
            );
            const payoutId = payoutInsert.rows[0]?.id;
            if (!payoutId) {
                results.push({
                    restaurantId: item.row.restaurant_id,
                    restaurantName: item.row.restaurant_name,
                    amountCents: item.netCents,
                    status: "failed",
                    message: "Não foi possível reservar o repasse no banco.",
                });
                continue;
            }

            try {
                const transfer = await asaasRequest<AsaasTransfer>("/transfers", {
                    method: "POST",
                    body: JSON.stringify({
                        value: item.netCents / 100,
                        operationType: "PIX",
                        pixAddressKey: pixKey,
                        pixAddressKeyType: keyType,
                        description: `Repasse iMenu - ${item.row.restaurant_name}`.slice(0, 140),
                        externalReference: `imenu-payout-${payoutId}`,
                    }),
                });

                if (transfer.status === "CANCELLED") {
                    await query(
                        `UPDATE public.payouts SET status = 'cancelled' WHERE id = $1 AND status = 'processing'`,
                        [payoutId]
                    );
                    results.push({
                        restaurantId: item.row.restaurant_id,
                        restaurantName: item.row.restaurant_name,
                        amountCents: item.netCents,
                        status: "failed",
                        message: transfer.failReason || "Transferência cancelada pelo Asaas.",
                    });
                    continue;
                }

                if (transfer.status === "DONE") {
                    await query(
                        `UPDATE public.payouts SET status = 'paid', paid_at = NOW() WHERE id = $1`,
                        [payoutId]
                    );
                    results.push({
                        restaurantId: item.row.restaurant_id,
                        restaurantName: item.row.restaurant_name,
                        amountCents: item.netCents,
                        status: "paid",
                    });
                } else {
                    results.push({
                        restaurantId: item.row.restaurant_id,
                        restaurantName: item.row.restaurant_name,
                        amountCents: item.netCents,
                        status: "processing",
                        message: "Transferência aceita e aguardando confirmação do Asaas.",
                    });
                }
            } catch (error) {
                const message = error instanceof Error ? error.message : "Falha ao enviar PIX.";
                const isNetworkFailure = /fetch|network|socket|timeout|ECONN|UND_ERR/i.test(message);

                if (!isNetworkFailure) {
                    await query(
                        `UPDATE public.payouts SET status = 'failed' WHERE id = $1 AND status = 'processing'`,
                        [payoutId]
                    );
                }

                results.push({
                    restaurantId: item.row.restaurant_id,
                    restaurantName: item.row.restaurant_name,
                    amountCents: item.netCents,
                    status: isNetworkFailure ? "processing" : "failed",
                    message,
                });
            }
        }

        const paidCount = results.filter((item) => item.status === "paid").length;
        const processingCount = results.filter((item) => item.status === "processing").length;
        const failedCount = results.filter((item) => item.status === "failed").length;

        return NextResponse.json({
            cutoffAt: cutoffAt.toISOString(),
            discountPercent,
            adjustToOnePercent,
            paidCount,
            processingCount,
            failedCount,
            results,
        });
    } catch (error) {
        console.error("[DEV PAYOUT] Falha ao enviar:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro interno." },
            { status: 500 }
        );
    }
}
