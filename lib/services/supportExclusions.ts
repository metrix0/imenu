import { createHash } from "node:crypto";
import { query } from "@/lib/database/sql";

function hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

// One canonical Brazilian number, accepting national and older mobile forms.
export function normalizeSupportBlacklistPhone(value: string): string | null {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("0055")) digits = digits.slice(2);
    if (digits.startsWith("055") && digits.length >= 13) digits = digits.slice(1);
    if (digits.startsWith("0") && (digits.length === 11 || digits.length === 12)) digits = digits.slice(1);
    if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
    if (!/^55\d{10,11}$/.test(digits)) return null;
    if (digits.length === 12 && /^[6-9]$/.test(digits[4])) digits = digits.slice(0, 4) + "9" + digits.slice(4);
    return digits;
}

export function supportExclusionHashes(input: { phone?: string | null; chatId?: string | null }): string[] {
    const hashes = new Set<string>();
    const chat = String(input.chatId || "").trim().toLowerCase()
        .replace(/^imenu-blast:/, "").replace(/@s\.whatsapp\.net$/, "@c.us");
    if (chat) hashes.add(hash("chat:" + chat));
    const raw = String(input.phone || (chat.endsWith("@c.us") ? chat.split("@")[0] : "")).replace(/\D/g, "");
    const normalized = normalizeSupportBlacklistPhone(raw);
    if (normalized) {
        hashes.add(hash("phone:" + normalized));
        if (normalized.length === 13 && normalized[4] === "9" && /^[6-9]$/.test(normalized[5])) {
            hashes.add(hash("phone:" + normalized.slice(0, 4) + normalized.slice(5)));
        }
    } else if (raw) {
        hashes.add(hash("phone:" + raw));
    }
    return [...hashes];
}

export async function isSupportContactExcluded(input: {
    phone?: string | null; chatId?: string | null;
}): Promise<boolean> {
    const hashes = supportExclusionHashes(input);
    if (!hashes.length) return false;
    return (await query(
        "SELECT 1 FROM support_contact_exclusions WHERE identifier_hash = ANY($1::text[]) LIMIT 1",
        [hashes]
    )).rowCount > 0;
}

// Legacy protected identifiers intentionally have no display_phone. They remain
// hash-only and cannot be disclosed or removed via the ordinary blacklist UI.
export async function getSupportBlacklist() {
    const [contacts, protectedRows, protectedConversations] = await Promise.all([
        query<{ phone: string; created_at: string }>(
            "SELECT display_phone AS phone, created_at FROM support_contact_exclusions WHERE display_phone IS NOT NULL ORDER BY created_at DESC, display_phone"
        ),
        query<{ total: number }>(
            "SELECT COUNT(*)::int AS total FROM support_contact_exclusions WHERE display_phone IS NULL"
        ),
        query<{ total: number }>(`SELECT COUNT(*)::int AS total FROM support_conversations c WHERE NOT ${SUPPORT_CONVERSATION_VISIBLE_SQL}`),
    ]);
    return { contacts: contacts.rows, protectedIdentifiers: protectedRows.rows[0]?.total || 0, protectedConversations: protectedConversations.rows[0]?.total || 0 };
}

export async function addSupportBlacklistPhone(phone: string): Promise<void> {
    if (await isSupportContactExcluded({ phone })) return;
    await query(
        "INSERT INTO support_contact_exclusions (identifier_hash, display_phone) VALUES ($1, $2) ON CONFLICT (identifier_hash) DO NOTHING",
        [hash("phone:" + phone), phone]
    );
}

export async function removeSupportBlacklistPhone(phone: string): Promise<void> {
    await query(
        "DELETE FROM support_contact_exclusions WHERE identifier_hash = $1 AND display_phone = $2",
        [hash("phone:" + phone), phone]
    );
}

// Keep SQL filters consistent with the runtime contact matcher. Arguments are
// internal SQL column expressions, never user input.
export function supportBlacklistMatchSql(phoneSql: string, chatSql: string, protectedOnly = false): string {
    const chat = `regexp_replace(regexp_replace(lower(trim(COALESCE(${chatSql}, ''))), '^imenu-blast:', ''), '@s\\.whatsapp\\.net$', '@c.us')`;
    const raw = `regexp_replace(COALESCE(NULLIF(${phoneSql}, ''), CASE WHEN ${chat} LIKE '%@c.us' THEN split_part(${chat}, '@', 1) END, ''), '[^0-9]', '', 'g')`;
    const stripped = `(CASE WHEN ${raw} LIKE '0055%' THEN substr(${raw}, 3) WHEN ${raw} LIKE '055%' AND length(${raw}) >= 13 THEN substr(${raw}, 2) WHEN ${raw} LIKE '0%' AND length(${raw}) IN (11,12) THEN substr(${raw}, 2) ELSE ${raw} END)`;
    const national = `(CASE WHEN length(${stripped}) IN (10,11) THEN '55' || ${stripped} ELSE ${stripped} END)`;
    const alias = `(CASE WHEN ${national} ~ '^55[0-9]{2}[6-9][0-9]{7}$' THEN substr(${national},1,4) || '9' || substr(${national},5) WHEN ${national} ~ '^55[0-9]{2}9[6-9][0-9]{7}$' THEN substr(${national},1,4) || substr(${national},6) ELSE ${national} END)`;
    const sqlHash = (prefix: string, expr: string) => `encode(sha256(convert_to('${prefix}:' || ${expr}, 'UTF8')), 'hex')`;
    return `EXISTS (SELECT 1 FROM support_contact_exclusions e WHERE ${protectedOnly ? "e.display_phone IS NULL AND " : ""}e.identifier_hash IN (${sqlHash("chat", chat)}, ${sqlHash("phone", national)}, ${sqlHash("phone", alias)}))`;
}

export const SUPPORT_CONVERSATION_BLACKLISTED_SQL = supportBlacklistMatchSql("c.phone", "c.chat_id");
export const SUPPORT_CONVERSATION_VISIBLE_SQL = "NOT " + supportBlacklistMatchSql("c.phone", "c.chat_id", true);
