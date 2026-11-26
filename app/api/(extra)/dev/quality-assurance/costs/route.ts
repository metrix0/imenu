import { loadFeatureKeys } from "@/lib/api/openAiCostKeys";
import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { getUsdBrlRate } from "@/lib/ia-vendas/creditPricing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS = 30;
const CACHE_MS = 15 * 60 * 1000;

type CostResult = {
    amount?: { value?: number; currency?: string } | null;
    line_item?: string | null;
    api_key_id?: string | null;
};
type CostBucket = { start_time: number; results: CostResult[] };
type CostPage = {
    data?: CostBucket[];
    has_more?: boolean;
    next_page?: string | null;
};
type CostPayload = {
    status: "ok";
    period: { start: string; end: string; days: number };
    averageDaily7dUsd: number;
    usdBrlRate: number;
    totalUsd: number;
    daily: { date: string; usd: number }[];
    models: { id: string; dailyUsd: number[] }[];
    features: { id: string; dailyUsd: number[] }[];
    breakdown: { label: string; usd: number; share: number; usage: string }[];
};
let cached: { until: number; value: CostPayload } | null = null;

function lineItemMatchesModel(lineItem: string, model: string): boolean {
    if (!model) return false;
    const line = lineItem.toLowerCase();
    const name = model.toLowerCase();
    let index = line.indexOf(name);
    while (index !== -1) {
        const before = index === 0 ? "" : line[index - 1];
        const suffix = line.slice(index + name.length);
        // Billing uses dated model IDs, e.g. gpt-4.1-2025-04-14.
        // Non-date suffixes (e.g. "-transcribe") identify different models.
        const date = suffix.match(/^-[0-9]{4}-[0-9]{2}-[0-9]{2}(?=$|[^a-z0-9_.-])/);
        const after = date ? suffix[date[0].length] || "" : suffix[0] || "";
        if ((!before || !/[a-z0-9_.-]/.test(before)) &&
            (!after || !/[a-z0-9_.-]/.test(after))) return true;
        index = line.indexOf(name, index + 1);
    }
    return false;
}

function usageForLineItem(lineItem: string): string {
    // Model usage can span features; this is a code association, not exact
    // attribution of organization-wide OpenAI costs to individual features.
    const uses: Array<{ model: string; feature: string }> = [
        { model: process.env.IA_VENDAS_CHAT_MODEL?.trim() || "gpt-6-luna", feature: "Assistente IA — Chat; Vendas IA — Chat da análise" },
        { model: process.env.IA_VENDAS_ANALYSIS_MODEL?.trim() || "gpt-6.1-terra", feature: "Vendas IA — Análise via API" },
        { model: process.env.IA_VENDAS_IMAGE_MODEL?.trim() || "gpt-image-2", feature: "Assistente IA — Gerar imagens" },
        { model: process.env.OPENAI_WHATSAPP_BOT_MODEL?.trim() || "gpt-6-luna", feature: "Robô WhatsApp IA — Chat" },
        { model: process.env.OPENAI_SUPPORT_MODEL?.trim() || "gpt-6-luna", feature: "Suporte Chatbot IA — Chat e visão de imagens" },
        { model: process.env.OPENAI_SUPPORT_FOLLOWUP_MODEL?.trim() || "gpt-6-luna", feature: "Suporte Chatbot IA — Acompanhamento" },
        { model: "gpt-4o-mini-transcribe", feature: "Suporte Chatbot IA — Transcrever áudios" },
        { model: process.env.OPENAI_MENU_SCAN_MODEL?.trim() || "gpt-6-luna", feature: "Importação de Cardápio — Leitura IA" },
        { model: "gpt-5.6-luna", feature: "Assistente IA — Chat; Vendas IA — Chat da análise; Suporte Chatbot IA — Chat e visão de imagens" },
        { model: "gpt-5.6-terra", feature: "Vendas IA — Análise via API" },
        { model: "gpt-4o-mini", feature: "Robô WhatsApp IA — Chat; Suporte Chatbot IA — Acompanhamento" },
        { model: "gpt-4.1", feature: "Importação de Cardápio — Leitura IA" },
        { model: "text-embedding-3-small", feature: "Vendas IA — Comparação de cardápios" },
    ];
    const matched = uses
        .filter(({ model }) => lineItemMatchesModel(lineItem, model))
        .map(({ feature }) => feature);
    return matched.length
        ? Array.from(new Set(matched)).join("; ")
        : "Origem não identificada no iMenu.";
}

function modelFromLineItem(lineItem: string): string | undefined {
    // Batch prefixes and audio/image/text modalities belong to the same billed model.
    const label = lineItem.slice(lineItem.lastIndexOf("|") + 1).trim();
    const model = label.match(/^((?:gpt-|chatgpt-|o\d|text-embedding-|whisper-|tts-|dall-e-|sora-|omni-moderation-|codex-|computer-use-|ft:)[a-z0-9_.:-]*)(?:\s+(?:audio|image|text))?(?=\s*(?:,|$))/i);
    return model?.[1];
}

