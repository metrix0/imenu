import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import { query } from "@/lib/database/sql";
import { isUuid } from "@/lib/ia-vendas/catalog";

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

function toIso(value: string | Date): string {
    return new Date(value).toISOString();
}

export async function GET(request: Request) {
    const authorizationError = await authorize(request);
    if (authorizationError) return authorizationError;

    try {
        const url = new URL(request.url);
        const restaurantId = url.searchParams.get("restaurant_id");

        if (!restaurantId) {
            const restaurants = await query<{
                restaurant_id: string;
                restaurant_name: string | null;
                slug: string | null;
                conversation_count: number | string;
                message_count: number | string;
                last_message_at: string | Date;
            }>(
                `SELECT
                    r.id AS restaurant_id,
                    r.name AS restaurant_name,
                    r.url_slug AS slug,
                    COUNT(DISTINCT c.id)::int AS conversation_count,
                    COUNT(m.id)::int AS message_count,
                    MAX(m.created_at) AS last_message_at
                 FROM public.ia_vendas_conversations c
                 JOIN public.restaurants r ON r.id = c.restaurant_id
                 JOIN public.ia_vendas_messages m
                   ON m.conversation_id = c.id
                  AND m.restaurant_id = c.restaurant_id
                 WHERE c.kind = 'chat'
                 GROUP BY r.id, r.name, r.url_slug
                 ORDER BY MAX(m.created_at) DESC`
            );

            return NextResponse.json(
                {
                    restaurants: restaurants.rows.map((row) => ({
                        restaurantId: row.restaurant_id,
                        restaurantName: row.restaurant_name,
                        slug: row.slug,
                        conversationCount: Number(row.conversation_count) || 0,
                        messageCount: Number(row.message_count) || 0,
                        lastMessageAt: toIso(row.last_message_at),
                    })),
                },
                { headers: { "Cache-Control": "no-store" } }
            );
        }

        if (!isUuid(restaurantId)) {
            return NextResponse.json(
                { error: "Restaurante inválido." },
                { status: 400 }
            );
        }

        const restaurantResult = await query<{
            id: string;
            name: string | null;
            url_slug: string | null;
        }>(
            "SELECT id,name,url_slug FROM public.restaurants WHERE id=$1 LIMIT 1",
            [restaurantId]
        );
        const restaurant = restaurantResult.rows[0];

        if (!restaurant) {
            return NextResponse.json(
                { error: "Restaurante não encontrado." },
                { status: 404 }
            );
        }

        const conversationsResult = await query<{
            id: string;
            title: string | null;
            created_at: string | Date;
            updated_at: string | Date;
            last_message_at: string | Date;
        }>(
            `SELECT
                c.id,
                c.title,
                c.created_at,
                c.updated_at,
                MAX(m.created_at) AS last_message_at
             FROM public.ia_vendas_conversations c
             JOIN public.ia_vendas_messages m
               ON m.conversation_id = c.id
              AND m.restaurant_id = c.restaurant_id
             WHERE c.restaurant_id=$1
               AND c.kind='chat'
             GROUP BY c.id,c.title,c.created_at,c.updated_at
             ORDER BY MAX(m.created_at) DESC`,
            [restaurantId]
        );

        const conversationIds = conversationsResult.rows.map((row) => row.id);
        const messagesResult = conversationIds.length
            ? await query<{
                  id: string;
                  conversation_id: string;
                  role: string;
                  content: string;
                  created_at: string | Date;
              }>(
                  `SELECT id,conversation_id,role,content,created_at
                   FROM public.ia_vendas_messages
                   WHERE restaurant_id=$1
                     AND conversation_id=ANY($2::uuid[])
                   ORDER BY created_at ASC`,
                  [restaurantId, conversationIds]
              )
            : { rows: [] };

        const messagesByConversation = new Map<
            string,
            Array<{
                id: string;
                role: string;
                content: string;
                createdAt: string;
            }>
        >();

        for (const message of messagesResult.rows) {
            const messages =
                messagesByConversation.get(message.conversation_id) || [];
            messages.push({
                id: message.id,
                role: message.role,
                content: message.content,
                createdAt: toIso(message.created_at),
            });
            messagesByConversation.set(message.conversation_id, messages);
        }

        return NextResponse.json(
            {
                restaurant: {
                    id: restaurant.id,
                    name: restaurant.name,
                    slug: restaurant.url_slug,
                },
                conversations: conversationsResult.rows.map((row) => ({
                    id: row.id,
                    title: row.title || "Conversa",
                    createdAt: toIso(row.created_at),
                    updatedAt: toIso(row.updated_at),
                    lastMessageAt: toIso(row.last_message_at),
                    messages: messagesByConversation.get(row.id) || [],
                })),
            },
            { headers: { "Cache-Control": "no-store" } }
        );
    } catch (error) {
        console.error("[DEV_IA_ASSISTANT_CONVERSATIONS] Failed:", error);
        return NextResponse.json(
            { error: "Não foi possível carregar as conversas do Assistente IA." },
            { status: 500 }
        );
    }
}
