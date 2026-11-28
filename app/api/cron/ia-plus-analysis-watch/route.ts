import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { sendNtfyNotification } from "@/lib/services/ntfy";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALERT_HOURS = new Set([2, 3, 12, 13]);

type Candidate = {
    addon_id: string;
    restaurant_id: string;
    restaurant_name: string;
    owner_email: string | null;
    activated_at: string | Date;
    eligible_at: string | Date;
    delay_hours: number | string;
    latest_status: string | null;
    latest_created_at: string | Date | null;
    latest_error: string | null;
    latest_report_status: string | null;
};

async function isAuthorized(request: Request): Promise<boolean> {
    const authorization = request.headers.get("authorization");
    const secret = process.env.CRON_SECRET?.trim();

    if (secret && authorization === `Bearer ${secret}`) {
        return true;
    }

    const token = authorization?.startsWith("Bearer ")
        ? authorization.slice(7)
        : "";

    if (!token) {
        return false;
    }

    try {
        return Boolean(
            (
                await query(
                    "SELECT 1 FROM vault.decrypted_secrets WHERE name = 'ia_plus_analysis_watch_token' AND decrypted_secret = $1 LIMIT 1",
                    [token]
                )
            ).rowCount
        );
    } catch {
        return false;
    }
}

function formatDate(value: string | Date): string {
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        dateStyle: "short",
        timeStyle: "medium",
    }).format(new Date(value));
}

function buildMessage(row: Candidate, delayHours: number): string {
    const latest = row.latest_status
        ? [
              `Última análise: ${row.latest_status}`,
              row.latest_report_status
                  ? `Status do relatório: ${row.latest_report_status}`
                  : null,
              row.latest_created_at
                  ? `Iniciada em: ${formatDate(row.latest_created_at)}`
                  : null,
              row.latest_error
                  ? `Erro: ${row.latest_error.slice(0, 500)}`
                  : null,
          ].filter(Boolean)
        : ["Última análise: nenhuma"];

    return [
        `iMenu Plus elegível para análise há ${delayHours}h e ainda sem análise concluída nos últimos 28 dias.`,
        `Restaurante: ${row.restaurant_name}`,
        row.owner_email ? `E-mail: ${row.owner_email}` : null,
        `Restaurante ID: ${row.restaurant_id}`,
        `Ativado em: ${formatDate(row.activated_at)}`,
        `Elegível para análise em: ${formatDate(row.eligible_at)}`,
        ...latest,
    ]
        .filter(Boolean)
        .join("\n");
}

export async function GET(request: Request) {
    if (!(await isAuthorized(request))) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const candidates = await query<Candidate>(
        `
        SELECT
            addon.id AS addon_id,
            addon.restaurant_id,
            restaurant.name AS restaurant_name,
            owner.email AS owner_email,
            addon.activated_at,
            eligibility.eligible_at,
            FLOOR(EXTRACT(EPOCH FROM (NOW() - eligibility.eligible_at)) / 3600)::int AS delay_hours,
            latest.status AS latest_status,
            latest.created_at AS latest_created_at,
            latest.error AS latest_error,
            latest.report_status AS latest_report_status
        FROM public.restaurant_addons addon
        JOIN public.restaurants restaurant
          ON restaurant.id = addon.restaurant_id
        LEFT JOIN auth.users owner
          ON owner.id = restaurant.user_id
        LEFT JOIN LATERAL (
            SELECT GREATEST(o.created_at, o.updated_at AT TIME ZONE 'UTC') AS completed_at
            FROM public.orders o
            WHERE o.restaurant_id = addon.restaurant_id AND o.status = 'done'
            ORDER BY GREATEST(o.created_at, o.updated_at AT TIME ZONE 'UTC'), o.id
            OFFSET 9 LIMIT 1
        ) tenth ON TRUE
        LEFT JOIN LATERAL (
            SELECT min(m.created_at) AS requested_at
            FROM public.ia_vendas_conversations c
            JOIN public.ia_vendas_messages m ON m.conversation_id=c.id AND m.restaurant_id=c.restaurant_id
            WHERE c.restaurant_id=addon.restaurant_id AND c.kind='analysis'
              AND m.role='user' AND m.cards @> '[{"type":"analysis_request"}]'::jsonb
              AND m.created_at>=addon.activated_at
        ) requested ON TRUE
        CROSS JOIN LATERAL (
            SELECT LEAST(
                CASE WHEN tenth.completed_at IS NOT NULL THEN GREATEST(addon.activated_at, tenth.completed_at) END,
                requested.requested_at
            ) AS eligible_at
        ) eligibility
        LEFT JOIN LATERAL (
            SELECT
                run.status,
                run.created_at,
                run.error,
                run.result->'report'->>'status' AS report_status
            FROM public.ia_vendas_runs run
            WHERE run.restaurant_id = addon.restaurant_id
              AND run.kind = 'analysis'
            ORDER BY run.created_at DESC
            LIMIT 1
        ) latest ON TRUE
        WHERE addon.product_key = 'ia_plus'
          AND addon.activated_at IS NOT NULL
          AND eligibility.eligible_at <= NOW() - INTERVAL '2 hours'
          AND eligibility.eligible_at > NOW() - INTERVAL '14 hours'
          AND (
              addon.status = 'active'
              OR (
                  addon.status IN ('canceled', 'past_due')
                  AND addon.current_period_ends_at > NOW()
              )
          )
          AND NOT EXISTS (
              SELECT 1
              FROM public.ia_vendas_runs completed
              WHERE completed.restaurant_id = addon.restaurant_id
                AND completed.kind = 'analysis'
                AND completed.status = 'completed'
                AND completed.result->>'detached_at' IS NULL
                AND completed.result->'report'->>'status' = 'complete'
                AND completed.created_at >= NOW() - INTERVAL '28 days'
          )
        ORDER BY eligibility.eligible_at ASC
        LIMIT 100
        `
    );

    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const candidate of candidates.rows) {
        const delayHours = Number(candidate.delay_hours);

        if (!ALERT_HOURS.has(delayHours)) {
            skipped += 1;
            continue;
        }

        const claim = await query(
            `
            INSERT INTO public.ia_plus_analysis_alerts (
                addon_id,
                delay_hours
            )
            VALUES ($1, $2)
            ON CONFLICT (addon_id, delay_hours) DO UPDATE SET sent_at=EXCLUDED.sent_at
            WHERE ia_plus_analysis_alerts.sent_at < $3::timestamptz
            RETURNING addon_id
            `,
            [candidate.addon_id, delayHours, candidate.eligible_at]
        );

        if (claim.rowCount === 0) {
            skipped += 1;
            continue;
        }

        try {
            await sendNtfyNotification({
            source: "cron/ia-plus-analysis-watch",
                title: `ALARM TRIGGER - iMenu Plus sem análise recente (${delayHours}h)`,
                message: buildMessage(candidate, delayHours),
            });
            sent += 1;
        } catch (error) {
            await query(
                `
                DELETE FROM public.ia_plus_analysis_alerts
                WHERE addon_id = $1
                  AND delay_hours = $2
                `,
                [candidate.addon_id, delayHours]
            );

            console.error("[IA_PLUS_ANALYSIS_WATCH] Falha ao enviar alerta", {
                addonId: candidate.addon_id,
                restaurantId: candidate.restaurant_id,
                delayHours,
                error:
                    error instanceof Error ? error.message : String(error),
            });
            failed += 1;
        }
    }

    return NextResponse.json({
        checked: candidates.rowCount,
        sent,
        skipped,
        failed,
    });
}
