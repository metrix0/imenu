import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { isProductionAlertRuntime, recordDevAlert, resolveDevIncident } from "@/lib/dev/health";
import { checkWahaApi, getWahaSession } from "@/lib/services/wahaClient";
import { OFFICIAL_WAHA_SESSIONS, reportOfficialWahaFailure, resolveOfficialWahaFailure } from "@/lib/services/wahaAlerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const API_INCIDENT = "waha:api";

type ProbeState = "connected" | "degraded" | "unverified";

type Connection = { session_name: string; desired_state: string; status: string; last_event_at: Date | null; last_connected_at: Date | null };

async function recordWahaHealthCheck(scope: string, state: ProbeState, checkedAt: Date) {
    const { rows } = await query<{ state: ProbeState | "failed" }>(
        `INSERT INTO public.dev_integration_status (source, ok, checked_at, check_kind, state, operation)
         VALUES ($1, $2 = 'connected', $3, 'probe', $2, 'Conexão WAHA')
         ON CONFLICT (source) DO UPDATE SET
             ok = EXCLUDED.ok,
             checked_at = EXCLUDED.checked_at,
             state = CASE
                 WHEN EXCLUDED.state = 'degraded' AND dev_integration_status.state IN ('degraded', 'failed')
                 THEN 'failed'
                 ELSE EXCLUDED.state
             END
         WHERE dev_integration_status.checked_at < EXCLUDED.checked_at
         RETURNING state`,
        [`waha:health:${scope}`, state, checkedAt]
    );
    return rows[0]?.state;
}

async function checkConnection(sessionName: string, status: string, checkedAt: Date, connection?: Connection) {
    const healthy = status === "WORKING" || status === "DISABLED";
    const state = await recordWahaHealthCheck(sessionName, healthy ? "connected" : "degraded", checkedAt);
    if (!state) return;

    const source = `waha:starting:${sessionName}`;
    if (status === "STARTING") {
        const { rows } = await query<{ expired: boolean }>(
            `INSERT INTO public.dev_integration_status (source, ok, checked_at, check_kind, state, operation, detail)
             VALUES ($1, false, LEAST(NOW(), COALESCE($2::timestamptz, NOW())), 'probe', 'degraded', 'Conexão WAHA', 'STARTING')
             ON CONFLICT (source) DO UPDATE SET checked_at =
                 CASE WHEN $3::timestamptz > dev_integration_status.checked_at
                     THEN EXCLUDED.checked_at ELSE dev_integration_status.checked_at END
             RETURNING checked_at <= NOW() - INTERVAL '3 minutes' AS expired`,
            [source, connection?.status === "STARTING" ? connection.last_event_at : null, connection?.last_connected_at ?? null]
        );
        if (rows[0]?.expired && state === "failed") {
            await reportOfficialWahaFailure(sessionName, "connection", "A sessão está em STARTING há pelo menos 3 minutos.");
        }
        return;
    }

    await query("DELETE FROM public.dev_integration_status WHERE source = $1", [source]);
    if (healthy) {
        await resolveOfficialWahaFailure(sessionName, "connection");
    } else if (state === "failed") {
        await reportOfficialWahaFailure(sessionName, "connection", `A sessão está indisponível (WAHA: ${status}).`);
    }
}

export async function GET(request: Request) {
    const secret = process.env.CRON_SECRET?.trim();
    if (!secret || request.headers.get("authorization") !== "Bearer " + secret) {
        return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
    }
    if (!isProductionAlertRuntime()) return NextResponse.json({ skipped: true });

    try {
        // Count a retry of the same scheduled minute only once.
        const checkedAt = new Date();
        checkedAt.setUTCSeconds(0, 0);
        const checks = await Promise.allSettled(OFFICIAL_WAHA_SESSIONS.map(async session => {
            const result = await getWahaSession(session, 5_000);
            if (result !== null && (result?.name !== session || typeof result?.status !== "string")) {
                throw new Error("Resposta inválida da sessão do WAHA.");
            }
            return result;
        }));
        const needsApiCheck = checks.some(check => check.status === "rejected");
        const apiAvailable = !needsApiCheck || await checkWahaApi().then(() => true, () => false);
        const apiState = await recordWahaHealthCheck("api", apiAvailable ? "connected" : "degraded", checkedAt);
        if (!apiState) return NextResponse.json({ skipped: true });
        if (!apiAvailable) {
            await Promise.all(OFFICIAL_WAHA_SESSIONS.map(session =>
                recordWahaHealthCheck(session, "unverified", checkedAt)
            ));
            if (apiState === "failed") {
                await recordDevAlert({
                    source: "waha",
                    severity: "critical",
                    trigger: "alarm",
                    title: "ALARM TRIGGER · API do WAHA indisponível",
                    message: "O WAHA não respondeu corretamente ao verificar a API após uma falha na consulta de sessão.",
                    operation: "API WAHA",
                    incidentKey: API_INCIDENT,
                });
            }
            return NextResponse.json({ ok: false, apiAvailable: false });
        }

        await resolveDevIncident(API_INCIDENT);
        const { rows } = await query<Connection>(
            "SELECT session_name, desired_state, status, last_event_at, last_connected_at FROM support_whatsapp_connection WHERE session_name = ANY($1::text[])",
            [OFFICIAL_WAHA_SESSIONS]
        );
        const states = await Promise.all(OFFICIAL_WAHA_SESSIONS.map(async (session, index) => {
            const connection = rows.find(row => row.session_name === session);
            const check = checks[index];
            const status = connection?.desired_state === "disconnected" ? "DISABLED"
                : check.status === "rejected" ? "UNAVAILABLE" : check.value?.status || "MISSING";
            await checkConnection(session, status, checkedAt, connection);
            return status;
        }));

        return NextResponse.json({ apiAvailable: true, sessions: Object.fromEntries(OFFICIAL_WAHA_SESSIONS.map((session, index) => [session, states[index]])) });
    } catch (error) {
        console.error("[WAHA_HEALTH]", error);
        return NextResponse.json({ error: "Falha na verificação do WAHA." }, { status: 500 });
    }
}
