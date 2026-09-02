import { NextRequest, NextResponse } from "next/server";

import {
    RestaurantOwnerAuthError,
    requireRestaurantOwner,
} from "@/lib/auth/restaurantOwner";
import { query } from "@/lib/database/sql";
import {
    buildRestaurantTemplateVariables,
    getRestaurantTemplateData,
    getWhatsAppTemplateOverrides,
    getWhatsAppTemplates,
    mergeWhatsAppTemplates,
} from "@/lib/services/whatsappMessageTemplates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VARIABLE_LABELS: Record<string, string> = {
    NOME_DO_RESTAURANTE: "Nome do restaurante",
    NOME_DO_CLIENTE: "Nome do cliente",
    HORARIOS_DE_ABERTURA: "Horários de abertura",
    LINK_DO_CARDAPIO: "Link do cardápio",
    PEDIDO_MINIMO: "Pedido mínimo",
    INFORMACOES_DE_ENTREGA: "Informações de entrega",
    FORMAS_DE_PAGAMENTO: "Formas de pagamento",
    NUMERO_DO_PEDIDO: "Número do pedido",
    STATUS_DO_PEDIDO: "Status do pedido",
    LINK_DE_ACOMPANHAMENTO: "Link de acompanhamento",
};

function getRestaurantId(request: NextRequest): string {
    return request.nextUrl.searchParams.get("restaurantId")?.trim() || "";
}

function jsonError(error: unknown) {
    if (error instanceof RestaurantOwnerAuthError) {
        return NextResponse.json(
            { error: error.message },
            { status: error.status }
        );
    }

    console.error("[WHATSAPP_SETTINGS]", error);
    return NextResponse.json(
        { error: "Não foi possível atualizar as configurações do robô." },
        { status: 500 }
    );
}

export async function GET(request: NextRequest) {
    try {
        const restaurantId = getRestaurantId(request);
        if (!restaurantId) {
            return NextResponse.json(
                { error: "restaurantId is required" },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);
        const [restaurant, templates, conversationsResult] = await Promise.all([
            getRestaurantTemplateData(restaurantId),
            getWhatsAppTemplates(restaurantId),
            query<{
                chat_id: string;
                customer_name: string | null;
                last_owner_message_at: string | null;
                updated_at: string;
            }>(
                `
                    SELECT
                        chat_id,
                        customer_name,
                        last_owner_message_at,
                        updated_at
                    FROM whatsapp_conversations
                    WHERE restaurant_id = $1
                      AND mode = 'human'
                      AND (human_until IS NULL OR human_until > NOW())
                    ORDER BY updated_at DESC
                    LIMIT 50
                `,
                [restaurantId]
            ),
        ]);

        if (!restaurant) {
            return NextResponse.json(
                { error: "Restaurante não encontrado." },
                { status: 404 }
            );
        }

        const previewVariables = buildRestaurantTemplateVariables(restaurant);
        const variables = Object.entries(previewVariables).map(([key, value]) => ({
            key,
            label: VARIABLE_LABELS[key] || key,
            token: `{{${key}}}`,
            value,
        }));

        return NextResponse.json({
            templates,
            variables,
            conversations: conversationsResult.rows,
        });
    } catch (error) {
        return jsonError(error);
    }
}

export async function PUT(request: NextRequest) {
    try {
        const restaurantId = getRestaurantId(request);
        if (!restaurantId) {
            return NextResponse.json(
                { error: "restaurantId is required" },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);
        const body = await request.json();
        const overrides = getWhatsAppTemplateOverrides(body?.templates);
        if (!overrides) {
            return NextResponse.json(
                { error: "Revise as mensagens antes de salvar." },
                { status: 400 }
            );
        }

        if (Object.keys(overrides).length === 0) {
            await query(
                `DELETE FROM whatsapp_bot_settings WHERE restaurant_id = $1`,
                [restaurantId]
            );
        } else {
            await query(
                `
                    INSERT INTO whatsapp_bot_settings (
                        restaurant_id,
                        message_templates,
                        updated_at
                    )
                    VALUES ($1, $2::jsonb, NOW())
                    ON CONFLICT (restaurant_id)
                    DO UPDATE SET
                        message_templates = EXCLUDED.message_templates,
                        updated_at = NOW()
                `,
                [restaurantId, JSON.stringify(overrides)]
            );
        }

        return NextResponse.json({
            ok: true,
            templates: mergeWhatsAppTemplates(overrides),
        });
    } catch (error) {
        return jsonError(error);
    }
}

export async function PATCH(request: NextRequest) {
    try {
        const restaurantId = getRestaurantId(request);
        if (!restaurantId) {
            return NextResponse.json(
                { error: "restaurantId is required" },
                { status: 400 }
            );
        }

        await requireRestaurantOwner(request, restaurantId);
        const body = await request.json();
        const chatId = typeof body?.chatId === "string" ? body.chatId.trim() : "";
        if (!chatId) {
            return NextResponse.json(
                { error: "Conversa inválida." },
                { status: 400 }
            );
        }

        const result = await query(
            `
                UPDATE whatsapp_conversations
                SET mode = 'bot', human_until = NULL, updated_at = NOW()
                WHERE restaurant_id = $1
                  AND chat_id = $2
                  AND mode = 'human'
                RETURNING chat_id
            `,
            [restaurantId, chatId]
        );

        if (!result.rowCount) {
            return NextResponse.json(
                { error: "Conversa não encontrada." },
                { status: 404 }
            );
        }

        console.info("[WHATSAPP_AUTOMATION] bot_resumed", { restaurantId });
        return NextResponse.json({ ok: true });
    } catch (error) {
        return jsonError(error);
    }
}
