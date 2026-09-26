import { createHmac, timingSafeEqual } from "node:crypto";

import { query } from "@/lib/database/sql";
import { getWahaWebhookHmacKey } from "@/lib/services/wahaClient";

type SupportConversation = {
    id: string;
    phone: string | null;
    restaurant_id: string | null;
    handoff_prompted_at: string | null;
};

type DataColumn = {
    column_name: string;
    data_type: string;
};

const BLOCKED_HANDOFF_PHONE = "5511913519119";

const BLOCKED_TABLES = new Set([
    "owner_push_subscriptions",
    "support_whatsapp_connection",
    "support_conversations",
    "support_messages",
    "support_knowledge",
]);

const SENSITIVE_COLUMN_PATTERNS = [
    /password/i,
    /secret/i,
    /token/i,
    /api[_-]?key/i,
    /auth/i,
    /cookie/i,
    /qr_code/i,
    /^payment_info$/i,
    /^payment_ref$/i,
    /^user_id$/i,
    /customer_(phone|email|address|name)/i,
    /^chat_id$/i,
    /^status_data$/i,
    /^provider_message_id$/i,
    /^pix_(qr_base64|copia_cola|address_key)$/i,
    /credential/i,
    /\bcpf\b/i,
    /\bcnpj\b/i,
];

export type SupportMcpToolDefinition = {
    name: string;
    description: string;
    inputSchema: Record<string, unknown>;
};

export const SUPPORT_MCP_TOOLS: SupportMcpToolDefinition[] = [
    {
        name: "search_knowledge",
        description:
            "Search the curated iMenu support knowledge base. Use this for product behavior, terminology, setup instructions and policies.",
        inputSchema: {
            type: "object",
            properties: { query: { type: "string" } },
            required: ["query"],
            additionalProperties: false,
        },
    },
    {
        name: "list_my_restaurants",
        description:
            "List iMenu restaurants matching this support conversation. By default uses the WhatsApp number; when the customer provides another phone, email, restaurant name or slug, pass it as identifier. An empty result means only that this search found no match; it does not prove the restaurant or account does not exist.",
        inputSchema: {
            type: "object",
            properties: { identifier: { type: "string" } },
            additionalProperties: false,
        },
    },
    {
        name: "select_restaurant",
        description:
            "Select one restaurant for this support conversation. If the restaurant was identified from an alternate phone, email, name or slug, pass that same value as identifier.",
        inputSchema: {
            type: "object",
            properties: {
                restaurant_id: { type: "string" },
                identifier: { type: "string" },
            },
            required: ["restaurant_id"],
            additionalProperties: false,
        },
    },
    {
        name: "list_restaurant_data_sources",
        description:
            "List restaurant-scoped database tables that are safe for support diagnostics. New restaurant-scoped tables are discovered automatically.",
        inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: "describe_restaurant_data_source",
        description:
            "List safe columns available in one restaurant-scoped data source.",
        inputSchema: {
            type: "object",
            properties: { table: { type: "string" } },
            required: ["table"],
            additionalProperties: false,
        },
    },
    {
        name: "query_restaurant_data",
        description:
            "Read rows from one safe restaurant-scoped data source. Every query is automatically locked to the restaurant selected for this conversation.",
        inputSchema: {
            type: "object",
            properties: {
                table: { type: "string" },
                columns: {
                    type: "array",
                    items: { type: "string" },
                },
                filters: {
                    type: "array",
                    items: {
                        type: "object",
                        properties: {
                            column: { type: "string" },
                            operator: {
                                type: "string",
                                enum: [
                                    "eq",
                                    "neq",
                                    "gt",
                                    "gte",
                                    "lt",
                                    "lte",
                                    "ilike",
                                    "is_null",
                                    "not_null",
                                ],
                            },
                            value: {},
                        },
                        required: ["column", "operator"],
                        additionalProperties: false,
                    },
                },
                order_by: { type: "string" },
                order_direction: {
                    type: "string",
                    enum: ["asc", "desc"],
                },
                limit: {
                    type: "integer",
                    minimum: 1,
                    maximum: 50,
                },
            },
            required: ["table"],
            additionalProperties: false,
        },
    },
    {
        name: "request_human_handoff",
        description:
            "Use when you understand from the conversation that the customer wants human support. Call at most once per customer turn. The first call records the up-to-1-business-day confirmation; only a later customer message that you interpret as a positive confirmation or renewed human-support request can complete the handoff.",
        inputSchema: {
            type: "object",
            properties: { reason: { type: "string" } },
            additionalProperties: false,
        },
    },
];

