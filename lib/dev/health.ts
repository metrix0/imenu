import { createHash } from "node:crypto";
import { query } from "@/lib/database/sql";

export const INTEGRATIONS = [
    { id: "asaas", name: "Asaas", priority: 1 },
    { id: "mercadopago", name: "Mercado Pago", priority: 1 },
    { id: "supabase", name: "Supabase / Auth / Storage", priority: 1 },
    { id: "waha", name: "WhatsApp / WAHA", priority: 2 },
    { id: "waha_webhooks", name: "WAHA / Entrega de webhooks", priority: 2 },
    { id: "openai", name: "OpenAI", priority: 2 },
    { id: "posthog", name: "PostHog", priority: 3 },
    { id: "google", name: "Google Geocoding", priority: 3 },
    { id: "tomtom", name: "TomTom", priority: 3 },
    { id: "arcgis", name: "ArcGIS", priority: 3 },
    { id: "nominatim", name: "OpenStreetMap", priority: 3 },
    { id: "brasilapi", name: "BrasilAPI / CEP", priority: 3 },
    { id: "ntfy", name: "Ntfy", priority: 2 },
] as const;

export type AlertTrigger = "notification" | "alarm" | "blast" | "none";
export type DevAlertInput = {
    source: string;
    title: string;
    message: string;
    severity?: string;
    notification?: boolean;
    trigger?: AlertTrigger;
    operation?: string;
    httpStatus?: number | null;
    incidentKey?: string;
};

export async function recordDevAlert(input: DevAlertInput) {
    const source = input.source.trim() || "unknown";
    const severity = input.severity || "error";
    const alarm = input.trigger === "alarm" ||
        (input.trigger === undefined && (severity === "critical" || /(?:ALARM TRIGGER|TRIGGER ALARM)/.test(input.title)));
    const trigger: AlertTrigger = input.trigger || (alarm ? "alarm" :
        input.notification || ["warning", "error"].includes(severity) ? "notification" : "none");
    const title = alarm && !/(?:ALARM TRIGGER|TRIGGER ALARM)/.test(input.title)
        ? `TRIGGER ALARM · ${input.title}` : input.title;
    // Only incident-producing failures are grouped. Explicit outbound events remain distinct.
    const incidentKey = input.incidentKey ||
        (!input.notification && ["warning", "error", "critical"].includes(severity)
            ? createHash("sha256").update(`${source}:${input.operation || input.title}:${new Date().toISOString().slice(0, 10)}`).digest("hex")
            : null);
    let alertId: string | undefined;
    let storageFailed = false;
    try {
        const claimed = await query<{ id: string }>(
            `INSERT INTO public.dev_alerts
              (source,title,message,severity,fingerprint,phone_notified,alarm_triggered,trigger_type,operation,http_status,incident_key,last_seen_at)
             VALUES ($1,$2,$3,$4,NULL,false,false,$5,$6,$7,$8,NOW())
             ON CONFLICT DO NOTHING RETURNING id`,
            [source, title.slice(0, 200), input.message.slice(0, 4000), severity, trigger,
                input.operation?.slice(0, 150) || null, input.httpStatus ?? null, incidentKey]
        );
        alertId = claimed.rows[0]?.id;
        if (!alertId && incidentKey) {
            await query(
                `UPDATE public.dev_alerts SET occurrences=occurrences+1,last_seen_at=NOW(),message=$2,http_status=$3
                 WHERE incident_key=$1 AND resolved_at IS NULL`,
                [incidentKey, input.message.slice(0, 4000), input.httpStatus ?? null]
            );
            return { phoneNotified: false, deliveryError: null };
        }
    } catch (error) {
        // If PostgreSQL is unavailable, still attempt the urgent notification.
        storageFailed = true;
        console.error("[DEV_HEALTH] Não foi possível registrar alerta:", error instanceof Error ? error.name : "unknown");
    }
    if (!alertId && !storageFailed) return { phoneNotified: false, deliveryError: null };

    let phoneNotified = false;
    let deliveryError: string | null = null;
    if (source !== "ntfy" && (trigger === "notification" || trigger === "alarm")) {
        try {
            const topic = process.env.NTFY_TOPIC?.trim();
            if (!topic) throw new Error("NTFY_TOPIC não configurado.");
            const response = await fetch(`https://ntfy.sh/${encodeURIComponent(topic)}`, {
                method: "POST",
                headers: { "Content-Type": "text/plain; charset=utf-8", Title: title.slice(0, 200),
                    Priority: trigger === "alarm" ? "5" : "4" },
                body: input.message.slice(0, 4000),
                cache: "no-store",
                signal: AbortSignal.timeout(6000),
            });
            if (!response.ok) throw new Error(`ntfy HTTP ${response.status}`);
            await response.body?.cancel();
            phoneNotified = true;
        } catch (error) {
            deliveryError = error instanceof Error ? error.message : "Falha ao notificar.";
        }
    }
    try {
        if (alertId) await query(
            "UPDATE public.dev_alerts SET phone_notified=$2,alarm_triggered=$3,delivery_error=$4 WHERE id=$1",
            [alertId, phoneNotified, phoneNotified && trigger === "alarm", deliveryError]
        );
    } catch { /* Do not affect the original operation. */ }
    return { phoneNotified, deliveryError };
}

export async function resolveDevIncident(incidentKey: string) {
    try {
        await query(
            "UPDATE public.dev_alerts SET resolved_at=NOW(),last_seen_at=NOW() WHERE incident_key=$1 AND resolved_at IS NULL",
            [incidentKey]
        );
    } catch { /* Monitoring must be non-disruptive. */ }
}

export type ProbeResult = {
    id: string;
    state: "connected" | "degraded" | "failed" | "unverified";
    operation: string;
    detail: string;
    status: number | null;
};

export async function recordIntegrationProbe(result: ProbeResult) {
    try {
        const previous = await query<{ state: string | null; check_kind: string }>(
            "SELECT state,check_kind FROM public.dev_integration_status WHERE source=$1", [result.id]
        );
        const last = previous.rows[0];
        // A single failing check is degraded; only repeated full failures become an outage.
        const state = result.state === "failed" && !(last?.check_kind === "probe" && ["degraded", "failed"].includes(last.state || ""))
            ? "degraded" : result.state;
        await query(
            `INSERT INTO public.dev_integration_status(source,ok,http_status,checked_at,check_kind,state,operation,detail)
             VALUES($1,$2,$3,NOW(),'probe',$4,$5,$6)
             ON CONFLICT(source) DO UPDATE SET ok=excluded.ok,http_status=excluded.http_status,
             checked_at=excluded.checked_at,check_kind=excluded.check_kind,state=excluded.state,
             operation=excluded.operation,detail=excluded.detail`,
            [result.id, state === "connected", result.status, state, result.operation, result.detail.slice(0, 250)]
        );
        const key = `integration:${result.id}`;
        if (state === "failed") {
            await recordDevAlert({
                source: result.id,
                operation: result.operation,
                title: `Integração indisponível: ${INTEGRATIONS.find(item => item.id === result.id)?.name || result.id}`,
                message: result.detail,
                httpStatus: result.status,
                incidentKey: key,
                severity: "warning",
                trigger: (INTEGRATIONS.find(item => item.id === result.id)?.priority || 3) <= 2 ? "notification" : "none",
            });
        } else if (state === "connected") {
            await resolveDevIncident(key);
        }
        return { ...result, state };
    } catch {
        return result;
    }
}
