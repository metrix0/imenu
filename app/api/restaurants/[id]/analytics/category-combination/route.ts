import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const TIME_ZONE = "America/Sao_Paulo";
const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type BoundsRow = { start_at: string | Date; end_at: string | Date };
type RestaurantRow = { user_id: string | null };
type CategoryRow = {
    id: string;
    name: string;
    orders: number | string;
};
type CategorySetRow = {
    category_ids: string[] | string;
    orders: number | string;
};
type TotalRow = { total_orders: number | string };

function isDate(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function numberValue(value: number | string | null | undefined): number {
    return Number(value) || 0;
}

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

async function getAuthenticatedUser(
    request: Request
): Promise<
    { userId: string; email: string | null } | { response: NextResponse }
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

function parseCategoryIds(value: string[] | string): string[] {
    if (Array.isArray(value)) return value.map(String);
    const trimmed = String(value || "").trim();
    if (!trimmed || trimmed === "{}") return [];
    return trimmed
        .replace(/^\{/, "")
        .replace(/\}$/, "")
        .split(",")
        .map((item) => item.replace(/^"|"$/g, "").trim())
        .filter(Boolean);
}

export async function GET(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const authentication = await getAuthenticatedUser(request);
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
            `SELECT user_id FROM restaurants WHERE id = $1 LIMIT 1`,
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
            `SELECT ($1::date::timestamp AT TIME ZONE $3) AS start_at, (($2::date + 1)::timestamp AT TIME ZONE $3) AS end_at`,
            [from, to, TIME_ZONE]
        );
        const bounds = boundsResult.rows[0];
        if (!bounds) throw new Error("Não foi possível calcular o período.");

        const rangeParams = [
            id,
            new Date(bounds.start_at).toISOString(),
            new Date(bounds.end_at).toISOString(),
        ];

        const [categoriesResult, categorySetsResult, totalResult] =
            await Promise.all([
                query<CategoryRow>(
                    `
                    SELECT
                        c.id::text AS id,
                        c.name,
                        COUNT(DISTINCT o.id)::int AS orders
                    FROM orders o
                    INNER JOIN order_items oi ON oi.order_id = o.id
                    INNER JOIN items i ON i.id = oi.item_id
                    INNER JOIN categories c ON c.id = i.category_id
                    WHERE o.restaurant_id = $1
                      AND o.created_at >= $2
                      AND o.created_at < $3
                      AND o.status = 'done'
                    GROUP BY c.id, c.name
                    ORDER BY orders DESC, c.name ASC
                    `,
                    rangeParams
                ),
                query<CategorySetRow>(
                    `
                    WITH order_category_sets AS (
                        SELECT
                            o.id AS order_id,
                            ARRAY_AGG(
                                DISTINCT c.id::text
                                ORDER BY c.id::text
                            ) AS category_ids
                        FROM orders o
                        INNER JOIN order_items oi ON oi.order_id = o.id
                        INNER JOIN items i ON i.id = oi.item_id
                        INNER JOIN categories c ON c.id = i.category_id
                        WHERE o.restaurant_id = $1
                          AND o.created_at >= $2
                          AND o.created_at < $3
                          AND o.status = 'done'
                        GROUP BY o.id
                    )
                    SELECT
                        category_ids,
                        COUNT(*)::int AS orders
                    FROM order_category_sets
                    GROUP BY category_ids
                    ORDER BY orders DESC
                    `,
                    rangeParams
                ),
                query<TotalRow>(
                    `
                    SELECT COUNT(*)::int AS total_orders
                    FROM orders
                    WHERE restaurant_id = $1
                      AND created_at >= $2
                      AND created_at < $3
                      AND status = 'done'
                    `,
                    rangeParams
                ),
            ]);

        return NextResponse.json(
            {
                categories: categoriesResult.rows.map((row) => ({
                    id: String(row.id),
                    name: row.name,
                    orders: numberValue(row.orders),
                })),
                categorySets: categorySetsResult.rows.map((row) => ({
                    categoryIds: parseCategoryIds(row.category_ids),
                    orders: numberValue(row.orders),
                })),
                totalOrders: numberValue(totalResult.rows[0]?.total_orders),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[ANALYTICS CATEGORY COMBINATION] Failed:", error);
        return NextResponse.json(
            { error: "Não foi possível carregar combinações de categorias." },
            { status: 500 }
        );
    }
}
