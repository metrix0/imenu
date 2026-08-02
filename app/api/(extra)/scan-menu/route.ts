import { NextResponse } from "next/server";

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

type GeminiFile = {
    name: string;
    uri: string;
    mimeType: string;
    state?: "STATE_UNSPECIFIED" | "PROCESSING" | "ACTIVE" | "FAILED";
    error?: {
        message?: string;
    };
};

type GeminiGenerateResponse = {
    candidates?: Array<{
        content?: {
            parts?: Array<{
                text?: string;
            }>;
        };
        finishReason?: string;
    }>;
    promptFeedback?: {
        blockReason?: string;
    };
};

const GEMINI_BASE_URL = "https://generativelanguage.googleapis.com";
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const FILE_PROCESSING_TIMEOUT_MS = 30_000;

const MENU_RESPONSE_SCHEMA = {
    type: "object",
    additionalProperties: false,
    properties: {
        items: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    name: {
                        type: "string",
                        description: "Nome exato do item visível no cardápio.",
                    },
                    description: {
                        type: ["string", "null"],
                        description:
                            "Descrição visível do item, ou null quando não existir.",
                    },
                    price_cents: {
                        type: ["integer", "null"],
                        minimum: 0,
                        description:
                            "Preço do item em centavos inteiros, ou null quando não for legível.",
                    },
                    image_path: {
                        type: "null",
                        description: "Sempre null.",
                    },
                    category_name: {
                        type: "string",
                        description:
                            "Categoria explícita ou categoria coerente inferida para o item.",
                    },
                },
                required: [
                    "name",
                    "description",
                    "price_cents",
                    "image_path",
                    "category_name",
                ],
            },
        },
        categories: {
            type: "array",
            items: {
                type: "object",
                additionalProperties: false,
                properties: {
                    name: {
                        type: "string",
                        description: "Nome da categoria.",
                    },
                },
                required: ["name"],
            },
        },
    },
    required: ["items", "categories"],
} as const;

class GeminiHttpError extends Error {
    status: number;
    responseBody: string;

    constructor(status: number, responseBody: string) {
        super(getGeminiErrorMessage(responseBody) || `Gemini HTTP ${status}`);
        this.name = "GeminiHttpError";
        this.status = status;
        this.responseBody = responseBody;
    }
}

function getGeminiErrorMessage(responseBody: string): string | null {
    if (!responseBody) return null;

    try {
        const parsed = JSON.parse(responseBody) as {
            error?: {
                message?: string;
            };
        };

        return parsed.error?.message?.trim() || null;
    } catch {
        return responseBody.trim() || null;
    }
}

function isPdfUrl(value: string): boolean {
    try {
        const pathname = decodeURIComponent(
            new URL(value).pathname
        ).toLowerCase();
        return pathname.endsWith(".pdf");
    } catch {
        return decodeURIComponent(value.split("?")[0])
            .toLowerCase()
            .endsWith(".pdf");
    }
}

