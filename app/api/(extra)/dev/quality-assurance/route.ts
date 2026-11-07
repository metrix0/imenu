import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

type AnalysisRow = {
    id: string;
    restaurant_id: string;
    restaurant_name: string;
    finished_at: string;
    activated_at: string | null;
    potential_cents: string | number | null;
    snapshot_gmv_cents: string | number | null;
    snapshot_days: string | number | null;
    total: string | number;
};
type MissingRow = {
    addon_id: string;
    restaurant_id: string;
    restaurant_name: string;
    activated_at: string;
    waiting_seconds: string | number;
    latest_attempt_at: string | null;
    latest_attempt_status: string | null;
    alert_count: string | number;
    latest_alarm_at: string | null;
};
type SummaryRow = {
    average_potential_cents: string | number | null;
    restaurants_with_potential: string | number;
    average_first_analysis_minutes: string | number | null;
    measured_activations: string | number;
};

const analysesSql = `
    SELECT run.id::text AS id, run.restaurant_id::text AS restaurant_id,
        restaurant.name AS restaurant_name, run.finished_at,
        addon.activated_at,
        CASE WHEN run.result->'report'->'potential_estimate'->>'available' = 'true'
             AND (run.result->'report'->'potential_estimate'->>'cents') ~ '^[0-9]+$'
            THEN (run.result->'report'->'potential_estimate'->>'cents')::numeric END AS potential_cents,
        CASE WHEN (run.result->'report'->'sales_snapshot'->>'revenue_cents') ~ '^[0-9]+$'
            THEN (run.result->'report'->'sales_snapshot'->>'revenue_cents')::numeric END AS snapshot_gmv_cents,
        CASE WHEN (run.result->'report'->'sales_snapshot'->>'days') ~ '^[0-9]+$'
            THEN (run.result->'report'->'sales_snapshot'->>'days')::int END AS snapshot_days,
        COUNT(*) OVER()::int AS total
    FROM public.ia_vendas_runs run
    JOIN public.restaurants restaurant ON restaurant.id = run.restaurant_id
    LEFT JOIN LATERAL (
        SELECT a.activated_at
        FROM public.restaurant_addons a
        WHERE a.restaurant_id = run.restaurant_id AND a.product_key = 'ia_plus'
            AND a.activated_at IS NOT NULL AND a.activated_at <= run.finished_at
            AND (run.result->>'purchase_addon_id' IS NULL
                OR run.result->>'purchase_addon_id' = a.id::text)
        ORDER BY a.activated_at DESC LIMIT 1
    ) addon ON TRUE
    WHERE run.kind = 'analysis' AND run.status = 'completed'
        AND run.result->'report'->>'status' = 'complete'
        AND run.result->>'detached_at' IS NULL
        AND run.finished_at >= NOW() - INTERVAL '90 days'
    ORDER BY run.finished_at DESC, run.id DESC
    LIMIT $1 OFFSET $2
`;

const missingSql = `
    SELECT addon.id::text AS addon_id, addon.restaurant_id::text AS restaurant_id,
        restaurant.name AS restaurant_name, addon.activated_at,
        GREATEST(0, EXTRACT(EPOCH FROM NOW() - addon.activated_at))::bigint AS waiting_seconds,
        attempt.created_at AS latest_attempt_at, attempt.status AS latest_attempt_status,
        COALESCE(alarms.alert_count, 0)::int AS alert_count,
        alarms.latest_alarm_at
    FROM public.restaurant_addons addon
    JOIN public.restaurants restaurant ON restaurant.id = addon.restaurant_id
    LEFT JOIN LATERAL (
        SELECT run.created_at, run.status
        FROM public.ia_vendas_runs run
        WHERE run.restaurant_id = addon.restaurant_id AND run.kind = 'analysis'
            AND run.created_at >= addon.activated_at
            AND (run.result->>'purchase_addon_id' IS NULL
                OR run.result->>'purchase_addon_id' = addon.id::text)
        ORDER BY run.created_at DESC LIMIT 1
    ) attempt ON TRUE
    LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS alert_count, MAX(sent_at) AS latest_alarm_at
        FROM public.ia_plus_analysis_alerts alert
        WHERE alert.addon_id = addon.id
    ) alarms ON TRUE
    WHERE addon.product_key = 'ia_plus' AND addon.status IN ('active', 'past_due')
        AND addon.activated_at IS NOT NULL
        AND NOT EXISTS (
            SELECT 1 FROM public.ia_vendas_runs run
            WHERE run.restaurant_id = addon.restaurant_id AND run.kind = 'analysis'
                AND run.status = 'completed'
                AND run.result->'report'->>'status' = 'complete'
                AND run.result->>'detached_at' IS NULL
                AND run.finished_at >= addon.activated_at
                AND (run.result->>'purchase_addon_id' IS NULL
                    OR run.result->>'purchase_addon_id' = addon.id::text)
        )
    ORDER BY addon.activated_at ASC
`;

