import * as https from "node:https";
import { HttpsProxyAgent } from "https-proxy-agent";

import { query } from "@/lib/database/sql";
import { calculateOnePercentPayout } from "@/lib/services/payoutSafety";

const ASAAS_BASE_URL = (
    process.env.ASAAS_API_BASE_URL?.trim() || "https://api.asaas.com/v3"
).replace(/\/+$/, "");
const ASAAS_REQUEST_TIMEOUT_MS = 10_000;

export type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

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

export type PayoutPlanItem = {
    row: PayableRestaurant;
    grossCents: number;
    discountCents: number;
    payzuFeeCents: number;
    netCents: number;
    orderCount: number;
};

export type PayoutPlan = {
    cutoffAt: Date;
    payables: PayableRestaurant[];
    ambiguous: PayableRestaurant[];
    sendable: PayoutPlanItem[];
    grossCents: number;
    payzuFeeCents: number;
    discountCents: number;
    totalNetCents: number;
};

export type SendPayoutResult = {
    cutoffAt: string;
    discountPercent: number;
    adjustToOnePercent: boolean;
    paidCount: number;
    processingCount: number;
    failedCount: number;
    results: Array<{
        restaurantId: string;
        restaurantName: string;
        amountCents: number;
        status: "paid" | "processing" | "failed";
        message?: string;
    }>;
};

export class PayoutValidationError extends Error {
    status: number;
    details: Record<string, unknown>;

    constructor(
        message: string,
        status: number,
        details: Record<string, unknown> = {}
    ) {
        super(message);
        this.name = "PayoutValidationError";
        this.status = status;
        this.details = details;
    }
}

export function getAsaasApiKey(): string | null {
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
                    "user-agent": "iMenu/1.0",
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

export async function getAsaasBalance(): Promise<number> {
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

async function syncAutomationRuns(): Promise<void> {
    await query(
        `
        WITH counts AS (
            SELECT
                automation_run_id,
                COUNT(*) FILTER (WHERE status = 'paid')::integer AS paid_count,
                COUNT(*) FILTER (WHERE status = 'processing')::integer AS processing_count,
                COUNT(*) FILTER (WHERE status NOT IN ('paid', 'processing'))::integer AS failed_count
            FROM public.payouts
            WHERE automation_run_id IS NOT NULL
            GROUP BY automation_run_id
        )
        UPDATE public.payout_automation_runs run
        SET
            paid_count = counts.paid_count,
            processing_count = counts.processing_count,
            failed_count = counts.failed_count,
            payout_step_status = CASE
                WHEN counts.processing_count > 0 THEN 'processing'
                WHEN counts.failed_count > 0 THEN 'failed'
                ELSE 'completed'
            END,
            status = CASE
                WHEN counts.processing_count > 0 THEN 'processing'
                WHEN counts.failed_count > 0 AND counts.paid_count > 0 THEN 'partial'
                WHEN counts.failed_count > 0 THEN 'failed'
                ELSE 'completed'
            END,
            finished_at = CASE
                WHEN counts.processing_count = 0 THEN COALESCE(run.finished_at, NOW())
                ELSE NULL
            END,
            updated_at = NOW()
        FROM counts
        WHERE run.id = counts.automation_run_id
          AND run.comparison_step_status = 'completed'
        `
    );
}

export async function reconcileProcessingPayouts(): Promise<void> {
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

    if (rows.length > 0) {
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
                    `UPDATE public.payouts SET status = 'paid', paid_at = NOW(), asaas_transfer_id = COALESCE(asaas_transfer_id, $2) WHERE id = $1 AND status = 'processing'`,
                    [payout.id, transfer.id || null]
                );
            } else if (["CANCELLED", "FAILED", "REFUSED"].includes(transfer.status)) {
                await query(
                    `UPDATE public.payouts SET status = 'cancelled', asaas_transfer_id = COALESCE(asaas_transfer_id, $2) WHERE id = $1 AND status = 'processing'`,
                    [payout.id, transfer.id || null]
                );
            }
        }
    }

    await syncAutomationRuns();
}

export async function createPayoutPlan(input: {
    cutoffAt: Date;
    discountPercent?: number;
    adjustToOnePercent: boolean;
    amountOverrides?: Record<string, unknown>;
}): Promise<PayoutPlan> {
    const discountPercent = input.discountPercent ?? 0.75;
    const amountOverrides = input.amountOverrides || {};
    const payables = await getPayables(input.cutoffAt);
    const ambiguous = payables.filter(
        (row) => row.payment_info && !resolvePixKeyType(row)
    );
    const sendable = payables
        .filter((row) => row.payment_info && resolvePixKeyType(row))
        .map((row) => {
            const grossCents = Number(row.gross_cents) || 0;
            const orderCount = Number(row.pix_order_count) || 0;
            const onePercentValues = calculateOnePercentPayout(
                grossCents,
                orderCount
            );
            const payzuFeeCents = onePercentValues.payzuFeeCents;
            const discountCents = input.adjustToOnePercent
                ? onePercentValues.discountCents
                : Math.round(grossCents * (discountPercent / 100)) -
                  payzuFeeCents;
            const calculatedNetCents = input.adjustToOnePercent
                ? onePercentValues.netCents
                : Math.max(
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
                orderCount,
            };
        });

    return {
        cutoffAt: input.cutoffAt,
        payables,
        ambiguous,
        sendable,
        grossCents: sendable.reduce((sum, item) => sum + item.grossCents, 0),
        payzuFeeCents: sendable.reduce((sum, item) => sum + item.payzuFeeCents, 0),
        discountCents: sendable.reduce((sum, item) => sum + item.discountCents, 0),
        totalNetCents: sendable.reduce((sum, item) => sum + item.netCents, 0),
    };
}

