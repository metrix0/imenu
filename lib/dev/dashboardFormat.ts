export function formatCount(value: number): string {
    return value.toLocaleString("pt-BR");
}

export function formatAverage(value: number): string {
    return value.toLocaleString("pt-BR", {
        minimumFractionDigits: value % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
    });
}

export function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    }).format(value / 100);
}

export function addonProductLabel(productKey: string): string {
    if (productKey === "ia_plus") return "iMenu Plus";
    if (productKey === "qr_code_mesa") return "QR Code Mesa";
    return productKey;
}

export function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    }).format(value);
}

export function formatRatio(value: number): string {
    return `${value.toLocaleString("pt-BR", {
        minimumFractionDigits: value % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
    })}%`;
}

export function conversion(current: number | null, previous: number | null): number | null {
    if (current === null || previous === null || previous <= 0) return null;
    return Number(((current / previous) * 100).toFixed(1));
}

export function formatDateRange(startAt: string, endAt: string): string {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

    return `${formatter.format(new Date(startAt))} – ${formatter.format(
        new Date(Math.max(0, new Date(endAt).getTime() - 1))
    )}`;
}

export function formatDateTime(value: string | null): string {
    if (!value) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

export function firstPhone(value: string | null): string {
    return value?.split(",")[0]?.trim() || "";
}

export function formatPhone(value: string | null): string {
    const original = firstPhone(value);
    let digits = original.replace(/\D/g, "");

    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        digits = digits.slice(2);
    }

    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return original || "—";
}

export function escapeMarkdownTableCell(value: string): string {
    return value.replace(/\r?\n/g, " ").replace(/\|/g, "\\|").trim();
}

export function normalizeWhatsappNumber(value: string | null): string | null {
    const original = firstPhone(value);
    let digits = original.replace(/\D/g, "");
    if (!digits) return null;

    if (digits.length === 10 || digits.length === 11) {
        digits = `55${digits}`;
    }

    return digits.length >= 12 ? digits : null;
}

export function formatRestaurantNameForMessage(value: string): string {
    const trimmed = value
        .replace(/[\u{1F1E6}-\u{1F1FF}\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\uFE0F\u200D\u20E3]/gu, "")
        .replace(/\s+/g, " ")
        .trim();
    const lowercase = trimmed.toLocaleLowerCase("pt-BR");
    const uppercase = trimmed.toLocaleUpperCase("pt-BR");

    if (trimmed !== lowercase && trimmed !== uppercase) return trimmed;

    const lowercaseWords = new Set([
        "da",
        "das",
        "de",
        "do",
        "dos",
        "e",
        "em",
        "na",
        "nas",
        "no",
        "nos",
    ]);

    return lowercase
        .split(/\s+/)
        .map((word, index) =>
            index > 0 && lowercaseWords.has(word)
                ? word
                : `${word.charAt(0).toLocaleUpperCase("pt-BR")}${word.slice(1)}`
        )
        .join(" ");
}
