import { isIP } from "node:net";
import { query } from "@/lib/database/sql";

export const MENU_SCAN_BUCKET = "full-menu-images-ai";
export const MENU_SCAN_BUCKET_PATH = "/storage/v1/object/public/" + MENU_SCAN_BUCKET + "/";

export function menuScanFilePaths(urls: string[]): string[] {
    const storageBases = [process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_URL]
        .filter((base): base is string => Boolean(base))
        .map(base => base.replace(/\/+$/, "") + MENU_SCAN_BUCKET_PATH);

    return urls.slice(0, 8).flatMap(raw => {
        const base = storageBases.find(prefix => raw.startsWith(prefix));
        if (!base) return [];
        try {
            const path = decodeURIComponent(raw.slice(base.length).split(/[?#]/, 1)[0]);
            return /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}-[A-Za-z0-9._-]{1,250}$/i.test(path) ? [path] : [];
        } catch {
            return [];
        }
    });
}

export type MenuScanDiagnostics = {
    restaurantId: string;
    inputType: "link" | "files";
    outcome: "success" | "empty" | "failed";
    geminiItems?: number;
    geminiError?: string;
    openAiItems?: number;
    openAiError?: string;
    errorCode?: string;
    linkDomain?: string;
    extractedText?: string;
    source?: { url: string } | { files: string[] };
    elapsedMs: number;
};

export function menuScanLinkDomain(raw: string): string | undefined {
    try {
        const url = new URL(raw.trim());
        return url.protocol === "https:" || url.protocol === "http:" ? url.hostname : undefined;
    } catch {
        return undefined;
    }
}

export function menuScanSourceUrl(raw: string): string | undefined {
    const submitted = raw.trim();
    if (!submitted || submitted.length > 2048) return undefined;

    try {
        const input = /^[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:[/?#]|$)/i.test(submitted)
            ? "https://" + submitted
            : submitted;
        const url = new URL(input);
        const host = url.hostname.replace(/\.$/, "");
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password ||
            (url.port && !["80", "443"].includes(url.port)) ||
            !host.includes(".") || isIP(host) || /\.(local|localhost|internal)$/i.test(host) ||
            [...url.searchParams.keys()].some(key => /token|secret|signature|password|credential|api.?key|auth|^key$|^sig$|^code$/i.test(key))) {
            return undefined;
        }

        url.hash = "";
        return url.toString();
    } catch {
        return undefined;
    }
}

function redactExcerpt(text: string): string | null {
    // Keep visible page text only. Hydration data may contain tokens and other metadata.
    const visible = text.split("\nDados estruturados:\n", 1)[0];
    const excerpt = visible.normalize("NFKC")
        .replace(/<[^>]*>/g, " ")
        .replace(/\b(?:https?:\/\/|www\.)[^\s<>"']+/gi, "[url]")
        .replace(/\b[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+/g, "[email]")
        .replace(/\b(?:pix|cpf|cnpj|telefone|celular|whatsapp|contato|e-mail|email|token|password|senha|secret|authorization|api[_ -]?key)[ \t]*[:=][^\r\n]*/gi, "[dado removido]")
        .replace(/(?:\+?\d[\s()./-]*){8,}/g, "[número]")
        .replace(/\b[A-Za-z0-9_=-]{24,}\b/g, "[identificador]")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ").trim();
    return excerpt.slice(0, 400) || null;
}

export async function recordMenuScan(diagnostic: MenuScanDiagnostics): Promise<void> {
    const text = diagnostic.extractedText;
    const needsExcerpt = diagnostic.outcome !== "success" || diagnostic.geminiItems === 0 || diagnostic.openAiItems === 0;
    try {
        await query(
            `INSERT INTO public.menu_scan_events
                (restaurant_id, input_type, outcome, gemini_items, gemini_error, openai_items, openai_error,
                 error_code, link_domain, extracted_chars, excerpt, elapsed_ms, source)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
            [diagnostic.restaurantId, diagnostic.inputType, diagnostic.outcome,
                diagnostic.geminiItems ?? null, diagnostic.geminiError ?? null,
                diagnostic.openAiItems ?? null, diagnostic.openAiError ?? null,
                diagnostic.errorCode ?? null, diagnostic.linkDomain ?? null, text?.length ?? null,
                needsExcerpt && text ? redactExcerpt(text) : null, diagnostic.elapsedMs, diagnostic.source ?? null],
        );
    } catch {
        console.warn("[SCAN_MENU] Não foi possível registrar o diagnóstico da importação.");
    }
}

export async function cleanupExpiredMenuScans(): Promise<number> {
    const result = await query("DELETE FROM public.menu_scan_events WHERE created_at < NOW() - INTERVAL '14 days'");
    return result.rowCount;
}
