import { alarmUnnotifiedPayoutFailures, notifyPayoutProblem } from "@/lib/services/payoutNotifications";
import { getMercadoPagoPixPayment } from "@/lib/payments/mercadoPagoPix";
import * as https from "node:https";

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
    provider_fee_cents: number;
    payments: Array<{ id: string; payment_ref: string; total_cents: number }>;

};

export type PayoutRestaurantError = {
    restaurantId: string;
    restaurantName: string;
    orderId: string;
    paymentRef: string;
    grossCents: number;
    message: string;
};

type VerifiedPayables = {
    payables: PayableRestaurant[];
    validationErrors: PayoutRestaurantError[];
};

type AsaasTransfer = {
    id?: string;
    status?: string;
    externalReference?: string | null;
    failReason?: string | null;
};

// A previous transfer must be definitively unsuccessful before a second Pix is attempted.
export function isAsaasTransferSafeToRetry(
    transfer: AsaasTransfer,
    expectedTransferId: string,
    payoutId: string
): boolean {
    return transfer.id === expectedTransferId &&
        ["CANCELLED", "FAILED", "REFUSED"].includes(transfer.status || "") &&
        (!transfer.externalReference || transfer.externalReference === `imenu-payout-${payoutId}`);
}

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
    validationErrors: PayoutRestaurantError[];
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
    validationErrors: PayoutRestaurantError[];
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

const PAYOUT_MARGIN_MINUTES = 90;

// Use a rolling margin instead of a fixed daily cutoff for confirmed Pix orders.
export function getPayoutCutoffAt(referenceAt: Date = new Date()): Date {
    return new Date(referenceAt.getTime() - PAYOUT_MARGIN_MINUTES * 60_000);
}