const summarySql = `
    WITH latest AS (
        SELECT DISTINCT ON (run.restaurant_id)
            run.result->'report'->'potential_estimate' AS potential
        FROM public.ia_vendas_runs run
        WHERE run.kind = 'analysis' AND run.status = 'completed'
            AND run.result->'report'->>'status' = 'complete'
            AND run.result->>'detached_at' IS NULL
            AND run.finished_at >= NOW() - INTERVAL '30 days'
        ORDER BY run.restaurant_id, run.finished_at DESC
    ), potential_values AS (
        SELECT CASE WHEN potential->>'available' = 'true'
            AND (potential->>'cents') ~ '^[0-9]+$'
            THEN (potential->>'cents')::numeric END AS cents
        FROM latest
    ), first_analyses AS (
        SELECT EXTRACT(EPOCH FROM first_run.finished_at - addon.activated_at) / 60 AS minutes
        FROM public.restaurant_addons addon
        JOIN LATERAL (
            SELECT MIN(run.finished_at) AS finished_at
            FROM public.ia_vendas_runs run
            WHERE run.restaurant_id = addon.restaurant_id AND run.kind = 'analysis'
                AND run.status = 'completed'
                AND run.result->'report'->>'status' = 'complete'
                AND run.result->>'detached_at' IS NULL
                AND run.finished_at >= addon.activated_at
                AND run.finished_at >= NOW() - INTERVAL '90 days'
                AND (run.result->>'purchase_addon_id' IS NULL
                    OR run.result->>'purchase_addon_id' = addon.id::text)
        ) first_run ON first_run.finished_at IS NOT NULL
        WHERE addon.product_key = 'ia_plus' AND addon.activated_at IS NOT NULL
    )
    SELECT (SELECT AVG(cents) FROM potential_values WHERE cents > 0) AS average_potential_cents,
        (SELECT COUNT(*)::int FROM potential_values WHERE cents > 0) AS restaurants_with_potential,
        (SELECT AVG(minutes) FROM first_analyses) AS average_first_analysis_minutes,
        (SELECT COUNT(*)::int FROM first_analyses) AS measured_activations
`;

export async function GET(request: Request) {
    try {
        const authError = await authorize(request);
        if (authError) return authError;

        const pageParam = new URL(request.url).searchParams.get("page") || "0";
        if (!/^\d+$/.test(pageParam) || Number(pageParam) > 10000) {
            return NextResponse.json({ error: "Página inválida." }, { status: 400 });
        }
        const page = Number(pageParam);
        const [analyses, missing, summary] = await Promise.all([
            query<AnalysisRow>(analysesSql, [PAGE_SIZE, page * PAGE_SIZE]),
            query<MissingRow>(missingSql),
            query<SummaryRow>(summarySql),
        ]);
        const total = Number(analyses.rows[0]?.total || 0);
        const metrics = summary.rows[0];
        return NextResponse.json({
            summary: {
                averagePotentialCents: metrics?.average_potential_cents == null ? null : Number(metrics.average_potential_cents),
                restaurantsWithPotential: Number(metrics?.restaurants_with_potential || 0),
                averageFirstAnalysisMinutes: metrics?.average_first_analysis_minutes == null ? null : Number(metrics.average_first_analysis_minutes),
                measuredActivations: Number(metrics?.measured_activations || 0),
            },
            analyses: {
                rows: analyses.rows.map(row => ({
                    id: row.id,
                    restaurantId: row.restaurant_id,
                    restaurantName: row.restaurant_name,
                    finishedAt: row.finished_at,
                    activatedAt: row.activated_at,
                    potentialCents: row.potential_cents == null ? null : Number(row.potential_cents),
                    snapshotGmvCents: row.snapshot_gmv_cents == null ? null : Number(row.snapshot_gmv_cents),
                    snapshotDays: row.snapshot_days == null ? null : Number(row.snapshot_days),
                })),
                total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)),
            },
            missing: missing.rows.map(row => ({
                addonId: row.addon_id,
                restaurantId: row.restaurant_id,
                restaurantName: row.restaurant_name,
                activatedAt: row.activated_at,
                waitingSeconds: Number(row.waiting_seconds),
                latestAttemptAt: row.latest_attempt_at,
                latestAttemptStatus: row.latest_attempt_status,
                alertCount: Number(row.alert_count),
                latestAlarmAt: row.latest_alarm_at,
            })),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Quality assurance dashboard:", error);
        return NextResponse.json({ error: "Erro ao carregar Quality Assurance." }, { status: 500 });
    }
}
