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

const ROMAN_NUMERALS: Record<string, string> = {
    i: "1",
    ii: "2",
    iii: "3",
    iv: "4",
    v: "5",
    vi: "6",
    vii: "7",
    viii: "8",
    ix: "9",
    x: "10",
};

const NEIGHBORHOOD_SIMILARITY_THRESHOLD = 0.85;

const BRAZILIAN_STATE_NAMES: Record<string, string> = {
    ACRE: "AC",
    ALAGOAS: "AL",
    AMAPA: "AP",
    AMAZONAS: "AM",
    BAHIA: "BA",
    CEARA: "CE",
    DISTRITOFEDERAL: "DF",
    ESPIRITOSANTO: "ES",
    GOIAS: "GO",
    MARANHAO: "MA",
    MATOGROSSO: "MT",
    MATOGROSSODOSUL: "MS",
    MINASGERAIS: "MG",
    PARA: "PA",
    PARAIBA: "PB",
    PARANA: "PR",
    PERNAMBUCO: "PE",
    PIAUI: "PI",
    RIODEJANEIRO: "RJ",
    RIOGRANDEDONORTE: "RN",
    RIOGRANDEDOSUL: "RS",
    RONDONIA: "RO",
    RORAIMA: "RR",
    SANTACATARINA: "SC",
    SAOPAULO: "SP",
    SERGIPE: "SE",
    TOCANTINS: "TO",
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

function normalizeNeighborhoodForSimilarity(value: unknown): string {
    return normalizeNeighborhoodName(value)
        .split(" ")
        .map((word) => ROMAN_NUMERALS[word] || word)
        .join(" ");
}

function levenshteinDistance(left: string, right: string): number {
    const previous = Array.from(
        { length: right.length + 1 },
        (_, index) => index
    );

    for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
        const current = [leftIndex];

        for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
            const cost =
                left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1;

            current[rightIndex] = Math.min(
                current[rightIndex - 1] + 1,
                previous[rightIndex] + 1,
                previous[rightIndex - 1] + cost
            );
        }

        for (let index = 0; index < current.length; index += 1) {
            previous[index] = current[index];
        }
    }

    return previous[right.length];
}

export function neighborhoodNameSimilarity(
    leftValue: unknown,
    rightValue: unknown
): number {
    const left = normalizeNeighborhoodForSimilarity(leftValue);
    const right = normalizeNeighborhoodForSimilarity(rightValue);

    if (!left || !right) return 0;
    if (left === right) return 1;

    const leftNumbers = left.split(" ").filter((word) => /^\d+$/.test(word));
    const rightNumbers = right
        .split(" ")
        .filter((word) => /^\d+$/.test(word));

    if (
        (leftNumbers.length > 0 || rightNumbers.length > 0) &&
        leftNumbers.join("|") !== rightNumbers.join("|")
    ) {
        return 0;
    }

    const longestLength = Math.max(left.length, right.length);
    return 1 - levenshteinDistance(left, right) / longestLength;
}

function normalizeCity(value: unknown): string {
    return normalizeNeighborhoodName(value);
}

function normalizeState(value: unknown): string {
    const normalized = String(value ?? "")
        .trim()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-zA-Z]/g, "")
        .toUpperCase();

    return BRAZILIAN_STATE_NAMES[normalized] || normalized;
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


export function findSimilarNeighborhoodDeliveryRule(
    rulesValue: unknown,
    neighborhood: unknown,
    city?: unknown,
    state?: unknown,
    minimumSimilarity = NEIGHBORHOOD_SIMILARITY_THRESHOLD
): NeighborhoodDeliveryRule | null {
    const rules = parseNeighborhoodDeliveryRules(rulesValue);
    const targetCity = normalizeCity(city);
    const targetState = normalizeState(state);
    let bestMatch: NeighborhoodDeliveryRule | null = null;
    let bestSimilarity = -1;

    for (const rule of rules) {
        const ruleCity = normalizeCity(rule.city);
        if (ruleCity && targetCity && ruleCity !== targetCity) continue;
        if (ruleCity && !targetCity) continue;

        const ruleState = normalizeState(rule.state);
        if (ruleState && targetState && ruleState !== targetState) continue;
        if (ruleState && !targetState) continue;

        const similarity = Math.max(
            ...[rule.neighborhood, ...(rule.aliases || [])].map((name) =>
                neighborhoodNameSimilarity(name, neighborhood)
            )
        );

        if (
            similarity >= minimumSimilarity &&
            similarity > bestSimilarity
        ) {
            bestMatch = rule;
            bestSimilarity = similarity;
        }
    }

    return bestMatch;
}
