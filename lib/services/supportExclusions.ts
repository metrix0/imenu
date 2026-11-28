import { query } from "@/lib/database/sql";

// Store one canonical Brazilian number per contact.
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

export async function isSupportContactExcluded(input: {
    phone?: string | null; chatId?: string | null;
}): Promise<boolean> {
    const chat = String(input.chatId || "").trim().toLowerCase()
        .replace(/^imenu-blast:/, "").replace(/@s\.whatsapp\.net$/, "@c.us");
    const phones = [...new Set([
        normalizeSupportBlacklistPhone(input.phone || ""),
        normalizeSupportBlacklistPhone(chat.endsWith("@c.us") ? chat.split("@")[0] : ""),
    ].filter((value): value is string => Boolean(value)))];
    if (!phones.length) return false;
    return (await query(
        "SELECT 1 FROM support_blacklist WHERE phone = ANY($1::text[]) LIMIT 1",
        [phones]
    )).rowCount > 0;
}

export async function getSupportBlacklist() {
    const result = await query<{ phone: string; created_at: string }>(
        "SELECT phone, created_at FROM support_blacklist ORDER BY created_at DESC, phone"
    );
    return { contacts: result.rows };
}

export async function addSupportBlacklistPhone(phone: string): Promise<void> {
    await query("INSERT INTO support_blacklist (phone) VALUES ($1) ON CONFLICT (phone) DO NOTHING", [phone]);
}

export async function removeSupportBlacklistPhone(phone: string): Promise<void> {
    await query("DELETE FROM support_blacklist WHERE phone = $1", [phone]);
}

// Internal SQL column expressions only. Match the same phone variants as above.
export function supportBlacklistMatchSql(phoneSql: string, chatSql: string): string {
    const chat = `regexp_replace(regexp_replace(lower(trim(COALESCE(${chatSql}, ''))), '^imenu-blast:', ''), '@s\\.whatsapp\\.net$', '@c.us')`;
    const canonical = (expr: string) => {
        const raw = `regexp_replace(COALESCE(${expr}, ''), '[^0-9]', '', 'g')`;
        const stripped = `(CASE WHEN ${raw} LIKE '0055%' THEN substr(${raw}, 3) WHEN ${raw} LIKE '055%' AND length(${raw}) >= 13 THEN substr(${raw}, 2) WHEN ${raw} LIKE '0%' AND length(${raw}) IN (11,12) THEN substr(${raw}, 2) ELSE ${raw} END)`;
        const national = `(CASE WHEN length(${stripped}) IN (10,11) THEN '55' || ${stripped} ELSE ${stripped} END)`;
        return `(CASE WHEN ${national} ~ '^55[0-9]{2}[6-9][0-9]{7}$' THEN substr(${national},1,4) || '9' || substr(${national},5) ELSE ${national} END)`;
    };
    return `EXISTS (SELECT 1 FROM support_blacklist b WHERE b.phone IN (${canonical(phoneSql)}, ${canonical(`CASE WHEN ${chat} LIKE '%@c.us' THEN split_part(${chat}, '@', 1) END`)}))`;
}

export const SUPPORT_CONVERSATION_BLACKLISTED_SQL = supportBlacklistMatchSql("c.phone", "c.chat_id");