function normalizeSupportText(value: unknown): string {
    return String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
}

function phoneCandidates(value: string | null): string[] {
    let digits = String(value || "").replace(/\D/g, "");
    if (!digits) return [];

    if (digits.startsWith("0055")) digits = digits.slice(2);
    if (digits.startsWith("055") && digits.length >= 13) {
        digits = digits.slice(1);
    }
    if (
        digits.startsWith("0") &&
        (digits.length === 11 || digits.length === 12)
    ) {
        digits = digits.slice(1);
    }

    const values = new Set<string>();
    const addNational = (national: string) => {
        if (national.length !== 10 && national.length !== 11) return;
        values.add(national);
        values.add("55" + national);
    };

    if (
        digits.startsWith("55") &&
        (digits.length === 12 || digits.length === 13)
    ) {
        addNational(digits.slice(2));
    } else if (digits.length === 10 || digits.length === 11) {
        addNational(digits);
    } else {
        values.add(digits);
    }

    const nationalValues = [...values]
        .map((candidate) =>
            candidate.startsWith("55") &&
            (candidate.length === 12 || candidate.length === 13)
                ? candidate.slice(2)
                : candidate
        )
        .filter((candidate) => candidate.length === 10 || candidate.length === 11);

    for (const national of nationalValues) {
        if (national.length === 11 && national[2] === "9") {
            addNational(national.slice(0, 2) + national.slice(3));
        } else if (
            national.length === 10 &&
            /^[6-9]$/.test(national[2] || "")
        ) {
            addNational(national.slice(0, 2) + "9" + national.slice(2));
        }
    }

    return [...values];
}

async function getConversation(
    conversationId: string
): Promise<SupportConversation> {
    const result = await query<SupportConversation>(
        "SELECT id, phone, restaurant_id, handoff_prompted_at FROM support_conversations WHERE id = $1 LIMIT 1",
        [conversationId]
    );

    const conversation = result.rows[0];
    if (!conversation) throw new Error("Support conversation not found.");
    return conversation;
}

async function getRestaurantMatches(
    phone: string | null,
    identifier?: string
) {
    const lookup = String(identifier || "").trim();

    if (lookup) {
        const lookupDigits = lookup.replace(/\D/g, "");
        const lookupPhones =
            lookupDigits.length >= 8 ? phoneCandidates(lookup) : [];
        const result = await query<{
            id: string;
            name: string | null;
            url_slug: string | null;
        }>(
            `
                SELECT r.id, r.name, r.url_slug
                FROM restaurants r
                LEFT JOIN auth.users u ON u.id = r.user_id
                WHERE LOWER(COALESCE(u.email, '')) = LOWER($1)
                   OR LOWER(COALESCE(r.url_slug, '')) = LOWER($1)
                   OR r.name ILIKE $2
                   OR regexp_replace(COALESCE(r.phone, ''), '[^0-9]', '', 'g') = ANY($3::text[])
                   OR regexp_replace(COALESCE(r.store_whatsapp, ''), '[^0-9]', '', 'g') = ANY($3::text[])
                   OR regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g') = ANY($3::text[])
                ORDER BY
                    CASE
                        WHEN LOWER(COALESCE(u.email, '')) = LOWER($1) THEN 0
                        WHEN LOWER(COALESCE(r.url_slug, '')) = LOWER($1) THEN 1
                        WHEN LOWER(COALESCE(r.name, '')) = LOWER($1) THEN 2
                        ELSE 3
                    END,
                    r.name ASC NULLS LAST,
                    r.created_at ASC
                LIMIT 20
            `,
            [lookup, "%" + lookup + "%", lookupPhones]
        );

        return result.rows;
    }

    const candidates = phoneCandidates(phone);
    if (!candidates.length) return [];

    const result = await query<{
        id: string;
        name: string | null;
        url_slug: string | null;
    }>(
        `
            SELECT r.id, r.name, r.url_slug
            FROM restaurants r
            LEFT JOIN auth.users u ON u.id = r.user_id
            WHERE regexp_replace(COALESCE(r.phone, ''), '[^0-9]', '', 'g') = ANY($1::text[])
               OR regexp_replace(COALESCE(r.store_whatsapp, ''), '[^0-9]', '', 'g') = ANY($1::text[])
               OR regexp_replace(COALESCE(u.raw_user_meta_data->>'phone', ''), '[^0-9]', '', 'g') = ANY($1::text[])
            ORDER BY r.name ASC NULLS LAST, r.created_at ASC
            LIMIT 20
        `,
        [candidates]
    );

    return result.rows;
}

