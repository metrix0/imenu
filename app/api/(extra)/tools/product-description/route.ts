import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";
const GROQ_MODELS = ["openai/gpt-oss-120b", "openai/gpt-oss-20b"] as const;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_REQUESTS = 8;
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const MAX_CACHE_ENTRIES = 100;

type DescriptionInput = {
    name: string;
    details: string;
    category: string;
    tone: string;
    differential: string;
};

type DescriptionResult = {
    descriptions: string[];
    shortDescription: string;
    keywords: string[];
};

type GroqPayload = {
    choices?: Array<{ message?: { content?: string | null } }>;
};

type RateLimitEntry = { count: number; resetAt: number };

let nextKeyOffset = 0;
const rateLimits = new Map<string, RateLimitEntry>();
const responseCache = new Map<string, { expiresAt: number; result: DescriptionResult }>();

function textField(value: unknown, maxLength: number): string {
    return typeof value === "string"
        ? value.replace(/\s+/g, " ").trim().slice(0, maxLength)
        : "";
}

function parseInput(value: unknown): DescriptionInput | null {
    if (!value || typeof value !== "object") return null;
    const body = value as Record<string, unknown>;
    const input = {
        name: textField(body.name, 100),
        details: textField(body.details, 800),
        category: textField(body.category, 80),
        tone: textField(body.tone, 40),
        differential: textField(body.differential, 200),
    };

    if (input.name.length < 2 || input.details.length < 5) return null;
    return input;
}

function getGroqKeys(): string[] {
    return Array.from({ length: 8 }, (_, index) =>
        process.env[`GROQ_API_KEY_${index + 1}`]?.trim()
    ).filter((key): key is string => Boolean(key));
}

function rotateKeys(keys: string[]): string[] {
    if (!keys.length) return [];
    const offset = nextKeyOffset % keys.length;
    nextKeyOffset = (nextKeyOffset + 1) % keys.length;
    return [...keys.slice(offset), ...keys.slice(0, offset)];
}

function requestIp(request: Request): string {
    return (
        request.headers.get("x-real-ip") ||
        request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
        "unknown"
    );
}

function isRateLimited(identifier: string): boolean {
    const now = Date.now();
    const current = rateLimits.get(identifier);

    if (!current || current.resetAt <= now) {
        rateLimits.set(identifier, {
            count: 1,
            resetAt: now + RATE_LIMIT_WINDOW_MS,
        });
        return false;
    }

    if (current.count >= RATE_LIMIT_REQUESTS) return true;
    current.count += 1;
    return false;
}

function isSameOrigin(request: Request): boolean {
    const origin = request.headers.get("origin");
    const host = request.headers.get("host");
    if (!origin || !host) return true;

    try {
        return new URL(origin).host === host;
    } catch {
        return false;
    }
}

function getCached(cacheKey: string): DescriptionResult | null {
    const cached = responseCache.get(cacheKey);
    if (!cached) return null;
    if (cached.expiresAt <= Date.now()) {
        responseCache.delete(cacheKey);
        return null;
    }
    return cached.result;
}

function setCached(cacheKey: string, result: DescriptionResult) {
    if (responseCache.size >= MAX_CACHE_ENTRIES) {
        const firstKey = responseCache.keys().next().value;
        if (typeof firstKey === "string") responseCache.delete(firstKey);
    }
    responseCache.set(cacheKey, {
        expiresAt: Date.now() + CACHE_TTL_MS,
        result,
    });
}

function parseGroqResult(payload: GroqPayload): DescriptionResult | null {
    const content = payload.choices?.[0]?.message?.content;
    if (!content) return null;

    try {
        const parsed = JSON.parse(content) as Record<string, unknown>;
        const descriptions = Array.isArray(parsed.descriptions)
            ? parsed.descriptions
                  .filter((value): value is string => typeof value === "string")
                  .map((value) => value.trim().slice(0, 500))
                  .filter(Boolean)
                  .slice(0, 3)
            : [];
        const shortDescription = textField(
            parsed.short_description ?? parsed.shortDescription,
            140
        );
        const keywords = Array.isArray(parsed.keywords)
            ? parsed.keywords
                  .filter((value): value is string => typeof value === "string")
                  .map((value) => value.trim().slice(0, 50))
                  .filter(Boolean)
                  .slice(0, 5)
            : [];

        if (descriptions.length !== 3 || !shortDescription || !keywords.length) {
            return null;
        }

        return { descriptions, shortDescription, keywords };
    } catch {
        return null;
    }
}

