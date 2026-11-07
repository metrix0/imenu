import { query } from "@/lib/database/sql";
import { getPostHogConfig, postHogApiHost } from "@/lib/analytics/posthogQuery";
import { recordIntegrationProbe, type ProbeResult } from "@/lib/dev/health";

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
    const tasks = [asaas(), mercadopago(), supabase(), waha(), openai(), posthog(), ntfy(), publicServices()];
    const completed = await Promise.allSettled(tasks);
    const results: ProbeResult[] = [];
    for (let index = 0; index < completed.length; index++) {
        const item = completed[index];
        if (item.status === "fulfilled") {
            results.push(...(Array.isArray(item.value) ? item.value : [item.value]));
        } else {
            const id = ["asaas", "mercadopago", "supabase", "waha", "openai", "posthog", "ntfy", "public"][index];
            if (id !== "public") results.push({id,operation:"Verificação",state:"failed",status:null,detail:"Falha de rede ou tempo limite."});
        }
    }
    return Promise.all(results.map(recordIntegrationProbe));
}
