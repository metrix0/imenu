import { OPENAI_FEATURES } from "./openAiFeatureKeys";

type NamedApiKey = { id: string; name?: string | null };

async function listAdminObjects<T>(adminKey: string, endpoint: string): Promise<T[]> {
    const objects: T[] = [];
    let after: string | null = null;
    for (let n = 0; n < 100; n++) {
        const url = new URL("https://api.openai.com/v1/organization/" + endpoint);
        url.searchParams.set("limit", "100");
        if (after) url.searchParams.set("after", after);
        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${adminKey}`, Accept: "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`OpenAI key directory HTTP ${response.status}`);
        const body = await response.json() as { data?: T[]; has_more?: boolean; last_id?: string };
        if (!Array.isArray(body.data)) throw new Error("Invalid OpenAI key directory response");
        objects.push(...body.data);
        if (!body.has_more) return objects;
        if (!body.last_id || body.last_id === after) throw new Error("OpenAI key directory pagination incomplete");
        after = body.last_id;
    }
    throw new Error("OpenAI key directory pagination exceeded");
}

export async function loadFeatureKeys(adminKey: string): Promise<Map<string, string>> {
    const labels = new Map<string, string>(Object.values(OPENAI_FEATURES).map(feature => [feature.name, feature.label]));
    const keys = new Map<string, string>();
    const projects = await listAdminObjects<{ id: string }>(adminKey, "projects");
    for (const project of projects) {
        const projectKeys = await listAdminObjects<NamedApiKey>(adminKey, `projects/${encodeURIComponent(project.id)}/api_keys`);
        for (const key of projectKeys) {
            const label = key.name ? labels.get(key.name) : undefined;
            if (label) keys.set(key.id, label);
        }
    }
    return keys;
}