async function loadCosts(adminKey: string): Promise<CostPayload> {
    // Keep provider billing totals even if the key directory is temporarily unavailable.
    // Unmapped/shared/deleted keys are never guessed to belong to a specific feature.
    const featureKeys = await loadFeatureKeys(adminKey).catch(() => new Map<string, string>());
    // Complete UTC days, excluding the current (possibly incomplete) billing day.
    const end = Math.floor(Date.now() / 86400000) * 86400;
    const start = end - DAYS * 86400;
    const daily = new Map<string, number>();
    const categories = new Map<string, { usd: number; usage: string }>();
    const dailyByModel = new Map<string, Map<string, number>>();
    const dailyByFeature = new Map<string, Map<string, number>>();
    let page: string | null = null;
    let complete = false;

    for (let n = 0; n < 20; n++) {
        const url = new URL("https://api.openai.com/v1/organization/costs");
        url.searchParams.set("start_time", String(start));
        url.searchParams.set("end_time", String(end));
        url.searchParams.set("bucket_width", "1d");
        url.searchParams.set("limit", "31");
        url.searchParams.append("group_by", "line_item");
        url.searchParams.append("group_by", "api_key_id");
        if (page) url.searchParams.set("page", page);

        const response = await fetch(url, {
            headers: { Authorization: `Bearer ${adminKey}`, Accept: "application/json" },
            cache: "no-store",
            signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) throw new Error(`OpenAI Costs API HTTP ${response.status}`);
        const body = await response.json() as CostPage;
        if (!Array.isArray(body.data)) throw new Error("Invalid OpenAI Costs API response");

        for (const bucket of body.data) {
            if (!Number.isFinite(bucket.start_time) || !Array.isArray(bucket.results)) {
                throw new Error("Invalid OpenAI Costs API bucket");
            }
            if (bucket.start_time < start || bucket.start_time >= end) continue;
            const date = new Date(bucket.start_time * 1000).toISOString().slice(0, 10);
            for (const result of bucket.results) {
                const amount = result.amount;
                if (amount == null) continue;
                if (amount.currency?.toLowerCase() !== "usd" || !Number.isFinite(amount.value)) {
                    throw new Error("Unsupported OpenAI billing amount");
                }
                const usd = Number(amount.value);
                const label = result.line_item?.trim() || "Não categorizado";
                daily.set(date, (daily.get(date) || 0) + usd);
                const feature = result.api_key_id ? featureKeys.get(result.api_key_id) : undefined;
                const category = feature ? `OpenAI · ${feature}` : `Sem atribuição · ${label}`;
                const usage = feature ?? "Chave compartilhada ou não identificada. Uso possível: " + usageForLineItem(label);
                const featureDays = dailyByFeature.get(feature ?? "Sem atribuição") ?? new Map<string, number>();
                featureDays.set(date, (featureDays.get(date) ?? 0) + usd);
                dailyByFeature.set(feature ?? "Sem atribuição", featureDays);
                const previous = categories.get(category);
                categories.set(category, { usd: (previous?.usd ?? 0) + usd, usage });
                const model = modelFromLineItem(label);
                if (model) {
                    const modelDays = dailyByModel.get(model) ?? new Map<string, number>();
                    modelDays.set(date, (modelDays.get(date) ?? 0) + usd);
                    dailyByModel.set(model, modelDays);
                }
            }
        }
        if (!body.has_more) { complete = true; break; }
        if (!body.next_page || body.next_page === page) {
            throw new Error("OpenAI Costs API pagination incomplete");
        }
        page = body.next_page;
    }
    if (!complete) throw new Error("OpenAI Costs API pagination exceeded");

    const series = Array.from({ length: DAYS }, (_, i) => {
        const date = new Date((start + i * 86400) * 1000).toISOString().slice(0, 10);
        return { date, usd: daily.get(date) || 0 };
    });
    const totalUsd = series.reduce((sum, day) => sum + day.usd, 0);
    const breakdown = Array.from(categories, ([label, item]) => ({ label, ...item }))
        .filter(item => item.usd !== 0).sort((a, b) => b.usd - a.usd);
    const usdBrlRate = await getUsdBrlRate();

    return {
        status: "ok",
        usdBrlRate,
        period: {
            start: new Date(start * 1000).toISOString().slice(0, 10),
            end: new Date((end - 86400) * 1000).toISOString().slice(0, 10),
            days: DAYS,
        },
        averageDaily7dUsd: series.slice(-7).reduce((sum, day) => sum + day.usd, 0) / 7,
        totalUsd,
        daily: series,
        models: Array.from(dailyByModel.keys()).sort().map(id => ({
            id, dailyUsd: series.map(({ date }) => dailyByModel.get(id)?.get(date) ?? 0),
        })),
        features: Array.from(dailyByFeature.keys()).sort().map(id => ({
            id, dailyUsd: series.map(({ date }) => dailyByFeature.get(id)?.get(date) ?? 0),
        })),
        breakdown: breakdown.map(item => ({
            ...item, share: totalUsd === 0 ? 0 : (item.usd / totalUsd) * 100,
            usage: item.usage,
        })),
    };
}

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    // Admin key must remain server-only. Never fall back to a regular OpenAI API key.
    const key = process.env.OPENAI_ADMIN_KEY?.trim();
    if (!key) return NextResponse.json({ status: "unconfigured" }, {
        headers: { "Cache-Control": "no-store" },
    });

    try {
        if (cached && cached.until > Date.now()) {
            return NextResponse.json(cached.value, { headers: { "Cache-Control": "private, max-age=0" } });
        }
        const value = await loadCosts(key);
        cached = { value, until: Date.now() + CACHE_MS };
        return NextResponse.json(value, { headers: { "Cache-Control": "private, max-age=0" } });
    } catch (error) {
        console.error("[DEV_OPENAI_COSTS]", error instanceof Error ? error.message : "Unknown error");
        return NextResponse.json({ status: "unavailable" }, {
            headers: { "Cache-Control": "no-store" },
        });
    }
}
