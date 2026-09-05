export type DeliveryFeeMode = "radius" | "neighborhood";

export type NeighborhoodDeliveryRule = {
    neighborhood: string;
    city?: string | null;
    state?: string | null;
    time_minutes: number;
    fee_cents: number;
    aliases?: string[];
};

const WORD_ALIASES: Record<string, string> = {
    jd: "jardim",
    jdim: "jardim",
    vl: "vila",
    pq: "parque",
    pque: "parque",
    res: "residencial",
    resid: "residencial",
    cj: "conjunto",
    conj: "conjunto",
    st: "setor",
};

export function normalizeNeighborhoodName(value: unknown): string {
    const normalized = String(value ?? "")
        .trim()
        .toLocaleLowerCase("pt-BR")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, " ")
        .replace(/^bairro\s+/, "")
        .trim()
        .replace(/\s+/g, " ");

    if (!normalized) return "";

    return normalized
        .split(" ")
        .map((word) => WORD_ALIASES[word] || word)
        .join(" ");
}

function normalizeCity(value: unknown): string {
    return normalizeNeighborhoodName(value);
}

function normalizeState(value: unknown): string {
    return String(value ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase();
}

export function parseNeighborhoodDeliveryRules(
    value: unknown
): NeighborhoodDeliveryRule[] {
    let source = value;

    if (typeof source === "string") {
        try {
            source = JSON.parse(source);
        } catch {
            return [];
        }
    }

    if (!Array.isArray(source)) return [];

    return source.flatMap((raw): NeighborhoodDeliveryRule[] => {
        if (!raw || typeof raw !== "object" || Array.isArray(raw)) return [];

        const rule = raw as Record<string, unknown>;
        const neighborhood = String(
            rule.neighborhood ?? rule.bairro ?? ""
        ).trim();
        const timeMinutes = Number(rule.time_minutes ?? rule.tempo_minutos ?? 0);
        const feeCents = Number(
            rule.fee_cents ??
                (rule.taxa !== undefined ? Number(rule.taxa) * 100 : NaN)
        );

        if (
            !neighborhood ||
            !Number.isFinite(timeMinutes) ||
            timeMinutes < 0 ||
            !Number.isFinite(feeCents) ||
            feeCents < 0
        ) {
            return [];
        }

        return [
            {
                neighborhood,
                city: String(rule.city ?? rule.cidade ?? "").trim() || null,
                state: String(rule.state ?? rule.estado ?? "").trim() || null,
                time_minutes: Math.round(timeMinutes),
                fee_cents: Math.round(feeCents),
                aliases: Array.isArray(rule.aliases)
                    ? rule.aliases
                          .map((alias) => String(alias).trim())
                          .filter(Boolean)
                    : [],
            },
        ];
    });
}

export function findNeighborhoodDeliveryRule(
    rulesValue: unknown,
    neighborhood: unknown,
    city?: unknown,
    state?: unknown
): NeighborhoodDeliveryRule | null {
    const rules = parseNeighborhoodDeliveryRules(rulesValue);
    const targetNeighborhood = normalizeNeighborhoodName(neighborhood);
    const targetCity = normalizeCity(city);
    const targetState = normalizeState(state);

    if (!targetNeighborhood) return null;

    for (const rule of rules) {
        const names = [rule.neighborhood, ...(rule.aliases || [])]
            .map(normalizeNeighborhoodName)
            .filter(Boolean);

        if (!names.includes(targetNeighborhood)) continue;

        const ruleCity = normalizeCity(rule.city);
        if (ruleCity && targetCity && ruleCity !== targetCity) continue;
        if (ruleCity && !targetCity) continue;

        const ruleState = normalizeState(rule.state);
        if (ruleState && targetState && ruleState !== targetState) continue;
        if (ruleState && !targetState) continue;

        return rule;
    }

    return null;
}
