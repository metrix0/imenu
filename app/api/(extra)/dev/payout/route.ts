import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const ASAAS_BASE_URL = (
    process.env.ASAAS_API_BASE_URL?.trim() || "https://api.asaas.com/v3"
).replace(/\/+$/, "");

type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

type PayableRestaurant = {
    restaurant_id: string;
    restaurant_name: string;
    payment_info: string | null;
    payment_info_type: PixKeyType | null;
    gross_cents: number | string;
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

async function asaasRequest<T>(
    path: string,
    init: RequestInit = {}
): Promise<T> {
    const apiKey = getAsaasApiKey();
    if (!apiKey) throw new Error("ASAAS_API_KEY não configurada.");

    const response = await fetch(`${ASAAS_BASE_URL}${path}`, {
        ...init,
        headers: {
            accept: "application/json",
            access_token: apiKey,
            ...(init.body ? { "content-type": "application/json" } : {}),
            ...(init.headers || {}),
        },
        cache: "no-store",
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
        const message =
            payload?.errors?.[0]?.description ||
            payload?.error ||
            `Asaas retornou HTTP ${response.status}.`;
        throw new Error(message);
    }

    return payload as T;
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

    // 11 raw digits can be either CPF or phone, so never guess.
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
            COALESCE(SUM(o.total_cents), 0)::bigint AS gross_cents
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
                `DELETE FROM public.payouts WHERE id = $1 AND status = 'processing'`,
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
                pixKey: row.payment_info,
                pixKeyType: resolvePixKeyType(row),
                pixKeyTypeStored: row.payment_info_type,
                canSend: Boolean(row.payment_info && resolvePixKeyType(row)),
            })),
            history: historyResult.rows.map((row) => ({
                ...row,
                amount_cents: Number(row.amount_cents) || 0,
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

    let body: { discountPercent?: unknown };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const discountPercent = Number(body.discountPercent ?? 0.75);
    if (!Number.isFinite(discountPercent) || discountPercent < 0 || discountPercent > 100) {
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
                const discountCents = Math.round(grossCents * (discountPercent / 100));
                return {
                    row,
                    grossCents,
                    discountCents,
                    netCents: Math.max(0, grossCents - discountCents),
                };
            })
            .filter((item) => item.netCents > 0);

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
                    status,
                    created_at,
                    paid_at
                )
                VALUES ($1, $2, 'processing', $3, NULL)
                RETURNING id
                `,
                [item.row.restaurant_id, item.netCents, cutoffAt.toISOString()]
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
                        `DELETE FROM public.payouts WHERE id = $1 AND status = 'processing'`,
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
                // A resposta de erro HTTP é definitiva e não representa transferência aceita.
                // Se for uma falha de rede desconhecida, manter 'processing' evita pagamento duplicado;
                // a próxima abertura do painel tenta reconciliar pelo externalReference.
                const message = error instanceof Error ? error.message : "Falha ao enviar PIX.";
                const isNetworkFailure = /fetch|network|socket|timeout|ECONN|UND_ERR/i.test(message);

                if (!isNetworkFailure) {
                    await query(
                        `DELETE FROM public.payouts WHERE id = $1 AND status = 'processing'`,
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
