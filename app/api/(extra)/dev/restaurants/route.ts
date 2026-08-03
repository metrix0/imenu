import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type RestaurantResult = {
    id: string;
    name: string;
    url_slug: string | null;
    phone: string | null;
    store_whatsapp: string | null;
    user_id: string | null;
};

function getBearerToken(request: Request): string | null {
    const authorization = request.headers.get("authorization")?.trim();
    if (!authorization) return null;

    const match = authorization.match(/^Bearer\s+(.+)$/i);
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

async function authorizeDevRequest(request: Request): Promise<
    | { ok: true }
    | { ok: false; response: NextResponse }
> {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Não autenticado." },
                { status: 401 }
            ),
        };
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
        return {
            ok: false,
            response: NextResponse.json(
                { error: "Sessão inválida ou expirada." },
                { status: 401 }
            ),
        };
    }

    if (user.email?.trim().toLowerCase() !== ALLOWED_DEV_EMAIL) {
        console.warn("[DEV_RESTAURANT_ACCESS] Access denied", {
            userId: user.id,
            email: user.email || null,
        });

        return {
            ok: false,
            response: NextResponse.json(
                { error: "Acesso negado." },
                { status: 403 }
            ),
        };
    }

    return { ok: true };
}

export async function GET(request: Request) {
    try {
        const authorization = await authorizeDevRequest(request);
        if (!authorization.ok) return authorization.response;

        const searchParams = new URL(request.url).searchParams;
        const search = searchParams.get("q")?.trim() || "";

        if (!search) {
            return NextResponse.json(
                { restaurants: [] },
                {
                    headers: {
                        "Cache-Control": "no-store",
                    },
                }
            );
        }

        const digits = search.replace(/\D/g, "");
        const namePattern = `%${search}%`;
        const phonePattern = digits ? `%${digits}%` : "";
        const idPattern = `${search}%`;

        const result = await query<RestaurantResult>(
            `
                SELECT
                    r.id,
                    r.name,
                    r.url_slug,
                    r.phone,
                    r.store_whatsapp,
                    r.user_id
                FROM restaurants AS r
                WHERE
                    r.id::text ILIKE $3
                    OR r.name ILIKE $1
                    OR (
                        $2 <> ''
                        AND regexp_replace(
                            COALESCE(r.phone, ''),
                            '[^0-9]',
                            '',
                            'g'
                        ) LIKE $2
                    )
                    OR (
                        $2 <> ''
                        AND regexp_replace(
                            COALESCE(r.store_whatsapp, ''),
                            '[^0-9]',
                            '',
                            'g'
                        ) LIKE $2
                    )
                ORDER BY
                    CASE
                        WHEN r.id::text = $4 THEN 0
                        WHEN LOWER(r.name) = LOWER($4) THEN 1
                        ELSE 2
                    END,
                    r.name ASC
                LIMIT 30
            `,
            [namePattern, phonePattern, idPattern, search]
        );

        return NextResponse.json(
            { restaurants: result.rows },
            {
                headers: {
                    "Cache-Control": "no-store",
                },
            }
        );
    } catch (error) {
        console.error("[DEV_RESTAURANT_ACCESS] Search failed:", error);

        return NextResponse.json(
            { error: "Não foi possível buscar os restaurantes." },
            { status: 500 }
        );
    }
}