function isSensitiveColumn(column: string): boolean {
    return SENSITIVE_COLUMN_PATTERNS.some((pattern) => pattern.test(column));
}

async function listDataSources(): Promise<string[]> {
    const result = await query<{ table_name: string }>(
        "SELECT DISTINCT c.table_name FROM information_schema.columns c JOIN information_schema.tables t ON t.table_schema = c.table_schema AND t.table_name = c.table_name WHERE c.table_schema = 'public' AND c.column_name = 'restaurant_id' AND t.table_type = 'BASE TABLE' ORDER BY c.table_name"
    );

    const sources = result.rows
        .map((row) => row.table_name)
        .filter(
            (table) =>
                !table.startsWith("support_") && !BLOCKED_TABLES.has(table)
        );

    return [
        "restaurants",
        ...sources.filter((table) => table !== "restaurants"),
    ];
}

async function getSafeColumns(table: string): Promise<DataColumn[]> {
    const sources = await listDataSources();
    if (!sources.includes(table)) {
        throw new Error("Data source is not available to the support agent.");
    }

    const result = await query<DataColumn>(
        "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'public' AND table_name = $1 ORDER BY ordinal_position",
        [table]
    );

    return result.rows.filter((row) => !isSensitiveColumn(row.column_name));
}

function quoteIdentifier(value: string): string {
    return '"' + value.replace(/"/g, '""') + '"';
}

type QueryFilter = {
    column?: unknown;
    operator?: unknown;
    value?: unknown;
};

async function queryRestaurantData(
    conversation: SupportConversation,
    args: Record<string, unknown>
) {
    if (!conversation.restaurant_id) {
        return {
            error:
                "No restaurant is selected for this conversation. Use list_my_restaurants and select_restaurant first.",
        };
    }

    const table = String(args.table || "");
    const safeColumns = await getSafeColumns(table);
    const allowedColumns = new Set(
        safeColumns.map((row) => row.column_name)
    );

    const requestedColumns = Array.isArray(args.columns)
        ? args.columns
              .map(String)
              .filter((column) => allowedColumns.has(column))
        : [];

    const selectedColumns =
        requestedColumns.length > 0
            ? requestedColumns
            : safeColumns.slice(0, 30).map((row) => row.column_name);

    if (!selectedColumns.length) {
        throw new Error("No safe columns are available for this data source.");
    }

    const params: unknown[] = [conversation.restaurant_id];
    const where: string[] = [
        table === "restaurants"
            ? quoteIdentifier("id") + " = $1"
            : quoteIdentifier("restaurant_id") + " = $1",
    ];

    const filters = Array.isArray(args.filters)
        ? (args.filters as QueryFilter[])
        : [];

    for (const filter of filters.slice(0, 8)) {
        const column = String(filter.column || "");
        const operator = String(filter.operator || "");
        if (!allowedColumns.has(column)) continue;

        const identifier = quoteIdentifier(column);
        if (operator === "is_null") {
            where.push(identifier + " IS NULL");
            continue;
        }
        if (operator === "not_null") {
            where.push(identifier + " IS NOT NULL");
            continue;
        }

        const sqlOperator: Record<string, string> = {
            eq: "=",
            neq: "<>",
            gt: ">",
            gte: ">=",
            lt: "<",
            lte: "<=",
            ilike: "ILIKE",
        };
        const mapped = sqlOperator[operator];
        if (!mapped || filter.value === undefined) continue;

        params.push(
            operator === "ilike"
                ? "%" + String(filter.value ?? "") + "%"
                : filter.value
        );
        where.push(
            identifier + " " + mapped + " $" + String(params.length)
        );
    }

    const orderBy = String(args.order_by || "");
    const orderClause = allowedColumns.has(orderBy)
        ? " ORDER BY " +
          quoteIdentifier(orderBy) +
          " " +
          (String(args.order_direction || "desc") === "asc"
              ? "ASC"
              : "DESC") +
          " NULLS LAST"
        : "";

    const numericLimit = Number(args.limit);
    const limit = Math.min(
        50,
        Math.max(1, Number.isFinite(numericLimit) ? numericLimit : 20)
    );
    params.push(limit);

    const sql =
        "SELECT " +
        selectedColumns.map(quoteIdentifier).join(", ") +
        " FROM " +
        quoteIdentifier(table) +
        " WHERE " +
        where.join(" AND ") +
        orderClause +
        " LIMIT $" +
        String(params.length);

    const result = await query(sql, params);

    return {
        table,
        restaurant_id: conversation.restaurant_id,
        rows: result.rows,
    };
}

export function createSupportMcpToken(conversationId: string): string {
    return createHmac("sha256", getWahaWebhookHmacKey())
        .update("support-mcp:" + conversationId)
        .digest("hex");
}

export function verifySupportMcpToken(
    conversationId: string,
    token: string
): boolean {
    const expected = Buffer.from(
        createSupportMcpToken(conversationId),
        "utf8"
    );
    const received = Buffer.from(token, "utf8");

    return (
        received.length === expected.length &&
        timingSafeEqual(received, expected)
    );
}

export async function executeSupportMcpTool(
    conversationId: string,
    name: string,
    rawArgs: unknown
): Promise<unknown> {
    const args =
        rawArgs && typeof rawArgs === "object"
            ? (rawArgs as Record<string, unknown>)
            : {};
    const conversation = await getConversation(conversationId);

    if (name === "search_knowledge") {
        const search = String(args.query || "").trim();
        if (!search) return { results: [] };

        const stopWords = new Set([
            "como",
            "qual",
            "quais",
            "para",
            "com",
            "uma",
            "uns",
            "das",
            "dos",
            "que",
            "meu",
            "minha",
            "imenu",
            "funciona",
        ]);
        const terms = [
            ...new Set(
                search
                    .split(/\s+/)
                    .map((term) => term.replace(/[^\p{L}\p{N}-]/gu, ""))
                    .filter(
                        (term) =>
                            term.length >= 3 &&
                            !stopWords.has(
                                normalizeSupportText(term)
                            )
                    )
            ),
        ].slice(0, 6);
        const patterns = [
            "%" + search + "%",
            ...terms.map((term) => "%" + term + "%"),
        ];
        const clauses = patterns.map(
            (_, index) =>
                "(title ILIKE $" +
                String(index + 1) +
                " OR content ILIKE $" +
                String(index + 1) +
                ")"
        );

        const result = await query<{
            id: string;
            title: string;
            content: string;
        }>(
            "SELECT id, title, content FROM support_knowledge WHERE enabled = true AND (" +
                clauses.join(" OR ") +
                ") ORDER BY CASE WHEN title ILIKE $1 THEN 0 WHEN content ILIKE $1 THEN 1 ELSE 2 END, updated_at DESC LIMIT 8",
            patterns
        );

        return { results: result.rows };
    }

    if (name === "list_my_restaurants") {
        const identifier = String(args.identifier || "").trim();
        const restaurants = await getRestaurantMatches(
            conversation.phone,
            identifier
        );
        let selectedRestaurantId = conversation.restaurant_id;

        if (
            restaurants.length === 1 &&
            (!selectedRestaurantId || identifier)
        ) {
            selectedRestaurantId = restaurants[0].id;
            if (selectedRestaurantId !== conversation.restaurant_id) {
                await query(
                    "UPDATE support_conversations SET restaurant_id = $2, updated_at = NOW() WHERE id = $1",
                    [conversationId, selectedRestaurantId]
                );
            }
        }

        return {
            restaurants,
            selected_restaurant_id: selectedRestaurantId,
        };
    }

    if (name === "select_restaurant") {
        const restaurantId = String(args.restaurant_id || "");
        const identifier = String(args.identifier || "").trim();
        const available = await getRestaurantMatches(
            conversation.phone,
            identifier
        );
        if (!available.some((restaurant) => restaurant.id === restaurantId)) {
            return {
                error:
                    "This restaurant does not match the WhatsApp number or supplied identifier.",
            };
        }

        await query(
            "UPDATE support_conversations SET restaurant_id = $2, updated_at = NOW() WHERE id = $1",
            [conversationId, restaurantId]
        );

        return { selected_restaurant_id: restaurantId };
    }

    if (name === "list_restaurant_data_sources") {
        if (!conversation.restaurant_id) {
            return {
                error:
                    "No restaurant is selected for this conversation. Use list_my_restaurants first.",
            };
        }
        return { sources: await listDataSources() };
    }

    if (name === "describe_restaurant_data_source") {
        if (!conversation.restaurant_id) {
            return { error: "No restaurant is selected." };
        }

        const table = String(args.table || "");
        return {
            table,
            columns: await getSafeColumns(table),
        };
    }

    if (name === "query_restaurant_data") {
        return queryRestaurantData(conversation, args);
    }

    if (name === "request_human_handoff") {
        if (
            phoneCandidates(conversation.phone).includes(
                BLOCKED_HANDOFF_PHONE
            )
        ) {
            return {
                state: "blocked",
                handed_off: false,
                blocked: true,
                reason:
                    "Este contato não pode ser encaminhado para atendimento humano.",
            };
        }

        if (!conversation.handoff_prompted_at) {
            await query(
                "UPDATE support_conversations SET handoff_prompted_at = COALESCE(handoff_prompted_at, NOW()), updated_at = NOW() WHERE id = $1",
                [conversationId]
            );

            return {
                state: "prompted",
                handed_off: false,
                message:
                    "O suporte técnico especial pode levar até 1 dia útil. Mas posso te ajudar por enquanto, qual sua dúvida?",
            };
        }

        const latestInboundResult = await query<{ created_at: string }>(
            "SELECT created_at FROM support_messages WHERE conversation_id = $1 AND direction = 'inbound' ORDER BY created_at DESC LIMIT 1",
            [conversationId]
        );
        const latestInboundAt = latestInboundResult.rows[0]?.created_at
            ? new Date(latestInboundResult.rows[0].created_at).getTime()
            : 0;
        const promptedAt = new Date(
            conversation.handoff_prompted_at
        ).getTime();

        if (
            !Number.isFinite(latestInboundAt) ||
            !Number.isFinite(promptedAt) ||
            latestInboundAt <= promptedAt
        ) {
            return {
                state: "awaiting_confirmation",
                handed_off: false,
                reason:
                    "Aguarde uma nova mensagem do cliente antes de efetivar o encaminhamento.",
            };
        }

        await query(
            "UPDATE support_conversations SET mode = 'human', human_started_at = NOW(), last_human_reply_at = NULL, updated_at = NOW() WHERE id = $1",
            [conversationId]
        );

        return {
            state: "handed_off",
            handed_off: true,
            reason: String(args.reason || "").trim() || null,
            message:
                "A equipe de suporte já tem acesso à esta conversa e entrará em contato em breve neste chat. Para agilizarmos o atendimento, qual sua dúvida?",
        };
    }

    throw new Error("Unknown support MCP tool: " + name);
}
