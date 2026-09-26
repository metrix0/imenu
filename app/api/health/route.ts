import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const CHECK_TIMEOUT_MS = 5_000;

function getSupabasePublicConfig(): { url: string; anonKey: string } {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim();
    const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) {
        throw new Error("Supabase public envs missing");
    }

    return {
        url: url.replace(/\/+$/, ""),
        anonKey,
    };
}

async function withTimeout<T>(
    promise: Promise<T>,
    timeoutMs: number,
    label: string
): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;

    try {
        return await Promise.race([
            promise,
            new Promise<T>((_, reject) => {
                timer = setTimeout(
                    () => reject(new Error(`${label} timed out`)),
                    timeoutMs
                );
            }),
        ]);
    } finally {
        if (timer) clearTimeout(timer);
    }
}

async function checkSupabaseEndpoint(
    url: string,
    anonKey: string,
    path: string
): Promise<void> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
        const response = await fetch(`${url}${path}`, {
            method: "GET",
            headers: {
                apikey: anonKey,
                Authorization: `Bearer ${anonKey}`,
            },
            cache: "no-store",
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`${path} returned HTTP ${response.status}`);
        }

        await response.body?.cancel();
    } finally {
        clearTimeout(timer);
    }
}

export async function GET() {
    const failures: string[] = [];

    try {
        const { url, anonKey } = getSupabasePublicConfig();

        const checks = await Promise.allSettled([
            withTimeout(
                query("SELECT 1 AS ok"),
                CHECK_TIMEOUT_MS,
                "database"
            ),
            checkSupabaseEndpoint(url, anonKey, "/rest/v1/"),
            checkSupabaseEndpoint(url, anonKey, "/auth/v1/settings"),
        ]);

        const labels = ["database", "data_api", "auth"];

        checks.forEach((result, index) => {
            if (result.status === "rejected") {
                const reason =
                    result.reason instanceof Error
                        ? result.reason.message
                        : String(result.reason);
                failures.push(`${labels[index]}: ${reason}`);
            }
        });
    } catch (error) {
        failures.push(
            error instanceof Error ? error.message : String(error)
        );
    }

    const ok = failures.length === 0;

    if (!ok) {
        console.error("[HEALTH] iMenu health check failed:", failures);
    }

    return NextResponse.json(
        { ok },
        {
            status: ok ? 200 : 503,
            headers: {
                "Cache-Control": "no-store, max-age=0",
            },
        }
    );
}
