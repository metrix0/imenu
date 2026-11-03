import { sendNtfyNotification } from "./ntfy";

export type OpenAiLimit = "credits" | "tokens" | "analysis_budget";

export function classifyOpenAiLimit(error: unknown): OpenAiLimit | null {
    const value = error && typeof error === "object" ? error as Record<string, unknown> : {};
    const nested = value.error && typeof value.error === "object"
        ? value.error as Record<string, unknown> : value;
    const description = [nested.code, nested.type, nested.message, typeof error === "string" ? error : ""]
        .filter(Boolean).join(" ").toLowerCase();

    if (description.includes("analysis_token_budget_exceeded")) return "analysis_budget";
    if (/insufficient_quota|billing_hard_limit|credit_balance|credits exhausted|out of credits|exceeded your current quota|quota exceeded/.test(description))
        return "credits";
    if (/context_length_exceeded|token_limit_exceeded|maximum context length|context window exceeded|too many tokens|token limit exceeded|token budget exceeded/.test(description))
        return "tokens";
    return null;
}

let lastAlertAt = 0;
let sending: Promise<void> | null = null;

// Error-path only: no polling, database queries, or network calls on successful requests.
export async function notifyOpenAiLimit(error: unknown, source: string): Promise<void> {
    const limit = classifyOpenAiLimit(error);
    if (!limit || sending || Date.now() - lastAlertAt < 60 * 60 * 1000) return;

    lastAlertAt = Date.now();
    const reason = limit === "credits" ? "Créditos/cota da API esgotados"
        : limit === "analysis_budget" ? "Limite interno de tokens da análise atingido"
        : "Limite de tokens/contexto da OpenAI atingido";
    sending = sendNtfyNotification({
        title: "ALARM TRIGGER - iMenu OpenAI",
        message: `ALARM TRIGGER\n${reason}\nOrigem: ${source}`,
    }).catch((failure: unknown) => {
        lastAlertAt = 0; // A later error can retry a failed notification.
        console.error("[OPENAI_LIMIT_ALERT] Falha ao enviar alarme", failure instanceof Error ? failure.name : "UnknownError");
    }).finally(() => { sending = null; });
    await sending;
}

export function openAiAlertFetch(source: string): typeof fetch {
    return async (input, init) => {
        const response = await fetch(input, init);
        if ([400, 402, 403, 429].includes(response.status)) {
            try {
                await notifyOpenAiLimit(await response.clone().json(), source);
            } catch {
                // Do not change the OpenAI error or retry behavior.
            }
        }
        return response;
    };
}

// Batch errors are returned in JSONL, even when the HTTP request itself succeeds.
export async function notifyOpenAiBatchLimit(content: string, customId: string): Promise<void> {
    for (const line of content.split("\n")) {
        if (!line.trim()) continue;
        try {
            const row = JSON.parse(line);
            if (row.custom_id !== customId) continue;
            await notifyOpenAiLimit(row.error || row.response?.body?.error, "Vendas IA (Batch)");
            break;
        } catch {
            // The existing batch parser handles invalid JSONL.
        }
    }
}
