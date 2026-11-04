import { createHash } from "node:crypto";
import { query } from "@/lib/database/sql";

export const INTEGRATIONS = [
    { id: "asaas", name: "Asaas", priority: 1, hosts: ["asaas.com"] },
    { id: "mercadopago", name: "Mercado Pago", priority: 1, hosts: ["mercadopago.com"] },
    { id: "payzu", name: "Payzu (legado)", priority: 1, hosts: ["payzu.io", "payzu.com.br", "api.payzu.processamento.com"] },
    { id: "supabase", name: "Supabase / Auth / Storage", priority: 1, hosts: ["supabase.co"] },
    { id: "waha", name: "WhatsApp / WAHA", priority: 2, hosts: [] },
    { id: "openai", name: "OpenAI", priority: 2, hosts: ["openai.com"] },
    { id: "posthog", name: "PostHog", priority: 3, hosts: ["posthog.com", "posthog.iomenu.com.br"] },
    { id: "google", name: "Google Geocoding", priority: 3, hosts: ["maps.googleapis.com"] },
    { id: "tomtom", name: "TomTom", priority: 3, hosts: ["api.tomtom.com"] },
    { id: "arcgis", name: "ArcGIS", priority: 3, hosts: ["arcgis.com"] },
    { id: "nominatim", name: "OpenStreetMap", priority: 3, hosts: ["nominatim.openstreetmap.org"] },
    { id: "brasilapi", name: "BrasilAPI / CEP", priority: 3, hosts: ["brasilapi.com.br", "viacep.com.br"] },
    { id: "ntfy", name: "Alertas no celular", priority: 2, hosts: ["ntfy.sh"] },
] as const;

type Observation = { ok: boolean; checkedAt: string; status: number | null };
const observations = new Map<string, Observation>();
const recordedAt = new Map<string, number>();

export function integrationForUrl(input: string): string | null {
    let url: URL;
    try { url = new URL(input); } catch { return null; }
    for (const integration of INTEGRATIONS) {
        if (integration.hosts.some(host => url.hostname === host || url.hostname.endsWith(`.${host}`))) return integration.id;
    }
    for (const [key, id] of [["WAHA_API_URL", "waha"], ["WAHA_BASE_URL", "waha"], ["WAHA_URL", "waha"], ["SUPABASE_URL", "supabase"], ["NEXT_PUBLIC_SUPABASE_URL", "supabase"], ["POSTHOG_HOST", "posthog"], ["NEXT_PUBLIC_POSTHOG_HOST", "posthog"]]) {
        try { if (process.env[key] && new URL(process.env[key]!).host === url.host) return id; } catch { /* Unconfigured provider. */ }
    }
    return null;
}

export async function recordDevAlert(input: { source: string; title: string; message: string; severity?: string; notification?: boolean }) {
    // No URLs, request bodies, tokens, or raw provider errors are recorded by the observer.
    const fingerprint = input.notification ? null : createHash("sha256").update(`${input.source}:${input.title}:${input.message}:${Math.floor(Date.now() / 300000)}`).digest("hex");
    if (fingerprint && recordedAt.has(fingerprint)) return;
    if (fingerprint) {
        if (recordedAt.size >= 128) recordedAt.clear();
        recordedAt.set(fingerprint, Date.now());
    }
    try {
        await query(`INSERT INTO public.dev_alerts(source,title,message,severity,fingerprint)
            VALUES($1,$2,$3,$4,$5) ON CONFLICT(fingerprint) DO NOTHING`,
        [input.source, input.title.slice(0, 200), input.message.slice(0, 4000), input.severity || "error", fingerprint]);
    } catch {
        // Observability must never fail or retry a payment, webhook, or notification.
    }
}

export function observeIntegration(source: string, ok: boolean, status: number | null) {
    observations.set(source, { ok, status, checkedAt: new Date().toISOString() });
    if (!ok) void recordDevAlert({ source, title: "Falha de conexão", message: status ? `HTTP ${status}` : "Falha de rede ou tempo limite." });
}

export function integrationObservations() {
    return INTEGRATIONS.map(item => ({ id: item.id, name: item.name, priority: item.priority, observation: observations.get(item.id) || null }));
}

export function installIntegrationObserver() {
    const root = globalThis as typeof globalThis & { __imenuDevObserver?: boolean };
    if (root.__imenuDevObserver) return;
    root.__imenuDevObserver = true;
    const original = globalThis.fetch;
    globalThis.fetch = async (input, init) => {
        const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
        const source = integrationForUrl(url);
        try {
            const response = await original(input, init);
            // 400/404 are often expected input/session validation, not outages.
            if (source && (response.ok || response.status >= 500 || [401, 402, 403, 429].includes(response.status))) {
                observeIntegration(source, response.ok, response.status);
            }
            if (source && response.ok && ["google", "arcgis"].includes(source)) {
                try {
                    const body = await response.clone().json();
                    if (body.error || ["OVER_QUERY_LIMIT", "OVER_DAILY_LIMIT", "REQUEST_DENIED", "UNKNOWN_ERROR"].includes(body.status)) observeIntegration(source, false, 200);
                } catch { /* Preserve the provider's existing parsing/error behavior. */ }
            }
            return response;
        } catch (error) {
            if (source) observeIntegration(source, false, null);
            throw error;
        }
    };
}
