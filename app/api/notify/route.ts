import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { sendNtfyNotification } from "@/lib/services/ntfy";
import type { AlertTrigger } from "@/lib/dev/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function isAuthorized(request: Request): boolean {
    const secret = process.env.CRON_SECRET?.trim();
    return Boolean(
        secret &&
            request.headers.get("authorization") === `Bearer ${secret}`
    );
}

async function notify(
    request: Request,
    input: { title?: unknown; message?: unknown; source?: unknown; severity?:unknown; trigger?: unknown; operation?: unknown; httpStatus?: unknown; incidentKey?: unknown }
) {
    if (!isAuthorized(request)) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }

    const title =
        typeof input.title === "string" ? input.title.trim() : "";
    let message =
        typeof input.message === "string" ? input.message.trim() : "";

    if (!message) {
        return NextResponse.json(
            { error: "Mensagem não informada." },
            { status: 400 }
        );
    }

    if (title.length > 200 || message.length > 4000) {
        return NextResponse.json(
            { error: "Notificação excede o limite permitido." },
            { status: 400 }
        );
    }

    const source = typeof input.source === "string" && input.source.trim()
        ? input.source.trim().slice(0, 100) : "api/notify";
    if (source === "vps-monitor" && title === "TRIGGER ALARM · iMenu: critical alert") {
        // The payout job reports customer-impacting failures directly.
        const lines = message.split("\n");
        const checks = lines.filter(line =>
            !/^(?:cron_failed:daily-payout|operation:payout_failed_today)(?: \(\d+\))?$/.test(line.trim())
        );
        if (checks.length < lines.length) {
            try {
                const { rowCount } = await query(`
                    SELECT 1 FROM public.payout_automation_runs
                    WHERE run_date = (NOW() AT TIME ZONE 'America/Sao_Paulo')::date
                      AND (finished_at IS NOT NULL OR payout_step_status = 'processing')
                `);
                if (rowCount) {
                    if (checks.every(line => !line.trim() || line.trim() === "TRIGGER ALARM")) {
                        return NextResponse.json({ success: true });
                    }
                    message = checks.join("\n");
                }
            } catch (error) {
                console.error("[NOTIFY] Falha ao verificar execução do repasse", error);
            }
        }
    }

    try {
        await sendNtfyNotification({
            source,
            severity: typeof input.severity === "string" && ["info","warning","error","critical"].includes(input.severity) ? input.severity : undefined,
            title: title || "iMenu",
            trigger: ["notification","alarm","blast","none"].includes(String(input.trigger)) ? input.trigger as AlertTrigger : undefined,
            operation: typeof input.operation === "string" ? input.operation.trim().slice(0,150) : undefined,
            httpStatus: typeof input.httpStatus === "number" && Number.isInteger(input.httpStatus) ? input.httpStatus : undefined,
            incidentKey: typeof input.incidentKey === "string" && input.incidentKey.trim() ? input.incidentKey.trim().slice(0,200) : undefined,
            message,
        });
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("[NOTIFY] Falha ao enviar notificação ntfy", error);
        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível enviar a notificação.",
            },
            { status: 500 }
        );
    }
}

export async function GET(request: Request) {
    const url = new URL(request.url);
    return notify(request, {
        title: url.searchParams.get("title"),
        message: url.searchParams.get("message"),
        source: url.searchParams.get("source"),
        severity: url.searchParams.get("severity"),
        trigger: url.searchParams.get("trigger"),
        operation: url.searchParams.get("operation"),
    });
}

export async function POST(request: Request) {
    let body: unknown;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "JSON inválido." },
            { status: 400 }
        );
    }

    const input =
        body && typeof body === "object"
            ? (body as { title?: unknown; message?: unknown; source?: unknown; severity?:unknown; trigger?: unknown; operation?: unknown; httpStatus?: unknown; incidentKey?: unknown })
            : {};

    return notify(request, input);
}
