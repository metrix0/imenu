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
    if (!config) return missing("posthog", "Projeto", "Sem chave de API pessoal para verificação autenticada.");
    return remote("posthog", "Projeto",
        `${postHogApiHost(config.rawHost)}/api/projects/${encodeURIComponent(config.projectId)}/`,
        { Authorization: `Bearer ${config.personalApiKey}` });
}

async function ntfy(): Promise<ProbeResult> {
    if (!configured("NTFY_TOPIC")) return missing("ntfy", "Servidor de notificações");
    // Read-only reachability; never send a test notification.
    const result = await remote("ntfy", "Servidor de notificações", "https://ntfy.sh/");
    return result.state === "connected"
        ? { ...result, state: "degraded", detail: "Servidor acessível; entrega ao celular não testada." }
        : result;
}

async function publicServices(): Promise<ProbeResult[]> {
    const [nominatim, brasilapi, arcgis] = await Promise.all([
        remote("nominatim", "Status público", "https://nominatim.openstreetmap.org/status",
            { "User-Agent": "iMenu-health/1.0 (https://www.imenuapp.com.br)" }),
        remote("brasilapi", "Consulta CEP pública", "https://brasilapi.com.br/api/cep/v1/01001000"),
        remote("arcgis", "Metadados públicos", "https://geocode-api.arcgis.com/arcgis/rest/services/World/GeocodeServer?f=json"),
    ]);
    arcgis.state = arcgis.state === "connected" ? "degraded" : "unverified";
    arcgis.detail = arcgis.state === "degraded" ? "API pública acessível; chave de geocodificação não testada." : "Metadados públicos indisponíveis; autenticação não testada.";
    return [nominatim, brasilapi, arcgis,
        missing("google", "Geocodificação", "Consulta de chave não executada para evitar cobrança."),
        missing("tomtom", "Geocodificação", "Consulta de chave não executada para evitar cobrança.")];
}

export async function runIntegrationChecks(): Promise<ProbeResult[]> {
    // Each read-only check is bounded; no provider writes, paid lookups or outgoing WhatsApp.
    const tasks = [asaas(), mercadopago(), supabase(), waha(), openai(), gemini(), posthog(), ntfy(), publicServices()];
    const completed = await Promise.allSettled(tasks);
    const results: ProbeResult[] = [];
    for (let index = 0; index < completed.length; index++) {
        const item = completed[index];
        if (item.status === "fulfilled") {
            results.push(...(Array.isArray(item.value) ? item.value : [item.value]));
        } else {
            const id = ["asaas", "mercadopago", "supabase", "waha", "openai", "gemini", "posthog", "ntfy", "public"][index];
            if (id !== "public") results.push({id,operation:"Verificação",state:"failed",status:null,detail:"Falha de rede ou tempo limite."});
        }
    }
    return Promise.all(results.map(recordIntegrationProbe));
}
