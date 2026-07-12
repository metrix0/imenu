import { NextResponse } from "next/server";
import OpenAI from "openai";

export const runtime = "nodejs";

type ScanRequest = {
    urls: string[];
    restaurantId: string;
};

type ParsedMenu = {
    items: Array<{
        name: string;
        description: string | null;
        price_cents: number | null;
        image_path: string | null;
        category_name: string;
    }>;
    categories: Array<{ name: string }>;
};

function isPdfUrl(value: string): boolean {
    try {
        const pathname = decodeURIComponent(new URL(value).pathname).toLowerCase();
        return pathname.endsWith(".pdf");
    } catch {
        return decodeURIComponent(value.split("?")[0]).toLowerCase().endsWith(".pdf");
    }
}

function parseMenuJson(outputText: string): ParsedMenu {
    const cleaned = outputText
        .trim()
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "");

    let parsed: unknown;

    try {
        parsed = JSON.parse(cleaned);
    } catch {
        const firstBrace = cleaned.indexOf("{");
        const lastBrace = cleaned.lastIndexOf("}");

        if (firstBrace === -1 || lastBrace <= firstBrace) {
            throw new Error("A IA não retornou um JSON válido.");
        }

        parsed = JSON.parse(cleaned.slice(firstBrace, lastBrace + 1));
    }

    if (!parsed || typeof parsed !== "object") {
        throw new Error("A IA retornou uma resposta vazia.");
    }

    const candidate = parsed as Partial<ParsedMenu>;

    if (!Array.isArray(candidate.items) || !Array.isArray(candidate.categories)) {
        throw new Error("A IA retornou um formato de cardápio inválido.");
    }

    return {
        categories: candidate.categories
            .filter((category) => category && typeof category.name === "string")
            .map((category) => ({ name: category.name.trim() }))
            .filter((category) => category.name.length > 0),
        items: candidate.items
            .filter((item) => item && typeof item.name === "string")
            .map((item) => ({
                name: item.name.trim(),
                description:
                    typeof item.description === "string"
                        ? item.description.trim() || null
                        : null,
                price_cents:
                    typeof item.price_cents === "number" &&
                    Number.isFinite(item.price_cents)
                        ? Math.max(0, Math.round(item.price_cents))
                        : null,
                image_path:
                    typeof item.image_path === "string"
                        ? item.image_path
                        : null,
                category_name:
                    typeof item.category_name === "string" &&
                    item.category_name.trim()
                        ? item.category_name.trim()
                        : "Outros",
            }))
            .filter((item) => item.name.length > 0),
    };
}

export async function POST(req: Request) {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            {
                error: "A análise por IA está temporariamente indisponível.",
                details: "OPENAI_API_KEY não está configurada.",
            },
            { status: 503 }
        );
    }

    try {
        const { urls, restaurantId } = (await req.json()) as ScanRequest;

        if (
            !Array.isArray(urls) ||
            urls.length === 0 ||
            urls.some((url) => typeof url !== "string" || !url.startsWith("http"))
        ) {
            return NextResponse.json(
                { error: "Envie ao menos uma imagem ou PDF válido." },
                { status: 400 }
            );
        }

        if (!restaurantId) {
            return NextResponse.json(
                { error: "Restaurante não identificado." },
                { status: 400 }
            );
        }

        const client = new OpenAI({ apiKey });

        const fileContent = urls.map((url) =>
            isPdfUrl(url)
                ? {
                      type: "input_file" as const,
                      file_url: url,
                  }
                : {
                      type: "input_image" as const,
                      image_url: url,
                      detail: "high" as const,
                  }
        );

        const response = await client.responses.create({
            model: process.env.OPENAI_MENU_SCAN_MODEL || "gpt-4.1",
            input: [
                {
                    role: "system",
                    content: [
                        {
                            type: "input_text",
                            text: `
Você analisa fotos, capturas e PDFs de cardápios de restaurantes.

Retorne somente um objeto JSON neste formato:
{
  "items": [
    {
      "name": "string",
      "description": "string ou null",
      "price_cents": 0,
      "image_path": null,
      "category_name": "string"
    }
  ],
  "categories": [
    { "name": "string" }
  ]
}

Regras:
- Converta todos os preços para centavos inteiros.
- Todo item deve pertencer a uma categoria.
- Quando a categoria não estiver explícita, infira uma categoria coerente.
- Não inclua markdown, comentários, explicações ou blocos de código.
- Não invente itens que não estejam visíveis no cardápio.
- image_path deve ser sempre null.
`,
                        },
                    ],
                },
                {
                    role: "user",
                    content: [
                        {
                            type: "input_text",
                            text: "Extraia o cardápio completo dos arquivos enviados.",
                        },
                        ...fileContent,
                    ],
                },
            ],
            max_output_tokens: 8000,
            store: false
        });

        const outputText = response.output_text?.trim();

        if (!outputText) {
            return NextResponse.json(
                {
                    error: "A IA não conseguiu ler este cardápio.",
                    details: "A resposta do modelo veio vazia.",
                },
                { status: 502 }
            );
        }

        const parsed = parseMenuJson(outputText);

        if (parsed.items.length === 0) {
            return NextResponse.json(
                {
                    error: "Nenhum produto foi identificado.",
                    details:
                        "Tente enviar imagens mais nítidas ou dividir o PDF em menos páginas.",
                },
                { status: 422 }
            );
        }

        const categoryNames = new Set(
            parsed.categories.map((category) => category.name)
        );

        parsed.items.forEach((item) => categoryNames.add(item.category_name));

        const categories = Array.from(categoryNames).map((name, index) => ({
            name,
            restaurant_id: restaurantId,
            position: index + 1,
        }));

        const items = parsed.items.map((item, index) => ({
            name: item.name,
            description: item.description,
            price_cents: item.price_cents,
            image_path: null,
            category_name: item.category_name,
            restaurant_id: restaurantId,
            is_available: true,
            position: index,
        }));

        return NextResponse.json({ items, categories });
    } catch (error: unknown) {
        const message =
            error instanceof Error ? error.message : "Erro desconhecido";

        console.error("[SCAN_MENU] Failed:", message);

        const lowerMessage = message.toLowerCase();
        const isQuotaError =
            lowerMessage.includes("quota") ||
            lowerMessage.includes("billing") ||
            lowerMessage.includes("insufficient_quota");
        const isAuthError =
            lowerMessage.includes("api key") ||
            lowerMessage.includes("authentication") ||
            lowerMessage.includes("401");

        return NextResponse.json(
            {
                error: isQuotaError
                    ? "O limite da API de IA foi atingido."
                    : isAuthError
                      ? "A chave da API de IA não foi aceita."
                      : "Não foi possível analisar o cardápio.",
                details: message,
            },
            { status: isQuotaError || isAuthError ? 503 : 500 }
        );
    }
}
