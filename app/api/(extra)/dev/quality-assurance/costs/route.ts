import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DAYS = 30;
const CACHE_MS = 15 * 60 * 1000;

type CostResult = {
    amount?: { value?: number; currency?: string } | null;
    line_item?: string | null;
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
    averageDailyUsd: number;
    totalUsd: number;
    daily: { date: string; usd: number }[];
    breakdown: { label: string; usd: number; share: number }[];
};
let cached: { until: number; value: CostPayload } | null = null;

async function loadCosts(adminKey: string): Promise<CostPayload> {
    // Complete UTC days, excluding the current (possibly incomplete) billing day.
    const end = Math.floor(Date.now() / 86400000) * 86400;
    const start = end - DAYS * 86400;
    const daily = new Map<string, number>();
    const categories = new Map<string, number>();
    let page: string | null = null;
    let complete = false;

    for (let n = 0; n < 20; n++) {
        const url = new URL("https://api.openai.com/v1/organization/costs");
        url.searchParams.set("start_time", String(start));
        url.searchParams.set("end_time", String(end));
        url.searchParams.set("bucket_width", "1d");
        url.searchParams.set("limit", "31");
        url.searchParams.append("group_by", "line_item");
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
                categories.set(label, (categories.get(label) || 0) + usd);
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
    const sorted = Array.from(categories, ([label, usd]) => ({ label, usd }))
        .filter(item => item.usd !== 0).sort((a, b) => b.usd - a.usd);
    const top = sorted.slice(0, 9);
    if (sorted.length > 9) {
        top.push({ label: "Outros itens", usd: sorted.slice(9).reduce((sum, item) => sum + item.usd, 0) });
    }

    return {
        status: "ok",
        period: {
            start: new Date(start * 1000).toISOString().slice(0, 10),
            end: new Date((end - 86400) * 1000).toISOString().slice(0, 10),
            days: DAYS,
        },
        averageDailyUsd: totalUsd / DAYS,
        totalUsd,
        daily: series,
        breakdown: top.map(item => ({
            ...item, share: totalUsd === 0 ? 0 : (item.usd / totalUsd) * 100,
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