function inferMimeType(url: string, responseContentType: string | null): string {
    const contentType = responseContentType
        ?.split(";")[0]
        .trim()
        .toLowerCase();

    if (
        contentType === "application/pdf" ||
        contentType?.startsWith("image/")
    ) {
        return contentType;
    }

    if (isPdfUrl(url)) return "application/pdf";

    let pathname = "";
    try {
        pathname = decodeURIComponent(new URL(url).pathname).toLowerCase();
    } catch {
        pathname = decodeURIComponent(url.split("?")[0]).toLowerCase();
    }

    if (pathname.endsWith(".png")) return "image/png";
    if (pathname.endsWith(".webp")) return "image/webp";
    if (pathname.endsWith(".gif")) return "image/gif";
    if (pathname.endsWith(".heic")) return "image/heic";
    if (pathname.endsWith(".heif")) return "image/heif";

    return "image/jpeg";
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
            .filter(
                (category) =>
                    category &&
                    typeof category.name === "string"
            )
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

async function readResponseText(response: Response): Promise<string> {
    return response.text().catch(() => "");
}

async function throwForGeminiError(response: Response): Promise<void> {
    if (response.ok) return;

    throw new GeminiHttpError(
        response.status,
        await readResponseText(response)
    );
}

async function fetchSourceFile(url: string): Promise<{
    bytes: ArrayBuffer;
    mimeType: string;
    displayName: string;
}> {
    const response = await fetch(url, {
        cache: "no-store",
        redirect: "follow",
        signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
        throw new Error(
            `Não foi possível baixar um dos arquivos enviados (HTTP ${response.status}).`
        );
    }

    const arrayBuffer = await response.arrayBuffer();

    if (arrayBuffer.byteLength === 0) {
        throw new Error("Um dos arquivos enviados está vazio.");
    }

    if (arrayBuffer.byteLength > MAX_FILE_BYTES) {
        throw new Error(
            "Um dos arquivos ultrapassa o limite de 50 MB da API Gemini."
        );
    }

    const mimeType = inferMimeType(
        url,
        response.headers.get("content-type")
    );

    if (mimeType !== "application/pdf" && !mimeType.startsWith("image/")) {
        throw new Error(
            `Formato não suportado para leitura de cardápio: ${mimeType}.`
        );
    }

    let displayName = "menu";
    try {
        displayName =
            decodeURIComponent(new URL(url).pathname.split("/").pop() || "") ||
            "menu";
    } catch {
        displayName = "menu";
    }

    return {
        bytes: arrayBuffer,
        mimeType,
        displayName,
    };
}

async function getGeminiFile(
    apiKey: string,
    fileName: string
): Promise<GeminiFile> {
    const response = await fetch(
        `${GEMINI_BASE_URL}/v1beta/${fileName}`,
        {
            headers: {
                "x-goog-api-key": apiKey,
                Accept: "application/json",
            },
            cache: "no-store",
            signal: AbortSignal.timeout(20_000),
        }
    );

    await throwForGeminiError(response);

    return (await response.json()) as GeminiFile;
}

async function waitForGeminiFile(
    apiKey: string,
    file: GeminiFile
): Promise<GeminiFile> {
    let current = file;

    if (!current.state || current.state === "ACTIVE") {
        return current;
    }

    const deadline = Date.now() + FILE_PROCESSING_TIMEOUT_MS;

    while (
        current.state === "PROCESSING" &&
        Date.now() < deadline
    ) {
        await new Promise((resolve) => setTimeout(resolve, 500));
        current = await getGeminiFile(apiKey, current.name);
    }

    if (current.state === "FAILED") {
        throw new Error(
            current.error?.message ||
                "A API Gemini não conseguiu processar um dos arquivos."
        );
    }

    if (current.state !== "ACTIVE") {
        throw new Error(
            "A API Gemini demorou demais para processar um dos arquivos."
        );
    }

    return current;
}

async function uploadGeminiFile(
    apiKey: string,
    sourceUrl: string
): Promise<GeminiFile> {
    const source = await fetchSourceFile(sourceUrl);

    const startResponse = await fetch(
        `${GEMINI_BASE_URL}/upload/v1beta/files`,
        {
            method: "POST",
            headers: {
                "x-goog-api-key": apiKey,
                "X-Goog-Upload-Protocol": "resumable",
                "X-Goog-Upload-Command": "start",
                "X-Goog-Upload-Header-Content-Length": String(
                    source.bytes.byteLength
                ),
                "X-Goog-Upload-Header-Content-Type": source.mimeType,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                file: {
                    display_name: source.displayName,
                },
            }),
            signal: AbortSignal.timeout(20_000),
        }
    );

    await throwForGeminiError(startResponse);

    const uploadUrl = startResponse.headers.get("x-goog-upload-url");
    if (!uploadUrl) {
        throw new Error(
            "A API Gemini não retornou a URL de upload do arquivo."
        );
    }

    const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
            "Content-Length": String(source.bytes.byteLength),
            "X-Goog-Upload-Offset": "0",
            "X-Goog-Upload-Command": "upload, finalize",
        },
        body: source.bytes,
        signal: AbortSignal.timeout(60_000),
    });

    await throwForGeminiError(uploadResponse);

    const payload = (await uploadResponse.json()) as {
        file?: GeminiFile;
    };

    if (
        !payload.file?.name ||
        !payload.file.uri ||
        !payload.file.mimeType
    ) {
        throw new Error(
            "A API Gemini retornou dados inválidos para o arquivo enviado."
        );
    }

    return waitForGeminiFile(apiKey, payload.file);
}

async function deleteGeminiFile(
    apiKey: string,
    fileName: string
): Promise<void> {
    const response = await fetch(
        `${GEMINI_BASE_URL}/v1beta/${fileName}`,
        {
            method: "DELETE",
            headers: {
                "x-goog-api-key": apiKey,
            },
            signal: AbortSignal.timeout(20_000),
        }
    );

    if (!response.ok && response.status !== 404) {
        console.warn(
            `[SCAN_MENU] Failed to delete temporary Gemini file ${fileName}:`,
            await readResponseText(response)
        );
    }
}

