import { query } from "@/lib/database/sql";
import { DEV_PAGE_SIZE, devPage, paged } from "./pagination";

export type MessageCategory = "all" | "followup" | "congratulations" | "automation";

export type DevMessage = {
    id: string;
    category: Exclude<MessageCategory, "all">;
    subtype: string | null;
    created_at: string;
    sent_at: string | null;
    phone: string | null;
    restaurant: string | null;
    message: string | null;
    status: string;
    error: string | null;
};

const MESSAGES = `WITH messages AS (
    SELECT 'followup:' || m.id::text AS id, 'followup'::text AS category,
           NULL::text AS subtype, m.created_at, NULL::timestamptz AS sent_at,
           c.phone, COALESCE(r.name, c.customer_name) AS restaurant,
           m.body AS message, COALESCE(m.send_status, 'pending') AS status, m.error
    FROM support_messages m
    JOIN support_conversations c ON c.id = m.conversation_id
    LEFT JOIN restaurants r ON r.id = c.restaurant_id
    WHERE m.direction = 'outbound' AND m.dedupe_key LIKE 'support:followup:%'
    UNION ALL
    SELECT 'congratulations:' || o.dedupe_key, 'congratulations'::text,
           NULL::text, o.created_at, o.sent_at,
           split_part(o.chat_id, '@', 1), r.name,
           NULLIF(o.context->>'message', ''), o.status, o.last_error
    FROM whatsapp_outbound_messages o
    LEFT JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.dedupe_key LIKE 'support:addon-purchase:%'
    UNION ALL
    SELECT 'automation:' || o.dedupe_key, 'automation'::text,
           o.automation_type, o.created_at, o.sent_at,
           COALESCE(NULLIF(o.customer_phone, ''), split_part(o.chat_id, '@', 1)),
           r.name, NULLIF(o.context->>'message', ''), o.status, o.last_error
    FROM whatsapp_outbound_messages o
    LEFT JOIN restaurants r ON r.id = o.restaurant_id
    WHERE o.automation_type IN ('cart', 'reactivation', 'habit')
)`;

export async function getMessageHistory(params: URLSearchParams) {
    const page = devPage(params);
    const requested = params.get("type");
    const category: MessageCategory =
        requested === "followup" || requested === "congratulations" || requested === "automation"
            ? requested : "all";
    const [rows, count] = await Promise.all([
        query<DevMessage>(
            `${MESSAGES} SELECT * FROM messages WHERE ($1::text = 'all' OR category = $1)
             ORDER BY created_at DESC, id DESC LIMIT $2 OFFSET $3`,
            [category, DEV_PAGE_SIZE, page * DEV_PAGE_SIZE]
        ),
        query<{ total: number }>(
            `${MESSAGES} SELECT COUNT(*)::int AS total FROM messages WHERE ($1::text = 'all' OR category = $1)`,
            [category]
        ),
    ]);
    return paged(rows.rows, Number(count.rows[0]?.total || 0), page);
}
