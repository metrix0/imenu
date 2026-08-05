import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { buildConsumerPipeline } from "@/lib/analytics/consumerPipeline";
import { loadPostHogConsumerMetrics } from "@/lib/analytics/posthogConsumer";
import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "America/Sao_Paulo";
const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type BoundsRow = {
    start_at: string | Date;
    end_at: string | Date;
};

type RestaurantRow = {
    url_slug: string | null;
    user_id: string | null;
};

type CountRow = {
    total: number | string;
};

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

function isDate(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

async function getAuthenticatedUserId(
    request: Request
): Promise<
    | { userId: string; email: string | null }
    | { response: NextResponse }
> {
    const accessToken = getBearerToken(request);

    if (!accessToken) {
        return {
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
            response: NextResponse.json(
                { error: "Sessão inválida ou expirada." },
                { status: 401 }
            ),
        };
    }

    return {
        userId: user.id,
        email: user.email?.trim().toLowerCase() || null,
    };
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const authentication = await getAuthenticatedUserId(request);
        if ("response" in authentication) return authentication.response;

        const { id } = await context.params;
        const searchParams = new URL(request.url).searchParams;
        const from = searchParams.get("from");
        const to = searchParams.get("to");

        if (!id || !isDate(from) || !isDate(to)) {
            return NextResponse.json(
                { error: "Restaurante e período são obrigatórios." },
                { status: 400 }
            );
        }

        const restaurantResult = await query<RestaurantRow>(
            `
                SELECT url_slug, user_id
                FROM restaurants
                WHERE id = $1
                LIMIT 1
            `,
            [id]
        );
        const restaurant = restaurantResult.rows[0];

        if (
            !restaurant ||
            (restaurant.user_id !== authentication.userId &&
                authentication.email !== ALLOWED_DEV_EMAIL)
        ) {
            return NextResponse.json(
                { error: "Acesso negado ao restaurante." },
                { status: 403 }
            );
        }

        const boundsResult = await query<BoundsRow>(
            `
                SELECT
                    ($1::date::timestamp AT TIME ZONE $3) AS start_at,
                    (($2::date + 1)::timestamp AT TIME ZONE $3) AS end_at
            `,
            [from, to, TIME_ZONE]
        );
        const bounds = boundsResult.rows[0];
        if (!bounds) throw new Error("Não foi possível calcular o período.");

        const startAt = new Date(bounds.start_at).getTime();
        const endAt = new Date(bounds.end_at).getTime();

        const [orderResult, tracking] = await Promise.all([
            query<CountRow>(
                `
                    SELECT COUNT(*)::int AS total
                    FROM orders
                    WHERE restaurant_id = $1
                      AND created_at >= $2
                      AND created_at < $3
                `,
                [id, new Date(startAt).toISOString(), new Date(endAt).toISOString()]
            ),
            loadPostHogConsumerMetrics(startAt, endAt, {
                restaurantId: id,
                restaurantSlug: restaurant.url_slug || "",
            }),
        ]);

        const ordersPlaced = Number(orderResult.rows[0]?.total) || 0;

        return NextResponse.json(
            {
                range: {
                    startAt: new Date(startAt).toISOString(),
                    endAt: new Date(endAt).toISOString(),
                },
                pipeline: buildConsumerPipeline(tracking, ordersPlaced),
                sources: tracking.sources,
                tracking: {
                    postHogAvailable: tracking.available,
                },
                generatedAt: new Date().toISOString(),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[CONSUMER_PIPELINE] Failed:", error);
        return NextResponse.json(
            { error: "Não foi possível carregar o funil do consumidor." },
            { status: 500 }
        );
    }
}
