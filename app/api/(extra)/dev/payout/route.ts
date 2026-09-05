import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
    getPayoutDashboardData,
    PayoutValidationError,
    sendPayouts,
} from "@/lib/services/payouts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

function getBearerToken(request: Request): string | null {
    const authorization = request.headers.get("authorization")?.trim();
    const match = authorization?.match(/^Bearer\s+(.+)$/i);
    return match?.[1]?.trim() || null;
}

function getSupabasePublicConfig(): { url: string; anonKey: string } {
    const url =
        process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
        process.env.SUPABASE_URL?.trim();
    const anonKey =
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
        process.env.SUPABASE_ANON_KEY?.trim();

    if (!url || !anonKey) {
        throw new Error("Supabase public environment variables are missing.");
    }

    return { url, anonKey };
}

async function authorize(request: Request): Promise<NextResponse | null> {
    const accessToken = getBearerToken(request);
    if (!accessToken) {
        return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    }

    const { url, anonKey } = getSupabasePublicConfig();
    const authClient = createClient(url, anonKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
            detectSessionInUrl: false,
        },
    });

    const {
        data: { user },
        error,
    } = await authClient.auth.getUser(accessToken);

    if (error || !user) {
        return NextResponse.json(
            { error: "Sessão inválida ou expirada." },
            { status: 401 }
        );
    }

    if (user.email?.trim().toLowerCase() !== ALLOWED_DEV_EMAIL) {
        return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
    }

    return null;
}

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    try {
        const data = await getPayoutDashboardData();
        return NextResponse.json({
            ...data,
            automationRuns: data.automationRuns.map((run: any) => ({
                ...run,
                run_date: new Date(run.run_date).toISOString().slice(0, 10),
            })),
        });
    } catch (error) {
        console.error("[DEV PAYOUT] Falha ao carregar:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro interno." },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    let body: {
        discountPercent?: unknown;
        adjustToOnePercent?: unknown;
        amounts?: unknown;
    };
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
    }

    const adjustToOnePercent = body.adjustToOnePercent === true;
    const discountPercent = Number(body.discountPercent ?? 0.75);
    const amountOverrides =
        body.amounts &&
        typeof body.amounts === "object" &&
        !Array.isArray(body.amounts)
            ? (body.amounts as Record<string, unknown>)
            : {};

    try {
        return NextResponse.json(
            await sendPayouts({
                cutoffAt: new Date(),
                discountPercent,
                adjustToOnePercent,
                amountOverrides,
            })
        );
    } catch (error) {
        if (error instanceof PayoutValidationError) {
            return NextResponse.json(
                { error: error.message, ...error.details },
                { status: error.status }
            );
        }

        console.error("[DEV PAYOUT] Falha ao enviar:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Erro interno." },
            { status: 500 }
        );
    }
}
