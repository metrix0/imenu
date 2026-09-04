import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import {
    createPayoutPlan,
    getAsaasBalance,
    PayoutValidationError,
    reconcileProcessingPayouts,
    sendPayouts,
} from "@/lib/services/payouts";
import {
    PayZuRequestError,
    transferPayzuToAsaas,
} from "@/lib/services/payzuPayout";
import {
    isSafePayoutDifference,
    MAX_PAYOUT_DIFFERENCE_CENTS,
    MIN_PAYOUT_DIFFERENCE_CENTS,
} from "@/lib/services/payoutSafety";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

type AutomationStep = "payzu" | "adjustment" | "comparison" | "payout";

function getBusinessDate(date: Date): string {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: BUSINESS_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const value = Object.fromEntries(parts.map((part) => [part.type, part.value]));
    return `${value.year}-${value.month}-${value.day}`;
}

function isAuthorized(request: Request): boolean {
    const cronSecret = process.env.CRON_SECRET?.trim();
    if (!cronSecret) return false;
    return request.headers.get("authorization") === `Bearer ${cronSecret}`;
}

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForAsaasBalance(requiredCents: number): Promise<number> {
    let balanceCents = 0;

    for (let attempt = 0; attempt < 8; attempt += 1) {
        balanceCents = await getAsaasBalance();
        if (balanceCents >= requiredCents) return balanceCents;
        if (attempt < 7) await sleep(4_000);
    }

    return balanceCents;
}

async function notifyPayoutAlarm({
    runId,
    runDate,
    status,
    step,
    message,
}: {
    runId: string;
    runDate: string;
    status: string;
    step: AutomationStep;
    message: string;
}): Promise<void> {
    const topic = process.env.NTFY_TOPIC?.trim();
    if (!topic) {
        console.error("[DAILY_PAYOUT] NTFY_TOPIC não configurado; alerta não enviado.", {
            runId,
            runDate,
            status,
            step,
        });
        return;
    }

    try {
        const response = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
            method: "POST",
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                Title: "ALARM TRIGGER - iMenu payout automático",
            },
            body: [
                "Pagamento automático não foi concluído.",
                `Data: ${runDate}`,
                `Status: ${status}`,
                `Etapa: ${step}`,
                `Motivo: ${message}`,
                `Run: ${runId}`,
            ].join("\n"),
            cache: "no-store",
        });

        if (!response.ok) {
            throw new Error(`ntfy HTTP ${response.status}`);
        }
    } catch (error) {
        console.error("[DAILY_PAYOUT] Falha ao enviar alerta ntfy", {
            runId,
            runDate,
            status,
            step,
            error: error instanceof Error ? error.message : String(error),
        });
    }
}

async function markRunFailed(
    runId: string,
    step: AutomationStep,
    message: string
): Promise<void> {
    await query(
        `
        UPDATE public.payout_automation_runs
        SET
            status = 'failed',
            payzu_step_status = CASE WHEN $2 = 'payzu' THEN 'failed' ELSE payzu_step_status END,
            adjustment_step_status = CASE WHEN $2 = 'adjustment' THEN 'failed' ELSE adjustment_step_status END,
            comparison_step_status = CASE WHEN $2 = 'comparison' THEN 'failed' ELSE comparison_step_status END,
            payout_step_status = CASE WHEN $2 = 'payout' THEN 'failed' ELSE payout_step_status END,
            error_message = $3,
            finished_at = NOW(),
            updated_at = NOW()
        WHERE id = $1
        `,
        [runId, step, message]
    );
}

