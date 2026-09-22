import { createHmac, timingSafeEqual } from "node:crypto";

import { query } from "@/lib/database/sql";
import { getWahaWebhookHmacKey } from "@/lib/services/wahaClient";

type SupportConversation = {
    id: string;
    phone: string | null;
    restaurant_id: string | null;
};

type DataColumn = {
    column_name: string;
    data_type: string;
};

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
            "List iMenu restaurants associated with the WhatsApp number in this support conversation.",
        inputSchema: {
            type: "object",
            properties: {},
            additionalProperties: false,
        },
    },
    {
        name: "select_restaurant",
        description:
            "Select one restaurant for this support conversation. The restaurant must belong to the WhatsApp number already associated with the conversation.",
        inputSchema: {
            type: "object",
            properties: { restaurant_id: { type: "string" } },
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
            "Hand this conversation to a human iMenu support agent.",
        inputSchema: {
            type: "object",
            properties: { reason: { type: "string" } },
            additionalProperties: false,
        },
    },
];

function phoneCandidates(value: string | null): string[] {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return [];

    const values = new Set<string>([digits]);
    if (
        digits.startsWith("55") &&
        (digits.length === 12 || digits.length === 13)
    ) {
        values.add(digits.slice(2));
    } else if (digits.length === 10 || digits.length === 11) {
        values.add("55" + digits);
    }
    return [...values];
}

async function getConversation(
    conversationId: string
): Promise<SupportConversation> {
    const result = await query<SupportConversation>(
        "SELECT id, phone, restaurant_id FROM support_conversations WHERE id = $1 LIMIT 1",
        [conversationId]
    );

    const conversation = result.rows[0];
    if (!conversation) throw new Error("Support conversation not found.");
    return conversation;
}

async function getPhoneRestaurants(phone: string | null) {
    const candidates = phoneCandidates(phone);
    if (!candidates.length) return [];

    const result = await query<{
        id: string;
        name: string | null;
        url_slug: string | null;
    }>(
        "SELECT id, name, url_slug FROM restaurants WHERE regexp_replace(COALESCE(phone, ''), '[^0-9]', '', 'g') = ANY($1::text[]) OR regexp_replace(COALESCE(store_whatsapp, ''), '[^0-9]', '', 'g') = ANY($1::text[]) ORDER BY name ASC NULLS LAST, created_at ASC LIMIT 20",
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

        const pattern = "%" + search + "%";
        const result = await query<{
            id: string;
            title: string;
            content: string;
        }>(
            "SELECT id, title, content FROM support_knowledge WHERE enabled = true AND (title ILIKE $1 OR content ILIKE $1) ORDER BY CASE WHEN title ILIKE $1 THEN 0 ELSE 1 END, updated_at DESC LIMIT 8",
            [pattern]
        );

        return { results: result.rows };
    }

    if (name === "list_my_restaurants") {
        return {
            restaurants: await getPhoneRestaurants(conversation.phone),
            selected_restaurant_id: conversation.restaurant_id,
        };
    }

    if (name === "select_restaurant") {
        const restaurantId = String(args.restaurant_id || "");
        const available = await getPhoneRestaurants(conversation.phone);
        if (!available.some((restaurant) => restaurant.id === restaurantId)) {
            return {
                error:
                    "This restaurant is not associated with the WhatsApp number in this conversation.",
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
        await query(
            "UPDATE support_conversations SET mode = 'human', updated_at = NOW() WHERE id = $1",
            [conversationId]
        );

        return {
            handed_off: true,
            reason: String(args.reason || "").trim() || null,
        };
    }

    throw new Error("Unknown support MCP tool: " + name);
}