export async function sendPayouts(input: {
    cutoffAt: Date;
    discountPercent: number;
    adjustToOnePercent: boolean;
    amountOverrides?: Record<string, unknown>;
    automationRunId?: string | null;
    expectedTotalCents?: number | null;
}): Promise<SendPayoutResult> {
    if (!getAsaasApiKey()) {
        throw new PayoutValidationError("ASAAS_API_KEY não configurada.", 503);
    }

    if (
        !input.adjustToOnePercent &&
        (!Number.isFinite(input.discountPercent) ||
            input.discountPercent < 0 ||
            input.discountPercent > 100)
    ) {
        throw new PayoutValidationError(
            "A porcentagem deve estar entre 0 e 100.",
            400
        );
    }

    await reconcileProcessingPayouts();
    const plan = await createPayoutPlan({
        cutoffAt: input.cutoffAt,
        discountPercent: input.discountPercent,
        adjustToOnePercent: input.adjustToOnePercent,
        amountOverrides: input.amountOverrides,
    });

    if (plan.ambiguous.length > 0) {
        throw new PayoutValidationError(
            "Existem chaves PIX cadastradas com tipo ambíguo. Defina o tipo antes de enviar.",
            409,
            {
                blocked: plan.ambiguous.map((row) => ({
                    restaurantId: row.restaurant_id,
                    restaurantName: row.restaurant_name,
                })),
            }
        );
    }

    const invalidAmount = plan.sendable.find(
        (item) =>
            !Number.isFinite(item.netCents) ||
            item.netCents <= 0 ||
            item.netCents > item.grossCents
    );
    if (invalidAmount) {
        throw new PayoutValidationError(
            `Valor de repasse inválido para ${invalidAmount.row.restaurant_name}.`,
            400
        );
    }

    if (plan.sendable.length === 0) {
        throw new PayoutValidationError(
            "Nenhum restaurante com valor e chave PIX válidos para pagar.",
            400
        );
    }

    if (
        input.expectedTotalCents != null &&
        plan.totalNetCents !== input.expectedTotalCents
    ) {
        throw new PayoutValidationError(
            "Os valores mudaram depois da comparação de segurança. Nenhum repasse foi enviado.",
            409,
            {
                expectedCents: input.expectedTotalCents,
                currentCents: plan.totalNetCents,
            }
        );
    }

    const balanceCents = await getAsaasBalance();
    if (balanceCents < plan.totalNetCents) {
        throw new PayoutValidationError(
            "Saldo Asaas insuficiente para enviar todos os repasses.",
            409,
            {
                balanceCents,
                requiredCents: plan.totalNetCents,
            }
        );
    }

    const results: SendPayoutResult["results"] = [];

    for (const item of plan.sendable) {
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
                paid_at,
                order_count,
                automation_run_id
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'processing', $7, NULL, $8, $9)
            ON CONFLICT (automation_run_id, restaurant_id)
                WHERE automation_run_id IS NOT NULL
                DO NOTHING
            RETURNING id
            `,
            [
                item.row.restaurant_id,
                item.netCents,
                item.grossCents,
                item.payzuFeeCents,
                item.discountCents,
                pixKey,
                input.cutoffAt.toISOString(),
                item.orderCount,
                input.automationRunId || null,
            ]
        );
        let payoutId = payoutInsert.rows[0]?.id;

        if (!payoutId && input.automationRunId) {
            const existing = await query<{ id: string; status: string }>(
                `SELECT id, status FROM public.payouts WHERE automation_run_id = $1 AND restaurant_id = $2 LIMIT 1`,
                [input.automationRunId, item.row.restaurant_id]
            );
            const row = existing.rows[0];
            if (row) {
                results.push({
                    restaurantId: item.row.restaurant_id,
                    restaurantName: item.row.restaurant_name,
                    amountCents: item.netCents,
                    status:
                        row.status === "paid"
                            ? "paid"
                            : row.status === "processing"
                              ? "processing"
                              : "failed",
                    message: "Repasse já registrado nesta execução.",
                });
                continue;
            }
        }

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

            if (["CANCELLED", "FAILED", "REFUSED"].includes(transfer.status || "")) {
                await query(
                    `UPDATE public.payouts SET status = 'cancelled', asaas_transfer_id = $2 WHERE id = $1 AND status = 'processing'`,
                    [payoutId, transfer.id || null]
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
                    `UPDATE public.payouts SET status = 'paid', paid_at = NOW(), asaas_transfer_id = $2 WHERE id = $1`,
                    [payoutId, transfer.id || null]
                );
                results.push({
                    restaurantId: item.row.restaurant_id,
                    restaurantName: item.row.restaurant_name,
                    amountCents: item.netCents,
                    status: "paid",
                });
            } else {
                await query(
                    `UPDATE public.payouts SET asaas_transfer_id = $2 WHERE id = $1`,
                    [payoutId, transfer.id || null]
                );
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

    if (input.automationRunId) await syncAutomationRuns();

    return {
        cutoffAt: input.cutoffAt.toISOString(),
        discountPercent: input.discountPercent,
        adjustToOnePercent: input.adjustToOnePercent,
        paidCount,
        processingCount,
        failedCount,
        results,
    };
}

export async function getPayoutDashboardData() {
    await reconcileProcessingPayouts();
    const now = new Date();
    const [payables, historyResult, automationResult] = await Promise.all([
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
        query(
            `
            SELECT *
            FROM public.payout_automation_runs
            ORDER BY run_date DESC, started_at DESC
            LIMIT 90
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

    return {
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
        automationRuns: automationResult.rows,
    };
}
