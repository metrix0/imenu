export type BulkInputRecipient = {
    phone: string;
    values: Record<string, string>;
};

function splitMarkdownTableRow(line: string): string[] {
    let row = line.trim();
    if (row.startsWith("|")) row = row.slice(1);
    if (row.endsWith("|")) row = row.slice(0, -1);

    const cells: string[] = [];
    let current = "";

    for (let index = 0; index < row.length; index += 1) {
        if (row[index] === "\\" && row[index + 1] === "|") {
            current += "|";
            index += 1;
            continue;
        }
        if (row[index] === "|") {
            cells.push(current.trim());
            current = "";
            continue;
        }
        current += row[index];
    }

    cells.push(current.trim());
    return cells;
}

function normalizeBulkHeader(value: string): string {
    return value
        .trim()
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "");
}

function cleanBulkValue(value: string): string {
    return value
        .trim()
        .replace(/\*\*(.*?)\*\*/g, "$1")
        .replace(/__(.*?)__/g, "$1")
        .replace(/`([^`]*)`/g, "$1")
        .trim();
}

export function parseBulkRecipients(value: string): BulkInputRecipient[] {
    const lines = value.split(/\r?\n/).filter((line) => line.trim());
    const separatorIndex = lines.findIndex((line, index) => {
        if (index === 0) return false;
        const cells = splitMarkdownTableRow(line);
        return (
            cells.length > 0 &&
            cells.every((cell) =>
                /^:?-{3,}:?$/.test(cell.replace(/\s/g, ""))
            )
        );
    });

    if (separatorIndex > 0) {
        const headers = splitMarkdownTableRow(lines[separatorIndex - 1]).map(
            cleanBulkValue
        );
        const phoneIndex = headers.findIndex((header) => {
            const normalized = normalizeBulkHeader(header);
            return (
                normalized.includes("whatsapp") ||
                normalized.includes("telefone") ||
                normalized === "phone" ||
                normalized === "numero" ||
                normalized === "number"
            );
        });

        if (phoneIndex >= 0) {
            const seen = new Set<string>();
            const recipients: BulkInputRecipient[] = [];

            for (const line of lines.slice(separatorIndex + 1)) {
                if (!line.includes("|")) continue;
                const cells = splitMarkdownTableRow(line);
                const phone = cleanBulkValue(cells[phoneIndex] || "");
                const digits = phone.replace(/\D/g, "");
                if (!digits || seen.has(digits)) continue;
                seen.add(digits);

                recipients.push({
                    phone,
                    values: Object.fromEntries(
                        headers.map((header, index) => [
                            header,
                            cleanBulkValue(cells[index] || ""),
                        ])
                    ),
                });
            }

            return recipients;
        }
    }

    const seen = new Set<string>();
    return value
        .split(/\r?\n|[,;]/)
        .map((phone) => phone.trim())
        .filter((phone) => {
            const digits = phone.replace(/\D/g, "");
            if (!digits || seen.has(digits)) return false;
            seen.add(digits);
            return true;
        })
        .map((phone) => ({ phone, values: {} }));
}

export function parseBulkPhones(value: string): string[] {
    return parseBulkRecipients(value).map((recipient) => recipient.phone);
}

export function renderBulkMessage(
    template: string,
    values: Record<string, string>
): string {
    const normalizedValues = new Map(
        Object.entries(values).map(([key, value]) => [
            normalizeBulkHeader(key),
            value.trim(),
        ])
    );

    return template.replace(
        /\{\{\s*([^{}|]+?)\s*(?:\|\|\s*([^{}]*?)\s*)?\}\}/g,
        (_match, key: string, fallback = "") => {
            const normalizedKey = normalizeBulkHeader(key);
            const value =
                normalizedValues.get(normalizedKey) ||
                (normalizedKey === "cidade" ? normalizedValues.get("city") : "") ||
                (normalizedKey === "city" ? normalizedValues.get("cidade") : "") ||
                "";
            if (value && value !== "—" && value !== "-") return value;

            const fallbackValue = fallback.trim();
            if (fallbackValue) {
                const quoted = fallbackValue.match(/^(["'])([\s\S]*)\1$/);
                if (quoted && quoted[2].trim()) return quoted[2];

                const variable =
                    normalizedValues.get(normalizeBulkHeader(fallbackValue)) || "";
                if (variable && variable !== "—" && variable !== "-") return variable;
            }

            throw new Error(`Campo "${key.trim()}" vazio ou ausente na tabela. Corrija antes do envio.`);
        }
    );
}
