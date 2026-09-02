import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
    PayZuRequestError,
    transferPayzuToAsaas,
} from "@/lib/services/payzuPayout";

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

export async function POST(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;

    try {
        return NextResponse.json(await transferPayzuToAsaas());
    } catch (error) {
        const requestId =
            error instanceof PayZuRequestError ? error.requestId : undefined;
        const message =
            error instanceof Error ? error.message : "Erro interno.";

        console.error("[PAYZU_TO_ASAAS] Falha", {
            message,
            requestId,
        });

        return NextResponse.json(
            {
                success: false,
                error: message,
                ...(requestId ? { requestId } : {}),
            },
            { status: 500 }
        );
    }
}
