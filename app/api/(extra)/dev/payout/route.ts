import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";

import { query } from "@/lib/database/sql";
import {
    createPayoutPlan,
    getAsaasBalance,
    getPayoutCutoffAt,
    getPayoutDashboardData,
    PayoutValidationError,
    retryFailedPayout,
    sendPayouts,
} from "@/lib/services/payouts";
import {
    assertMercadoPagoPayoutConfigured,
    transferMercadoPagoToAsaas,
} from "@/lib/services/mercadoPagoPayout";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    try {
        const data = await getPayoutDashboardData();
        const restaurantIds = Array.from(
            new Set([
                ...data.payables.map((item) => item.restaurantId),
                ...data.history.map((item) => item.restaurant_id),
            ])
        );
        const ownerPhoneResult =
            restaurantIds.length > 0
                ? await query<{
                      restaurant_id: string;
                      owner_phone: string | null;
                  }>(
                      `
                      SELECT
                          r.id AS restaurant_id,
                          COALESCE(
                              NULLIF(TRIM(u.raw_user_meta_data->>'phone'), ''),
                              NULLIF(TRIM(r.phone), '')
                          ) AS owner_phone
                      FROM public.restaurants r
                      LEFT JOIN auth.users u ON u.id = r.user_id
                      WHERE r.id = ANY($1::uuid[])
                      `,
                      [restaurantIds]
                  )
                : { rows: [] };

        return NextResponse.json({
            ...data,
            ownerPhones: Object.fromEntries(
                ownerPhoneResult.rows.map((row) => [
                    row.restaurant_id,
                    row.owner_phone || "",
                ])
            ),
            automationRuns: data.automationRuns.map((run: any) => ({
                ...run,
                run_date: new Date(run.run_date).toISOString().slice(0, 10),
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

    let body: {
        action?: unknown;
        discountPercent?: unknown;
        adjustToOnePercent?: unknown;
        amounts?: unknown;
        restaurantIds?: unknown;
        cutoffAt?: unknown;
        retryPayoutId?: unknown;
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
    const restaurantIds = Array.isArray(body.restaurantIds)
        ? body.restaurantIds.filter(
              (restaurantId): restaurantId is string =>
                  typeof restaurantId === "string" && restaurantId.length > 0
          )
        : undefined;
    const retryPayoutId =
        typeof body.retryPayoutId === "string" && body.retryPayoutId.trim()
            ? body.retryPayoutId.trim()
            : null;

    try {
        if (body.action === "fund_asaas") {
            const cutoffAt = getPayoutCutoffAt();
            const plan = await createPayoutPlan({
                cutoffAt,
                discountPercent: 1,
                adjustToOnePercent: true,
            });
            const asaasBalanceCents = await getAsaasBalance();
            const shortfallCents = Math.max(
                0,
                plan.totalNetCents - asaasBalanceCents
            );

            if (shortfallCents === 0) {
                return NextResponse.json({
                    success: true,
                    skipped: true,
                    amountCents: 0,
                    requiredCents: plan.totalNetCents,
                    asaasBalanceBeforeCents: asaasBalanceCents,
                    transactionStatus: null,
                });
            }

            const amountCents = Math.max(100, shortfallCents);
            assertMercadoPagoPayoutConfigured();
            const paymentFingerprint = createHash("sha256")
                .update(
                    plan.sendable
                        .flatMap((item) =>
                            item.row.payments.map((payment) => payment.id)
                        )
                        .sort()
                        .join("|")
                )
                .digest("hex")
                .slice(0, 16);
            const clientReference =
                `imenu-mp-manual-${paymentFingerprint}-${amountCents}`;

            const transfer = await transferMercadoPagoToAsaas({
                amountCents,
                clientReference,
            });

            return NextResponse.json({
                success: true,
                skipped: false,
                amountCents,
                requiredCents: plan.totalNetCents,
                asaasBalanceBeforeCents: asaasBalanceCents,
                transactionStatus: transfer?.transactionStatus || null,
            });
        }

        if (retryPayoutId) {
            return NextResponse.json(await retryFailedPayout(retryPayoutId));
        }

        const latestEligibleCutoff = getPayoutCutoffAt();
        const requestedCutoff = body.cutoffAt === undefined
            ? latestEligibleCutoff
            : typeof body.cutoffAt === "string" ? new Date(body.cutoffAt) : new Date(NaN);
        if (!Number.isFinite(requestedCutoff.getTime()) ||
            requestedCutoff.getTime() > latestEligibleCutoff.getTime()) {
            return NextResponse.json(
                { error: "A margem de segurança de 1h30 ainda não terminou. Atualize a lista." },
                { status: 409 }
            );
        }

        return NextResponse.json(
            await sendPayouts({
                cutoffAt: requestedCutoff,
                discountPercent,
                adjustToOnePercent,
                amountOverrides,
                restaurantIds,
            })
        );
    } catch (error) {
        if (error instanceof PayoutValidationError) {
            return NextResponse.json(
                { error: error.message, ...error.details },
                { status: error.status }
            );
        }

        console.error("[DEV PAYOUT] Falha ao enviar:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro interno." },
            { status: 500 }
        );
    }
}