async function generateWithGroq(
    input: DescriptionInput,
    keys: string[]
): Promise<DescriptionResult | null> {
    const systemPrompt = `Você é um redator especializado em cardápios de restaurantes brasileiros. Crie textos em português do Brasil, claros, apetitosos e honestos. Use somente as informações fornecidas pelo usuário: nunca invente ingredientes, modo de preparo, tamanho, origem, benefícios, alergênicos ou características. Não faça alegações de saúde. Retorne apenas JSON válido com este formato exato: {"descriptions":["opção 1","opção 2","opção 3"],"short_description":"até 90 caracteres","keywords":["palavra 1","palavra 2","palavra 3"]}. Cada descrição deve ter entre 120 e 240 caracteres, evitar clichês repetidos e ser apropriada para um cardápio digital.`;
    const userPrompt = JSON.stringify({
        tarefa: "Criar descrições para este produto de cardápio",
        produto: input.name,
        categoria: input.category || "não informada",
        ingredientes_preparo_tamanho: input.details,
        diferencial_real: input.differential || "não informado",
        tom: input.tone || "apetitoso e direto",
    });

    for (const model of GROQ_MODELS) {
        for (const apiKey of keys) {
            try {
                const response = await fetch(GROQ_ENDPOINT, {
                    method: "POST",
                    headers: {
                        Authorization: `Bearer ${apiKey}`,
                        "Content-Type": "application/json",
                    },
                    body: JSON.stringify({
                        model,
                        messages: [
                            { role: "system", content: systemPrompt },
                            { role: "user", content: userPrompt },
                        ],
                        response_format: { type: "json_object" },
                        reasoning_effort: "low",
                        temperature: 0.7,
                        max_completion_tokens: 900,
                    }),
                    signal: AbortSignal.timeout(15_000),
                    cache: "no-store",
                });

                if (!response.ok) {
                    console.warn("[PRODUCT_DESCRIPTION] Groq request failed:", {
                        model,
                        status: response.status,
                    });
                    if (response.status === 400) break;
                    continue;
                }

                const result = parseGroqResult((await response.json()) as GroqPayload);
                if (result) return result;
            } catch (error) {
                console.warn("[PRODUCT_DESCRIPTION] Groq request unavailable:", {
                    model,
                    error: error instanceof Error ? error.name : "unknown",
                });
            }
        }
    }

    return null;
}

export async function POST(request: Request) {
    if (!isSameOrigin(request)) {
        return NextResponse.json({ error: "Origem não permitida." }, { status: 403 });
    }

    if (isRateLimited(requestIp(request))) {
        return NextResponse.json(
            { error: "Limite temporário atingido. Tente novamente em alguns minutos." },
            { status: 429 }
        );
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });
    }

    const input = parseInput(body);
    if (!input) {
        return NextResponse.json(
            { error: "Informe o nome e os detalhes reais do produto." },
            { status: 400 }
        );
    }

    const cacheKey = JSON.stringify(input);
    const cached = getCached(cacheKey);
    if (cached) {
        return NextResponse.json(cached, {
            headers: { "Cache-Control": "no-store" },
        });
    }

    const keys = rotateKeys(getGroqKeys());
    if (!keys.length) {
        console.error("[PRODUCT_DESCRIPTION] No Groq API keys configured.");
        return NextResponse.json(
            { error: "A geração por IA está temporariamente indisponível." },
            { status: 503 }
        );
    }

    const result = await generateWithGroq(input, keys);
    if (!result) {
        return NextResponse.json(
            { error: "A IA está ocupada agora. Tente novamente em alguns instantes." },
            { status: 503 }
        );
    }

    setCached(cacheKey, result);
    return NextResponse.json(result, {
        headers: { "Cache-Control": "no-store" },
    });
}
