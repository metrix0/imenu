import { query } from "@/lib/database/sql";
import { getPostHogConfig, postHogApiHost } from "@/lib/analytics/posthogQuery";
import {
    recordDevAlert, recordIntegrationProbe, resolveDevIncident,
    GEMINI_FALLBACK_INCIDENT, GEMINI_FALLBACK_OPERATION, GEMINI_FALLBACK_THRESHOLD,
    type ProbeResult,
} from "@/lib/dev/health";

const TIMEOUT_MS = 5_000;
const configured = (name: string) => process.env[name]?.trim() || null;

async function httpCheck(operation: string, url: string, headers?: HeadersInit): Promise<{ok:boolean;status:number|null;detail:string}> {
    try {
        const response = await fetch(url, {
            headers, cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        await response.body?.cancel();
        return { ok: response.ok, status: response.status,
            detail: `${operation}: HTTP ${response.status}` };
    } catch {
        return { ok: false, status: null, detail: `${operation}: falha de rede ou tempo limite` };
    }
}

function missing(id: string, operation: string, detail = "Credenciais não configuradas."): ProbeResult {
    return { id, operation, state: "unverified", detail, status: null };
}
async function remote(id: string, operation: string, url: string, headers?: HeadersInit): Promise<ProbeResult> {
    const check = await httpCheck(operation, url, headers);
    return { id, operation, state: check.ok ? "connected" : "failed", status: check.status, detail: check.detail };
}

async function supabase(): Promise<ProbeResult> {
    const url = configured("SUPABASE_URL") || configured("NEXT_PUBLIC_SUPABASE_URL");
    const anon = configured("SUPABASE_ANON_KEY") || configured("NEXT_PUBLIC_SUPABASE_ANON_KEY");
    const admin = configured("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !anon || !admin) return missing("supabase", "Database / Auth / Storage");
    const host = url.replace(/\/+$/, "");
    const checks = await Promise.all([
        query("SELECT 1").then(() => ({ ok: true, status: 200, detail: "Database: OK" }))
            .catch(() => ({ ok: false, status: null, detail: "Database: indisponível" })),
        httpCheck("Auth", `${host}/auth/v1/settings`, { apikey: anon }),
        httpCheck("Storage", `${host}/storage/v1/bucket?limit=1`, { apikey: admin, Authorization: `Bearer ${admin}` }),
    ]);
    const failing = checks.filter(item => !item.ok);
    return { id: "supabase", operation: "Database / Auth / Storage",
        state: failing.length === 0 ? "connected" : failing.length === checks.length ? "failed" : "degraded",
        status: failing[0]?.status ?? 200,
        detail: checks.map(item => item.detail).join(" · ") };
}

async function asaas(): Promise<ProbeResult> {
    const key = configured("ASAAS_API_KEY");
    if (!key) return missing("asaas", "Conta");
    const base = (configured("ASAAS_API_BASE_URL") || "https://api.asaas.com/v3").replace(/\/+$/, "");
    return remote("asaas", "Conta", `${base}/myAccount/accountNumber`,
        { access_token: key, Accept: "application/json", "User-Agent": "iMenu/1.0" });
}

async function mercadopago(): Promise<ProbeResult> {
    const key = configured("MERCADO_PAGO_ACCESS_TOKEN");
    if (!key) return missing("mercadopago", "Conta");
    return remote("mercadopago", "Conta", "https://api.mercadolibre.com/users/me",
        { Authorization: `Bearer ${key}` });
}

async function waha(): Promise<ProbeResult> {
    const base = configured("WAHA_API_URL");
    const key = configured("WAHA_API_KEY");
    if (!base || !key) return missing("waha", "Listar sessões");
    return remote("waha", "Listar sessões", `${base.replace(/\/+$/, "")}/api/sessions`,
        { "X-Api-Key": key, Accept: "application/json" });
}

async function openai(): Promise<ProbeResult> {
    const key = configured("OPENAI_API_KEY");
    if (!key) return missing("openai", "Modelos");
    // Listing models does not generate model tokens or images.
    return remote("openai", "Modelos", "https://api.openai.com/v1/models",
        { Authorization: `Bearer ${key}` });
}

const GEMINI_COST_ALERT_USD = 2;

// GPT-4.1 is the configured menu-import fallback model, but these organization
// charges can include other OpenAI uses; never present them as exact fallback spend.
async function geminiRelatedCost(): Promise<string> {
    const adminKey = configured("OPENAI_ADMIN_KEY");
    if (!adminKey) return "Custo GPT-4.1 não verificado: chave administrativa ausente.";
    const end = Math.floor(Date.now() / 86400000) * 86400;
    const start = end - 86400;
    const url = new URL("https://api.openai.com/v1/organization/costs");
    url.searchParams.set("start_time", String(start));
    url.searchParams.set("end_time", String(end));
    url.searchParams.set("bucket_width", "1d");
    url.searchParams.set("limit", "1");
    url.searchParams.append("group_by", "line_item");
    try {
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${adminKey}`, Accept: "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(8000),
        });
        if (!response.ok) return `Custo GPT-4.1 não verificado: HTTP ${response.status}.`;
        const payload = await response.json() as {
            data?: { start_time: number; results?: { line_item?: string; amount?: { value?: number; currency?: string } }[] }[];
            has_more?: boolean;
        };
        if (!Array.isArray(payload.data) || payload.has_more)
            return "Custo GPT-4.1 não verificado: resposta incompleta.";
        let usd = 0;
        for (const day of payload.data) {
            if (day.start_time < start || day.start_time >= end) continue;
            for (const item of day.results || []) {
                if (!/\bgpt-4\.1(?:-[0-9]{4}-[0-9]{2}-[0-9]{2})?(?![a-z0-9._-])/i.test(item.line_item || "")) continue;
                if (item.amount?.currency?.toLowerCase() !== "usd" || !Number.isFinite(item.amount.value)) continue;
                usd += Number(item.amount.value);
            }
        }
        if (usd >= GEMINI_COST_ALERT_USD) {
            const day = new Date(start * 1000).toISOString().slice(0, 10);
            await recordDevAlert({
                source: "gemini",
                title: "Gasto elevado com GPT-4.1 — possível fallback",
                message: `OpenAI cobrou US$ ${usd.toFixed(2)} pelo GPT-4.1 em ${day} (limite US$ ${GEMINI_COST_ALERT_USD.toFixed(2)}/dia). Pode incluir outros usos; confira os eventos de fallback da importação.`,
                severity: "warning",
                trigger: "notification",
                operation: "Gastos da importação de cardápio",
                incidentKey: `gemini:possible-fallback-cost:${day}`,
            });
        }
        return `GPT-4.1 ontem: US$ ${usd.toFixed(2)} (custo compartilhado).`;
    } catch {
        return "Custo GPT-4.1 não verificado: consulta indisponível.";
    }
}

async function gemini(): Promise<ProbeResult> {
    const key = configured("GEMINI_API_KEY");
    const model = configured("GEMINI_MENU_SCAN_MODEL") || "gemini-3.5-flash";
    const operation = "Modelo de importação de cardápio";
    const check = key
        ? await remote("gemini", operation,
            `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}`,
            { "x-goog-api-key": key, Accept: "application/json" })
        : { id: "gemini", operation, state: "failed" as const, status: null,
            detail: "GEMINI_API_KEY ausente: importações dependem da OpenAI." };

    let fallbacks: number | null = null;
    try {
        const result = await query<{ total: number }>(
            "SELECT COUNT(*)::int AS total FROM public.dev_alerts WHERE source='gemini' AND operation=$1 AND severity='info' AND created_at >= NOW() - INTERVAL '1 hour'",
            [GEMINI_FALLBACK_OPERATION]
        );
        fallbacks = Number(result.rows[0]?.total || 0);
    } catch { /* Preserve the provider result if monitoring storage is unavailable. */ }

    if (fallbacks !== null && fallbacks < GEMINI_FALLBACK_THRESHOLD && check.state === "connected")
        await resolveDevIncident(GEMINI_FALLBACK_INCIDENT);

    const cost = await geminiRelatedCost();
    return {
        ...check,
        state: check.state === "connected" && fallbacks !== null && fallbacks >= GEMINI_FALLBACK_THRESHOLD
            ? "degraded" : check.state,
        detail: [check.detail,
            fallbacks === null ? "Fallbacks não verificados." : `${fallbacks} fallback(s) na última hora.`,
            cost].join(" · "),
    };
}

async function posthog(): Promise<ProbeResult> {
    const config = getPostHogConfig();
    const operation = "Consulta de dados";
    if (!config) return missing("posthog", operation, "Sem chave de API pessoal para verificação autenticada.");

    // Test the query API used by dashboards; project settings requires project:read
    // even when query:read is sufficient for analytics.
    try {
        const response = await fetch(
            postHogApiHost(config.rawHost) + "/api/projects/" + encodeURIComponent(config.projectId) + "/query/",
            {
                method: "POST",
                headers: {
                    Authorization: "Bearer " + config.personalApiKey,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ query: { kind: "HogQLQuery", query: "SELECT 1" } }),
                cache: "no-store",
                signal: AbortSignal.timeout(12000),
            }
        );
        if (!response.ok) {
            await response.body?.cancel();
            return {
                id: "posthog", operation, state: "failed", status: response.status,
                detail: response.status === 403
                    ? "Consulta HTTP 403: verifique query:read e acesso ao projeto."
                    : "Consulta HTTP " + response.status,
            };
        }
        const body = await response.json() as { results?: unknown[][] };
        const ok = Array.isArray(body.results);
        return { id: "posthog", operation, state: ok ? "connected" : "failed",
            status: response.status,
            detail: ok ? "Consulta de dados: OK" : "Resposta de consulta inválida." };
    } catch {
        return { id: "posthog", operation, state: "failed", status: null,
            detail: "Falha de conexão ou tempo limite na consulta." };
    }
}

async function ntfy(): Promise<ProbeResult> {
    if (!configured("NTFY_TOPIC")) return missing("ntfy", "Servidor de notificações");
    const operation = "Servidor de notificações";
    // Official health endpoint; no synthetic push or phone notification.
    try {
        const response = await fetch("https://ntfy.sh/v1/health", {
            cache: "no-store", signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        if (!response.ok) {
            await response.body?.cancel();
            return { id: "ntfy", operation, state: "failed", status: response.status,
                detail: "Servidor de notificações: HTTP " + response.status };
        }
        const payload = await response.json() as { healthy?: boolean };
        if (payload.healthy !== true)
            return { id: "ntfy", operation, state: "failed", status: response.status,
                detail: "Servidor de notificações indisponível." };

        const latest = await query<{ phone_notified: boolean | null; delivery_error: string | null }>(
            "SELECT phone_notified,delivery_error FROM public.dev_alerts " +
            "WHERE trigger_type IN ('notification','alarm') AND source <> 'ntfy' " +
            "ORDER BY id DESC LIMIT 1"
        ).catch(() => ({ rows: [] as { phone_notified: boolean | null; delivery_error: string | null }[] }));
        const last = latest.rows[0];
        return {
            id: "ntfy", operation, status: response.status,
            state: last?.delivery_error ? "degraded" : "connected",
            detail: last?.delivery_error
                ? "Servidor saudável; último envio à API falhou."
                : last?.phone_notified
                    ? "Servidor saudável; último envio aceito pela API. Entrega ao aparelho não confirmada."
                    : "Servidor saudável; entrega ao aparelho não confirmada.",
        };
    } catch {
        return { id: "ntfy", operation, state: "failed", status: null,
            detail: "Servidor de notificações indisponível ou verificação expirou." };
    }
}

const DAILY_PROBE_MS = 24 * 60 * 60 * 1000;
const DAILY_GEOCODE_OPERATION = "Geocodificação autenticada diária";
const DAILY_ARCGIS_OPERATION = "Geocodificação pública diária";

// The cron can still run hourly without spending a geocoding request hourly.
// Legacy metadata/unverified checks are replaced on the first new run.
async function dailyGeocodeDue(id: "tomtom" | "arcgis"): Promise<boolean> {
    try {
        const previous = await query<{ checked_at: string; operation: string | null }>(
            "SELECT checked_at,operation FROM public.dev_integration_status WHERE source=$1 AND check_kind='probe'",
            [id]
        );
        const row = previous.rows[0];
        const operation = id === "arcgis" ? DAILY_ARCGIS_OPERATION : DAILY_GEOCODE_OPERATION;
        if (!row || row.operation !== operation) return true;
        const checkedAt = new Date(row.checked_at).getTime();
        return !Number.isFinite(checkedAt) || Date.now() - checkedAt >= DAILY_PROBE_MS;
    } catch {
        // Fail closed to avoid quota consumption if the DB cannot enforce cadence.
        return false;
    }
}

async function tomtom(): Promise<ProbeResult | null> {
    if (!(await dailyGeocodeDue("tomtom"))) return null;
    const key = configured("NEXT_PUBLIC_TOMTOM_API_KEY");
    const operation = DAILY_GEOCODE_OPERATION;
    if (!key) return missing("tomtom", operation, "Chave TomTom não configurada.");
    const url = new URL("https://api.tomtom.com/search/2/geocode/" +
        encodeURIComponent("Praça da Sé, São Paulo, SP") + ".json");
    url.searchParams.set("key", key);
    url.searchParams.set("countrySet", "BR");
    url.searchParams.set("limit", "1");
    try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) {
            await response.body?.cancel();
            return { id: "tomtom", operation, state: "failed", status: response.status,
                detail: "Geocodificação TomTom: HTTP " + response.status };
        }
        const body = await response.json() as { results?: unknown[] };
        const ok = Array.isArray(body.results) && body.results.length > 0;
        return { id: "tomtom", operation, status: response.status,
            state: ok ? "connected" : "failed",
            detail: ok ? "Geocodificação OK · 1 consulta diária." : "Resposta TomTom sem resultados." };
    } catch {
        return { id: "tomtom", operation, state: "failed", status: null,
            detail: "Geocodificação TomTom: falha de rede ou tempo limite." };
    }
}

async function arcgis(): Promise<ProbeResult | null> {
    if (!(await dailyGeocodeDue("arcgis"))) return null;
    const operation = DAILY_ARCGIS_OPERATION;
    const url = new URL("https://geocode.arcgis.com/arcgis/rest/services/World/GeocodeServer/findAddressCandidates");
    url.searchParams.set("SingleLine", "Praça da Sé, São Paulo, SP, Brasil");
    url.searchParams.set("sourceCountry", "BRA");
    url.searchParams.set("maxLocations", "1");
    url.searchParams.set("forStorage", "false");
    url.searchParams.set("f", "json");
    try {
        const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(8000) });
        if (!response.ok) {
            await response.body?.cancel();
            return { id: "arcgis", operation, state: "failed", status: response.status,
                detail: "Geocodificação ArcGIS: HTTP " + response.status };
        }
        const body = await response.json() as {
            candidates?: unknown[]; error?: { code?: number };
        };
        if (body.error) return {
            id: "arcgis", operation, state: "failed", status: body.error.code || response.status,
            detail: "Geocodificação ArcGIS: erro " + (body.error.code || "da API") + ".",
        };
        const ok = Array.isArray(body.candidates) && body.candidates.length > 0;
        return { id: "arcgis", operation, state: ok ? "connected" : "failed", status: response.status,
            detail: ok ? "Geocodificação pública OK · 1 consulta diária." : "Resposta ArcGIS sem resultados." };
    } catch {
        return { id: "arcgis", operation, state: "failed", status: null,
            detail: "Geocodificação ArcGIS: falha de rede ou tempo limite." };
    }
}

async function publicServices(): Promise<ProbeResult[]> {
    const [nominatim, brasilapi] = await Promise.all([
        remote("nominatim", "Status público", "https://nominatim.openstreetmap.org/status",
            { "User-Agent": "iMenu-health/1.0 (https://www.imenuapp.com.br)" }),
        remote("brasilapi", "Consulta CEP pública", "https://brasilapi.com.br/api/cep/v1/01001000"),
    ]);
    return [nominatim, brasilapi,
        missing("google", "Geocodificação", "Consulta de chave não executada para evitar cobrança.")];
}

export async function runIntegrationChecks(): Promise<ProbeResult[]> {
    // All checks are bounded; TomTom/ArcGIS use at most one geocode request each per 24h.
    const tasks = [asaas(), mercadopago(), supabase(), waha(), openai(), gemini(), posthog(), ntfy(), tomtom(), arcgis(), publicServices()];
    const completed = await Promise.allSettled(tasks);
    const results: ProbeResult[] = [];
    for (let index = 0; index < completed.length; index++) {
        const item = completed[index];
        if (item.status === "fulfilled") {
            if (item.value) results.push(...(Array.isArray(item.value) ? item.value : [item.value]));
        } else {
            const id = ["asaas", "mercadopago", "supabase", "waha", "openai", "gemini", "posthog", "ntfy", "tomtom", "arcgis", "public"][index];
            if (id !== "public") results.push({id,operation:"Verificação",state:"failed",status:null,detail:"Falha de rede ou tempo limite."});
        }
    }
    return Promise.all(results.map(recordIntegrationProbe));
}