export function getAsaasApiKey(): string | null {
    return process.env.ASAAS_API_KEY?.trim() || null;
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

    return new Promise((resolve, reject) => {
        const request = https.request(
            target,
            {
                method: init.method || "GET",
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

function resolvePixKeyType(
    row: Pick<PayableRestaurant, "payment_info" | "payment_info_type">
): PixKeyType | null {
    return row.payment_info_type || inferPixKeyType(row.payment_info);
}

async function getPayables(
    cutoffAt: Date,
    options: { retryPayoutId?: string; restaurantId?: string } = {}
): Promise<VerifiedPayables> {
    const { rows } = await query<PayableRestaurant>(
        `
        WITH last_payout AS (
            SELECT restaurant_id, MAX(created_at) AS last_created_at
            FROM public.payouts
            WHERE ($2::uuid IS NULL OR (id <> $2::uuid AND created_at < $1::timestamptz))
            GROUP BY restaurant_id
        )
        SELECT
            r.id AS restaurant_id,
            COALESCE(r.name, 'Restaurante') AS restaurant_name,
            r.payment_info,
            r.payment_info_type,
            COALESCE(SUM(o.total_cents), 0)::bigint AS gross_cents,
            COUNT(*)::bigint AS pix_order_count,
            jsonb_agg(jsonb_build_object('id', o.id, 'payment_ref', o.payment_ref, 'total_cents', o.total_cents)) AS payments
        FROM public.restaurants r
        LEFT JOIN last_payout lp ON lp.restaurant_id = r.id
        JOIN public.orders o
          ON o.restaurant_id = r.id
         AND ($3::uuid IS NULL OR o.restaurant_id = $3::uuid)
         AND o.payment_method = 'pix'
         AND o.payment_ref IS NOT NULL
         AND o.status IN ('paid', 'preparing', 'delivering', 'done')
         AND GREATEST(o.created_at, COALESCE(o.payment_paid_at, o.created_at)) > COALESCE(lp.last_created_at, '-infinity'::timestamptz)
         AND GREATEST(o.created_at, COALESCE(o.payment_paid_at, o.created_at)) <= $1
        GROUP BY r.id, r.name, r.payment_info, r.payment_info_type
        HAVING COALESCE(SUM(o.total_cents), 0) > 0
        ORDER BY gross_cents DESC, restaurant_name ASC
        `,
        [cutoffAt.toISOString(), options.retryPayoutId || null, options.restaurantId || null]
    );

    // Exclude unverified orders, not all of a restaurant's verified sales.
    const payables: PayableRestaurant[] = [];
    const validationErrors: PayoutRestaurantError[] = [];
    for (const row of rows) {
        const verifiedPayments: PayableRestaurant["payments"] = [];
        let grossCents = 0;
        let feeCents = 0;
        for (let offset = 0; offset < row.payments.length; offset += 5) {
            const orders = row.payments.slice(offset, offset + 5);
            const fees = await Promise.allSettled(orders.map(async order => {
                if (!/^\d+$/.test(order.payment_ref)) {
                    throw new Error(`Pagamento ${order.payment_ref} não pertence ao Mercado Pago.`);
                }
                let payment;
                try {
                    payment = await getMercadoPagoPixPayment({ id: order.payment_ref });
                } catch (error) {
                    throw new Error(`Consulta Mercado Pago ${order.payment_ref}: ${error instanceof Error ? error.message : "erro desconhecido"}`);
                }
                if (!payment || payment.id !== order.payment_ref ||
                    payment.externalReference !== order.id ||
                    payment.paymentMethodId !== "pix" ||
                    Math.round(payment.amount * 100) !== Number(order.total_cents)) {
                    throw new Error(`Pagamento Mercado Pago ${order.payment_ref} não corresponde ao pedido.`);
                }
                if (payment.status !== "approved") {
                    throw new Error(`Pagamento Mercado Pago ${order.payment_ref} não aprovado (${payment.status}).`);
                }
                if (payment.feeCents === null) {
                    throw new Error(`Não foi possível confirmar a taxa do pagamento Mercado Pago ${order.payment_ref}.`);
                }
                return payment.feeCents;
            }));
            for (let index = 0; index < orders.length; index += 1) {
                const order = orders[index];
                const fee = fees[index];
                if (fee.status === "fulfilled") {
                    verifiedPayments.push(order);
                    grossCents += Number(order.total_cents);
                    feeCents += fee.value;
                } else {
                    validationErrors.push({
                        restaurantId: row.restaurant_id,
                        restaurantName: row.restaurant_name,
                        orderId: order.id,
                        paymentRef: order.payment_ref,
                        grossCents: Number(order.total_cents) || 0,
                        message: fee.reason instanceof Error ? fee.reason.message : "Não foi possível validar o pagamento.",
                    });
                }
            }
        }
        if (grossCents > 0) {
            payables.push({
                ...row,
                gross_cents: grossCents,
                pix_order_count: verifiedPayments.length,
                provider_fee_cents: feeCents,
                payments: verifiedPayments,
            });
        }
    }

    return { payables, validationErrors };
}

type WaitingPayableRestaurant = Pick<
    PayableRestaurant,
    "restaurant_id" | "restaurant_name" | "payment_info" | "payment_info_type"
> & {
    waiting_gross_cents: number | string;
    next_eligible_at: string;
};

async function getWaitingPayables(cutoffAt: Date): Promise<WaitingPayableRestaurant[]> {
    const { rows } = await query<WaitingPayableRestaurant>(
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
            SUM(o.total_cents)::bigint AS waiting_gross_cents,
            MIN(GREATEST(o.created_at, COALESCE(o.payment_paid_at, o.created_at)))
                + INTERVAL '90 minutes' AS next_eligible_at
        FROM public.restaurants r
        LEFT JOIN last_payout lp ON lp.restaurant_id = r.id
        JOIN public.orders o
          ON o.restaurant_id = r.id
         AND o.payment_method = 'pix'
         AND o.payment_ref IS NOT NULL
         AND o.status IN ('paid', 'preparing', 'delivering', 'done')
         AND GREATEST(o.created_at, COALESCE(o.payment_paid_at, o.created_at))
             > COALESCE(lp.last_created_at, '-infinity'::timestamptz)
         AND GREATEST(o.created_at, COALESCE(o.payment_paid_at, o.created_at)) > $1
        GROUP BY r.id, r.name, r.payment_info, r.payment_info_type
        HAVING SUM(o.total_cents) > 0
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
                WHEN run.error_message IS NOT NULL THEN 'partial'
                WHEN counts.paid_count < run.restaurant_count THEN 'partial'
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

export type FailedRecentPendingPayout = {
    id: string;
    restaurant_id: string;
    restaurant_name: string;
    amount_cents: number | string;
    created_at: string | Date;
};

export async function failRecentPendingPayouts(): Promise<
    FailedRecentPendingPayout[]
> {
    const { rows } = await query<FailedRecentPendingPayout>(
        `
        UPDATE public.payouts p
        SET status = 'failed'
        FROM public.restaurants r
        WHERE p.restaurant_id = r.id
          AND p.status = 'pending'
          AND p.created_at >= NOW() - INTERVAL '3 days'
        RETURNING
            p.id,
            p.restaurant_id,
            COALESCE(r.name, 'Restaurante') AS restaurant_name,
            p.amount_cents,
            p.created_at
        `
    );

    return rows;
}

export async function reconcileProcessingPayouts(): Promise<void> {
    if (!getAsaasApiKey()) return;

    const { rows } = await query<{ id: string; created_at: string | Date; asaas_transfer_id: string | null }>(
        `
        SELECT id, created_at, asaas_transfer_id
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
        const byReference = new Map<string, AsaasTransfer[]>();
        for (const transfer of transfers) {
            if (!transfer.externalReference) continue;
            const existing = byReference.get(transfer.externalReference) || [];
            existing.push(transfer);
            byReference.set(transfer.externalReference, existing);
        }

        for (const payout of rows) {
            const matches = byReference.get(`imenu-payout-${payout.id}`) || [];
            // A retried payout can have several Asaas transfers with the same externalReference.
            // Prefer its recorded transfer ID, never an older cancelled attempt.
            const transfer = matches.find((item) => payout.asaas_transfer_id && item.id === payout.asaas_transfer_id) ||
                matches.find((item) => !["CANCELLED", "FAILED", "REFUSED"].includes(item.status || "")) ||
                matches[0];
            if (!transfer?.status) continue;

            if (transfer.status === "DONE") {
                await query(
                    `UPDATE public.payouts SET status = 'paid', paid_at = NOW(), asaas_transfer_id = COALESCE(asaas_transfer_id, $2) WHERE id = $1 AND status = 'processing'`,
                    [payout.id, transfer.id || null]
                );
            } else if (["CANCELLED", "FAILED", "REFUSED"].includes(transfer.status)) {
                await query(
                    `UPDATE public.payouts SET status = 'cancelled', asaas_transfer_id = COALESCE(asaas_transfer_id, $2), failure_reason=$3 WHERE id = $1 AND status = 'processing'`,
                    [payout.id, transfer.id || null, transfer.failReason || 'Transferência cancelada pelo Asaas.']
                );
                const owner = await query<{ restaurant_id: string }>("SELECT restaurant_id FROM payouts WHERE id=$1", [payout.id]);
                if (owner.rows[0]) await notifyPayoutProblem(owner.rows[0].restaurant_id, false);
            }
        }
    }

    await syncAutomationRuns();

    await alarmUnnotifiedPayoutFailures();
}

export async function createPayoutPlan(input: {
    cutoffAt: Date;
    discountPercent?: number;
    adjustToOnePercent: boolean;
    amountOverrides?: Record<string, unknown>;
    restaurantIds?: string[];
}): Promise<PayoutPlan> {
    const discountPercent = input.discountPercent ?? 0.75;
    const amountOverrides = input.amountOverrides || {};
    const restaurantIds = input.restaurantIds
        ? new Set(input.restaurantIds)
        : null;
    const verified = await getPayables(input.cutoffAt);
    const payables = verified.payables.filter(
        (row) => !restaurantIds || restaurantIds.has(row.restaurant_id)
    );
    const validationErrors = verified.validationErrors.filter(
        (error) => !restaurantIds || restaurantIds.has(error.restaurantId)
    );
    const knownRestaurantIds = new Set([
        ...payables.map((row) => row.restaurant_id),
        ...validationErrors.map((error) => error.restaurantId),
    ]);
    if (restaurantIds && [...restaurantIds].some((id) => !knownRestaurantIds.has(id))) {
        throw new PayoutValidationError(
            "Um ou mais restaurantes ainda não têm pedidos elegíveis após a margem de 1h30. Atualize a lista.",
            409
        );
    }
    for (const row of payables) {
        if (!row.payment_info?.trim()) await notifyPayoutProblem(row.restaurant_id, true);
    }
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
                row.provider_fee_cents
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
        validationErrors,
        sendable,
        grossCents: sendable.reduce((sum, item) => sum + item.grossCents, 0),
        payzuFeeCents: sendable.reduce((sum, item) => sum + item.payzuFeeCents, 0),
        discountCents: sendable.reduce((sum, item) => sum + item.discountCents, 0),
        totalNetCents: sendable.reduce((sum, item) => sum + item.netCents, 0),
    };
}

async function sendPayoutTransfer(input: {
    payoutId: string;
    restaurantId: string;
    restaurantName: string;
    amountCents: number;
    pixKey: string;
    keyType: PixKeyType;
}): Promise<SendPayoutResult["results"][number]> {
    try {
        const transfer = await asaasRequest<AsaasTransfer>("/transfers", {
            method: "POST",
            body: JSON.stringify({
                value: input.amountCents / 100,
                operationType: "PIX",
                pixAddressKey: input.pixKey,
                pixAddressKeyType: input.keyType,
                description: `Repasse iMenu - ${input.restaurantName}`.slice(0, 140),
                externalReference: `imenu-payout-${input.payoutId}`,
            }),
        });

        if (["CANCELLED", "FAILED", "REFUSED"].includes(transfer.status || "")) {
            await query(
                `UPDATE public.payouts SET status = 'cancelled', asaas_transfer_id = $2, failure_reason=$3 WHERE id = $1 AND status = 'processing'`,
                [input.payoutId, transfer.id || null, transfer.failReason || 'Transferência cancelada pelo Asaas.']
            );
            await notifyPayoutProblem(input.restaurantId, false);
            return {
                restaurantId: input.restaurantId,
                restaurantName: input.restaurantName,
                amountCents: input.amountCents,
                status: "failed",
                message: transfer.failReason || "Transferência cancelada pelo Asaas.",
            };
        }

        if (transfer.status === "DONE") {
            await query(
                `UPDATE public.payouts SET status = 'paid', paid_at = NOW(), asaas_transfer_id = $2 WHERE id = $1`,
                [input.payoutId, transfer.id || null]
            );
            return {
                restaurantId: input.restaurantId,
                restaurantName: input.restaurantName,
                amountCents: input.amountCents,
                status: "paid",
            };
        }

        await query(
            `UPDATE public.payouts SET asaas_transfer_id = $2 WHERE id = $1`,
            [input.payoutId, transfer.id || null]
        );
        return {
            restaurantId: input.restaurantId,
            restaurantName: input.restaurantName,
            amountCents: input.amountCents,
            status: "processing",
            message: "Transferência aceita e aguardando confirmação do Asaas.",
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao enviar PIX.";
        const isNetworkFailure = /fetch|network|socket|timeout|ECONN|ETIMEDOUT|UND_ERR|tempo limite/i.test(message);

        if (!isNetworkFailure) {
            await query(
                `UPDATE public.payouts SET status = 'failed', failure_reason=$2 WHERE id = $1 AND status = 'processing'`,
                [input.payoutId, message.slice(0, 2000)]
            );
            await notifyPayoutProblem(input.restaurantId, false);
        }

        return {
            restaurantId: input.restaurantId,
            restaurantName: input.restaurantName,
            amountCents: input.amountCents,
            status: isNetworkFailure ? "processing" : "failed",
            message,
        };
    }
}

export async function sendPayouts(input: {
    cutoffAt: Date;
    discountPercent: number;
    adjustToOnePercent: boolean;
    amountOverrides?: Record<string, unknown>;
    restaurantIds?: string[];
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
        restaurantIds: input.restaurantIds,
    });

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

        results.push(
            await sendPayoutTransfer({
                payoutId,
                restaurantId: item.row.restaurant_id,
                restaurantName: item.row.restaurant_name,
                amountCents: item.netCents,
                pixKey,
                keyType,
            })
        );
    }

    const paidCount = results.filter((item) => item.status === "paid").length;
    const processingCount = results.filter((item) => item.status === "processing").length;
    const failedCount = results.filter((item) => item.status === "failed").length;

    if (input.automationRunId) await syncAutomationRuns();
    if (failedCount > 0) await alarmUnnotifiedPayoutFailures();

    return {
        cutoffAt: input.cutoffAt.toISOString(),
        discountPercent: input.discountPercent,
        adjustToOnePercent: input.adjustToOnePercent,
        paidCount,
        processingCount,
        failedCount,
        validationErrors: plan.validationErrors,
        results,
    };
}

export async function retryFailedPayout(
    payoutId: string
): Promise<SendPayoutResult> {
    if (!getAsaasApiKey()) {
        throw new PayoutValidationError("ASAAS_API_KEY não configurada.", 503);
    }

    await reconcileProcessingPayouts();

    const failed = await query<{
        id: string;
        restaurant_id: string;
        restaurant_name: string;
        amount_cents: number | string;
        gross_cents: number | string | null;
        payzu_fee_cents: number | string | null;
        order_count: number | string | null;
        created_at: string | Date;
        has_later_payout: boolean;
        automation_run_id: string | null;
        asaas_transfer_id: string | null;
        status: "failed" | "cancelled";
        payment_info: string | null;
        payment_info_type: PixKeyType | null;
    }>(
        `
        SELECT
            p.id,
            p.restaurant_id,
            COALESCE(r.name, 'Restaurante') AS restaurant_name,
            p.amount_cents,
            p.gross_cents,
            p.payzu_fee_cents,
            p.order_count,
            p.created_at,
            EXISTS (
                SELECT 1 FROM public.payouts newer
                WHERE newer.restaurant_id = p.restaurant_id
                  AND newer.id <> p.id
                  AND newer.created_at >= p.created_at
            ) AS has_later_payout,
            p.automation_run_id,
            p.asaas_transfer_id,
            p.status,
            r.payment_info,
            r.payment_info_type
        FROM public.payouts p
        JOIN public.restaurants r ON r.id = p.restaurant_id
        WHERE p.id = $1
          AND p.status IN ('failed', 'cancelled')
        LIMIT 1
        `,
        [payoutId]
    );
    const payout = failed.rows[0];
    if (!payout) {
        throw new PayoutValidationError(
            "Repasse com falha não encontrado ou já processado.",
            404
        );
    }
    if (payout.status === "cancelled" && !payout.asaas_transfer_id) {
        throw new PayoutValidationError(
            "O repasse cancelado não tem ID da transferência original para conferência no Asaas.",
            409
        );
    }
    if (payout.asaas_transfer_id) {
        let original: AsaasTransfer;
        try {
            original = await asaasRequest<AsaasTransfer>(
                `/transfers/${encodeURIComponent(payout.asaas_transfer_id)}`
            );
        } catch {
            throw new PayoutValidationError(
                "Não foi possível conferir a transferência anterior no Asaas. Reenvio bloqueado.",
                409
            );
        }
        if (!isAsaasTransferSafeToRetry(original, payout.asaas_transfer_id, payout.id)) {
            throw new PayoutValidationError(
                "A transferência anterior não consta como cancelada ou definitivamente falha no Asaas. Reenvio bloqueado.",
                409
            );
        }
    }

    const keyType = resolvePixKeyType(payout);
    if (!payout.payment_info || !keyType) {
        await notifyPayoutProblem(payout.restaurant_id, !payout.payment_info?.trim());
        throw new PayoutValidationError(
            "O restaurante não possui uma chave PIX válida para o reenvio.",
            400
        );
    }

    const amountCents = Number(payout.amount_cents) || 0;
    if (amountCents <= 0) {
        throw new PayoutValidationError("Valor de repasse inválido.", 400);
    }

    if (payout.has_later_payout) {
        throw new PayoutValidationError(
            "Há outro repasse posterior para este restaurante. Confira o histórico antes de reenviar.",
            409
        );
    }
    if (
        payout.gross_cents == null ||
        payout.payzu_fee_cents == null ||
        payout.order_count == null ||
        !Number.isSafeInteger(Number(payout.gross_cents)) ||
        !Number.isSafeInteger(Number(payout.payzu_fee_cents)) ||
        !Number.isSafeInteger(Number(payout.order_count)) ||
        Number(payout.gross_cents) <= 0 ||
        Number(payout.order_count) <= 0
    ) {
        throw new PayoutValidationError(
            "Este repasse não possui os dados originais necessários para revalidar os pagamentos.",
            409
        );
    }

    // Reconstruct the original batch, excluding the failed payout from the cutoff.
    const verified = await getPayables(new Date(payout.created_at), {
        retryPayoutId: payout.id,
        restaurantId: payout.restaurant_id,
    });
    const payable = verified.payables.find(
        (row) => row.restaurant_id === payout.restaurant_id
    );
    if (
        verified.validationErrors.length > 0 ||
        !payable ||
        Number(payable.gross_cents) !== Number(payout.gross_cents) ||
        Number(payable.pix_order_count) !== Number(payout.order_count) ||
        payable.provider_fee_cents !== Number(payout.payzu_fee_cents)
    ) {
        throw new PayoutValidationError(
            "Reenvio bloqueado: os pagamentos originais não estão todos aprovados no Mercado Pago ou os valores mudaram.",
            409,
            { validationErrors: verified.validationErrors }
        );
    }

    const balanceCents = await getAsaasBalance();
    if (balanceCents < amountCents) {
        throw new PayoutValidationError(
            "Saldo Asaas insuficiente para reenviar o repasse.",
            409,
            {
                balanceCents,
                requiredCents: amountCents,
            }
        );
    }

    const pixKey = normalizePixKey(payout.payment_info, keyType);
    const reset = await query<{ id: string }>(
        `
        UPDATE public.payouts
        SET
            status = 'processing',
            paid_at = NULL,
            failure_reason = NULL,
            asaas_transfer_id = NULL,
            pix_address_key = $2
        WHERE id = $1
          AND status IN ('failed','cancelled')
          AND asaas_transfer_id IS NOT DISTINCT FROM $3
        RETURNING id
        `,
        [payout.id, pixKey, payout.asaas_transfer_id]
    );
    if (!reset.rows[0]) {
        throw new PayoutValidationError(
            "O status do repasse mudou antes do reenvio. Atualize a página.",
            409
        );
    }

    const result = await sendPayoutTransfer({
        payoutId: payout.id,
        restaurantId: payout.restaurant_id,
        restaurantName: payout.restaurant_name,
        amountCents,
        pixKey,
        keyType,
    });

    if (payout.automation_run_id) await syncAutomationRuns();
    if (result.status === "failed") await alarmUnnotifiedPayoutFailures();

    return {
        cutoffAt: new Date().toISOString(),
        discountPercent: 0,
        adjustToOnePercent: false,
        paidCount: result.status === "paid" ? 1 : 0,
        processingCount: result.status === "processing" ? 1 : 0,
        failedCount: result.status === "failed" ? 1 : 0,
        validationErrors: [],
        results: [result],
    };
}

export async function getPayoutDashboardData(options: { readOnly?: boolean } = {}) {
    if (!options.readOnly) await reconcileProcessingPayouts();
    const now = new Date();
    const cutoffAt = getPayoutCutoffAt(now);
    const [verified, waitingPayables, historyResult, automationResult] = await Promise.all([
        getPayables(cutoffAt),
        getWaitingPayables(cutoffAt),
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
            SELECT
                run.*,
                paid.paid_profit_cents
            FROM public.payout_automation_runs run
            LEFT JOIN LATERAL (
                SELECT
                    COALESCE(
                        SUM(
                            p.gross_cents -
                            p.amount_cents -
                            COALESCE(p.payzu_fee_cents, 0)
                        ),
                        0
                    )::integer AS paid_profit_cents
                FROM public.payouts p
                WHERE p.automation_run_id = run.id
                  AND p.status = 'paid'
            ) paid ON TRUE
            ORDER BY run.run_date DESC, run.started_at DESC
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

    const payables = verified.payables;
    const waitingByRestaurant = new Map(
        waitingPayables.map((row) => [row.restaurant_id, row])
    );
    const eligibleRestaurants = new Set(payables.map((row) => row.restaurant_id));
    const dashboardPayables = [
        ...payables.map((row) => {
            const waiting = waitingByRestaurant.get(row.restaurant_id);
            return {
                restaurantId: row.restaurant_id,
                restaurantName: row.restaurant_name,
                grossCents: Number(row.gross_cents) || 0,
                payzuFeeCents: row.provider_fee_cents,
                pixKey: row.payment_info,
                pixKeyType: resolvePixKeyType(row),
                pixKeyTypeStored: row.payment_info_type,
                canSend: Boolean(row.payment_info && resolvePixKeyType(row)),
                waitingGrossCents: Number(waiting?.waiting_gross_cents) || 0,
                nextEligibleAt: waiting?.next_eligible_at || null,
            };
        }),
        ...waitingPayables
            .filter((row) => !eligibleRestaurants.has(row.restaurant_id))
            .map((row) => ({
                restaurantId: row.restaurant_id,
                restaurantName: row.restaurant_name,
                grossCents: 0,
                payzuFeeCents: 0,
                pixKey: row.payment_info,
                pixKeyType: resolvePixKeyType(row),
                pixKeyTypeStored: row.payment_info_type,
                canSend: false,
                waitingGrossCents: Number(row.waiting_gross_cents) || 0,
                nextEligibleAt: row.next_eligible_at,
            })),
    ];

    return {
        asaasConfigured: Boolean(getAsaasApiKey()),
        asaasBalanceCents,
        asaasError,
        generatedAt: now.toISOString(),
        cutoffAt: cutoffAt.toISOString(),
        payables: dashboardPayables,
        validationErrors: verified.validationErrors,
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
