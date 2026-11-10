import { createHash } from "node:crypto";
import { query } from "@/lib/database/sql";

function hash(value: string): string {
    return createHash("sha256").update(value).digest("hex");
}

export function supportExclusionHashes(input: { phone?: string | null; chatId?: string | null }): string[] {
    const hashes = new Set<string>();
    const chat = String(input.chatId || "").trim().toLowerCase()
        .replace(/^imenu-blast:/, "").replace(/@s\.whatsapp\.net$/, "@c.us");
    if (chat) hashes.add(hash("chat:" + chat));
    const raw = String(input.phone ||
        (chat.endsWith("@c.us") ? chat.split("@")[0] : "")).replace(/\D/g, "");
    if (raw) {
        const normalized = raw.length === 10 || raw.length === 11 ? "55" + raw : raw;
        hashes.add(hash("phone:" + normalized));
        if (normalized.startsWith("55") && normalized.length === 12 &&
            /^[6-9]$/.test(normalized[4] || "")) {
            hashes.add(hash("phone:" + normalized.slice(0, 4) + "9" + normalized.slice(4)));
        }
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

// The provider can retain excluded contacts; they are filtered only from dashboard views.
export const SUPPORT_CONVERSATION_VISIBLE_SQL = [
    "NOT EXISTS (SELECT 1 FROM support_contact_exclusions e WHERE",
    "e.identifier_hash = encode(sha256(convert_to('phone:' ||",
    "regexp_replace(COALESCE(c.phone,''), '[^0-9]', '', 'g'), 'UTF8')), 'hex')",
    "OR e.identifier_hash = encode(sha256(convert_to('chat:' ||",
    "replace(c.chat_id,'imenu-blast:',''), 'UTF8')), 'hex'))",
].join(" ");