export async function GET(request: Request) {
    if (process.env.PAYOUT_CRON_ENABLED !== "true") {
        return NextResponse.json({ error: "Cron desativado." }, { status: 403 });
    }

    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const startedAt = new Date();
    const runDate = getBusinessDate(startedAt);
    const clientReference = `imenu-daily-payout-${runDate}`;
    const inserted = await query<{ id: string }>(
        `
        INSERT INTO public.payout_automation_runs (
            run_date,
            status,
            cutoff_at,
            payzu_step_status,
            adjustment_step_status,
            comparison_step_status,
            payout_step_status,
            payzu_client_reference
        )
        VALUES ($1, 'running', $2, 'running', 'pending', 'pending', 'pending', $3)
        ON CONFLICT (run_date) DO NOTHING
        RETURNING id
        `,
        [runDate, startedAt.toISOString(), clientReference]
    );
    const runId = inserted.rows[0]?.id;

    if (!runId) {
        const existing = await query(
            `SELECT * FROM public.payout_automation_runs WHERE run_date = $1 LIMIT 1`,
            [runDate]
        );
        return NextResponse.json({
            success: true,
            skipped: true,
            reason: "already_ran_today",
            run: existing.rows[0] || null,
        });
    }

    let currentStep: AutomationStep = "payzu";

    try {
        await reconcileProcessingPayouts();

        const payzuTransfer = await transferPayzuToAsaas(clientReference);
        await query(
            `
            UPDATE public.payout_automation_runs
            SET
                payzu_step_status = $2,
                payzu_balance_before_cents = $3,
                payzu_reserve_cents = $4,
                transferred_cents = $5,
                payzu_transaction_id = $6,
                payzu_transaction_status = $7,
                updated_at = NOW()
            WHERE id = $1
            `,
            [
                runId,
                payzuTransfer.skipped ? "skipped" : "completed",
                payzuTransfer.balanceBeforeCents,
                payzuTransfer.reserveCents,
                payzuTransfer.amountCents || 0,
                payzuTransfer.transactionId || null,
                payzuTransfer.transactionStatus || null,
            ]
        );

        currentStep = "adjustment";
        const plan = await createPayoutPlan({
            cutoffAt: startedAt,
            discountPercent: 1,
            adjustToOnePercent: true,
        });
        const skippedRestaurantCount = plan.payables.length - plan.sendable.length;

        if (plan.sendable.length === 0) {
            const message = "Nenhum restaurante com valor e chave PIX válidos para pagar.";
            await query(
                `
                UPDATE public.payout_automation_runs
                SET
                    status = 'blocked',
                    adjustment_step_status = 'blocked',
                    comparison_step_status = 'skipped',
                    payout_step_status = 'skipped',
                    error_message = $2,
                    finished_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                `,
                [runId, message]
            );
            await notifyPayoutAlarm({
                runId,
                runDate,
                status: "blocked",
                step: currentStep,
                message,
            });
            return NextResponse.json({ success: false, blocked: true, error: message });
        }

        await query(
            `
            UPDATE public.payout_automation_runs
            SET
                adjustment_step_status = 'completed',
                gross_cents = $2,
                payzu_fee_cents = $3,
                discount_cents = $4,
                payout_cents = $5,
                restaurant_count = $6,
                updated_at = NOW()
            WHERE id = $1
            `,
            [
                runId,
                plan.grossCents,
                plan.payzuFeeCents,
                plan.discountCents,
                plan.totalNetCents,
                plan.payables.length,
            ]
        );

        currentStep = "comparison";
        const transferredCents = payzuTransfer.amountCents || 0;
        const differenceCents = transferredCents - plan.totalNetCents;
        const isSimilar =
            skippedRestaurantCount > 0
                ? differenceCents >= MIN_PAYOUT_DIFFERENCE_CENTS
                : isSafePayoutDifference(differenceCents);

        if (!isSimilar) {
            const message =
                skippedRestaurantCount > 0
                    ? `Diferença abaixo da faixa segura: ${differenceCents} centavos. Mínimo permitido: ${MIN_PAYOUT_DIFFERENCE_CENTS} centavos. Nenhum repasse foi enviado.`
                    : `Diferença fora da faixa segura: ${differenceCents} centavos. ` +
                      `Permitido: ${MIN_PAYOUT_DIFFERENCE_CENTS} a ${MAX_PAYOUT_DIFFERENCE_CENTS} centavos. Nenhum repasse foi enviado.`;
            await query(
                `
                UPDATE public.payout_automation_runs
                SET
                    status = 'blocked',
                    comparison_step_status = 'blocked',
                    payout_step_status = 'skipped',
                    difference_cents = $2,
                    error_message = $3,
                    finished_at = NOW(),
                    updated_at = NOW()
                WHERE id = $1
                `,
                [runId, differenceCents, message]
            );
            await notifyPayoutAlarm({
                runId,
                runDate,
                status: "blocked",
                step: currentStep,
                message,
            });
            return NextResponse.json({
                success: false,
                blocked: true,
                error: message,
                differenceCents,
            });
        }

        await query(
            `
            UPDATE public.payout_automation_runs
            SET comparison_step_status = 'completed', difference_cents = $2, updated_at = NOW()
            WHERE id = $1
            `,
            [runId, differenceCents]
        );

        currentStep = "payout";
        await query(
            `UPDATE public.payout_automation_runs SET payout_step_status = 'running', updated_at = NOW() WHERE id = $1`,
            [runId]
        );

        const asaasBalanceCents = await waitForAsaasBalance(plan.totalNetCents);
        await query(
            `UPDATE public.payout_automation_runs SET asaas_balance_before_payout_cents = $2, updated_at = NOW() WHERE id = $1`,
            [runId, asaasBalanceCents]
        );

        if (asaasBalanceCents < plan.totalNetCents) {
            throw new PayoutValidationError(
                "Saldo Asaas insuficiente após aguardar a transferência PayZu. Nenhum repasse foi enviado.",
                409,
                {
                    balanceCents: asaasBalanceCents,
                    requiredCents: plan.totalNetCents,
                }
            );
        }

        const payoutResult = await sendPayouts({
            cutoffAt: startedAt,
            discountPercent: 1,
            adjustToOnePercent: true,
            automationRunId: runId,
            expectedTotalCents: plan.totalNetCents,
        });
        const status =
            payoutResult.processingCount > 0
                ? "processing"
                : payoutResult.failedCount > 0 && payoutResult.paidCount > 0
                  ? "partial"
                  : payoutResult.failedCount > 0
                    ? "failed"
                    : skippedRestaurantCount > 0
                      ? "partial"
                      : "completed";
        const payoutStepStatus =
            payoutResult.processingCount > 0
                ? "processing"
                : payoutResult.failedCount > 0
                  ? "failed"
                  : "completed";

        await query(
            `
            UPDATE public.payout_automation_runs
            SET
                status = $2,
                payout_step_status = $3,
                paid_count = $4,
                processing_count = $5,
                failed_count = $6,
                finished_at = CASE WHEN $2 = 'processing' THEN NULL ELSE NOW() END,
                updated_at = NOW()
            WHERE id = $1
            `,
            [
                runId,
                status,
                payoutStepStatus,
                payoutResult.paidCount,
                payoutResult.processingCount,
                payoutResult.failedCount,
            ]
        );

        if (status !== "completed") {
            const message = `Execução terminou com status ${status}. Pagos: ${payoutResult.paidCount}; em processamento: ${payoutResult.processingCount}; falhas: ${payoutResult.failedCount}; restaurantes ignorados: ${skippedRestaurantCount}.`;
            await notifyPayoutAlarm({
                runId,
                runDate,
                status,
                step: currentStep,
                message,
            });
        }

        return NextResponse.json({
            success: payoutResult.failedCount === 0,
            runId,
            transferredCents,
            payoutCents: plan.totalNetCents,
            differenceCents,
            skippedRestaurantCount,
            ...payoutResult,
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Erro interno.";
        await notifyPayoutAlarm({
            runId,
            runDate,
            status: "failed",
            step: currentStep,
            message,
        });
        await markRunFailed(runId, currentStep, message);

        console.error("[DAILY_PAYOUT] Falha", {
            runId,
            runDate,
            step: currentStep,
            message,
            requestId:
                error instanceof PayZuRequestError ? error.requestId : undefined,
        });

        return NextResponse.json(
            {
                success: false,
                error: message,
                ...(error instanceof PayoutValidationError
                    ? error.details
                    : {}),
            },
            { status: error instanceof PayoutValidationError ? error.status : 500 }
        );
    }
}