async function generateMenuJson(
    apiKey: string,
    model: string,
    files: GeminiFile[]
): Promise<string> {
    const response = await fetch(
        `${GEMINI_BASE_URL}/v1beta/models/${encodeURIComponent(
            model
        )}:generateContent`,
        {
            method: "POST",
            headers: {
                "x-goog-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                system_instruction: {
                    parts: [
                        {
                            text: `
Você analisa fotos, capturas e PDFs de cardápios de restaurantes.

Regras:
- Extraia todos os itens visíveis, sem resumir.
- Converta todos os preços para centavos inteiros.
- Todo item deve pertencer a uma categoria.
- Quando a categoria não estiver explícita, infira uma categoria coerente.
- Não invente itens, descrições ou preços que não estejam visíveis no cardápio.
- Quando um preço não estiver legível com segurança, use null.
- image_path deve ser sempre null.
- Não combine itens diferentes.
- Preserve nomes e descrições conforme aparecem no cardápio.
`,
                        },
                    ],
                },
                contents: [
                    {
                        role: "user",
                        parts: [
                            {
                                text: "Extraia o cardápio completo dos arquivos enviados.",
                            },
                            ...files.map((file) => ({
                                file_data: {
                                    mime_type: file.mimeType,
                                    file_uri: file.uri,
                                },
                            })),
                        ],
                    },
                ],
                generationConfig: {
                    maxOutputTokens: 8000,
                    responseMimeType: "application/json",
                    responseJsonSchema: MENU_RESPONSE_SCHEMA,
                },
            }),
            signal: AbortSignal.timeout(120_000),
        }
    );

    await throwForGeminiError(response);

    const payload = (await response.json()) as GeminiGenerateResponse;
    const outputText = (payload.candidates || [])
        .flatMap((candidate) => candidate.content?.parts || [])
        .map((part) => part.text || "")
        .join("")
        .trim();

    if (!outputText) {
        const reason =
            payload.promptFeedback?.blockReason ||
            payload.candidates?.[0]?.finishReason ||
            "A resposta do modelo veio vazia.";

        throw new Error(reason);
    }

    return outputText;
}

export async function POST(req: Request) {
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
        return NextResponse.json(
            {
                error: "A análise por IA está temporariamente indisponível.",
                details: "GEMINI_API_KEY não está configurada.",
            },
            { status: 503 }
        );
    }

    const uploadedFiles: GeminiFile[] = [];

    try {
        const { urls, restaurantId } = (await req.json()) as ScanRequest;

        if (
            !Array.isArray(urls) ||
            urls.length === 0 ||
            urls.some(
                (url) =>
                    typeof url !== "string" ||
                    !url.startsWith("http")
            )
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

        for (const url of urls) {
            uploadedFiles.push(await uploadGeminiFile(apiKey, url));
        }

        const outputText = await generateMenuJson(
            apiKey,
            process.env.GEMINI_MENU_SCAN_MODEL || "gemini-3.5-flash",
            uploadedFiles
        );

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

        parsed.items.forEach((item) =>
            categoryNames.add(item.category_name)
        );

        const categories = Array.from(categoryNames).map(
            (name, index) => ({
                name,
                restaurant_id: restaurantId,
                position: index + 1,
            })
        );

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
        const httpStatus =
            error instanceof GeminiHttpError ? error.status : null;

        const isQuotaError =
            httpStatus === 429 ||
            lowerMessage.includes("quota") ||
            lowerMessage.includes("resource_exhausted") ||
            lowerMessage.includes("rate limit");

        const isAuthError =
            httpStatus === 401 ||
            httpStatus === 403 ||
            lowerMessage.includes("api key") ||
            lowerMessage.includes("authentication") ||
            lowerMessage.includes("permission_denied");

        return NextResponse.json(
            {
                error: isQuotaError
                    ? "O limite da API de IA foi atingido. Entre em contato conosco por Whatsapp!"
                    : isAuthError
                      ? "A chave da API de IA não foi aceita. Entre em contato conosco por Whatsapp!"
                      : "Não foi possível analisar o cardápio. Entre em contato conosco por Whatsapp!",
                details: message,
            },
            { status: isQuotaError || isAuthError ? 503 : 500 }
        );
    } finally {
        await Promise.allSettled(
            uploadedFiles.map((file) =>
                deleteGeminiFile(apiKey, file.name)
            )
        );
    }
}
