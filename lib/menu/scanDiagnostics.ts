import { createHash } from "node:crypto";
import { isIP } from "node:net";
import { setTimeout as delay } from "node:timers/promises";
import { query, withTransaction } from "@/lib/database/sql";

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
    attemptId?: string;
    outcome: "success" | "empty" | "failed";
    geminiItems?: number;
    geminiError?: string;
    openAiItems?: number;
    openAiError?: string;
    errorCode?: string;
    linkDomain?: string;
    extractedText?: string;
    source?: { input: string; url?: string } | { files: string[] };
    elapsedMs: number;
    retryDraft?: { fingerprint: string; result: object };
    reusedFromAttemptId?: string;
};

const RETRY_DRAFT_TTL = "15 minutes";

export async function menuScanFileFingerprint(
    ownerId: string, paths: string[], existingMenuContext: string | undefined,
): Promise<string | undefined> {
    // Storage assigns content ETags, so a new upload path can still identify the same bytes.
    const { rows } = await query<{ etag: string; mime: string; size: string; pdf: boolean }>(
        `SELECT object.metadata->>'eTag' AS etag, object.metadata->>'mimetype' AS mime,
                object.metadata->>'size' AS size, lower(file.path) LIKE '%.pdf' AS pdf
         FROM unnest($1::text[]) WITH ORDINALITY AS file(path, position)
         JOIN storage.objects object ON object.bucket_id = $2 AND object.name = file.path
         WHERE object.owner_id = $3
           AND object.metadata->>'eTag' ~ '^"[0-9a-f]{32}"$'
           AND object.metadata->>'size' ~ '^[1-9][0-9]*$'
           AND (object.metadata->>'mimetype' = 'application/pdf' OR object.metadata->>'mimetype' LIKE 'image/%')
         ORDER BY file.position`,
        [paths, MENU_SCAN_BUCKET, ownerId],
    );
    if (rows.length !== paths.length) return undefined;

    // The modal retains selected uploads after closing. Re-adding an identical file
    // must not prevent reuse, while the order of different files still matters.
    const files = [...new Set(rows.map(({ etag, mime, size, pdf }) => JSON.stringify([etag, mime, size, pdf])))];
    return createHash("sha256")
        .update(JSON.stringify([1, ownerId, existingMenuContext ?? "", files]))
        .digest("hex");
}

type MenuScanResult<Result> = {
    result: Result | null;
    outcome: MenuScanDiagnostics["outcome"];
    error_code: string | null;
};

type PriorMenuScan<Result> = MenuScanResult<Result> & {
    attempt_id: string;
    analysis_finished_at: Date | null;
    retry_until: Date;
    already_claimed: boolean;
};

export async function claimMenuScanFileAnalysis<Result>(
    restaurantId: string, attemptId: string, fingerprint: string,
): Promise<PriorMenuScan<Result> | null | undefined> {
    return withTransaction(async client => {
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
            [`menu-scan:${restaurantId}:${fingerprint}`]);
        const { rows: [prior] } = await client.query<PriorMenuScan<Result>>(
            `SELECT source.retry_result AS result, source.attempt_id, source.analysis_finished_at,
                    source.outcome, source.error_code, source.created_at + $4::interval AS retry_until,
                    source.attempt_id = COALESCE(request.reused_from_attempt_id, request.attempt_id) AS already_claimed
             FROM public.menu_scan_events request
             JOIN public.menu_scan_events source ON source.restaurant_id = request.restaurant_id
             WHERE request.restaurant_id = $1 AND request.attempt_id = $2
               AND source.retry_fingerprint = $3 AND source.reused_from_attempt_id IS NULL
               AND (
                 source.attempt_id = COALESCE(request.reused_from_attempt_id, request.attempt_id)
                 OR (source.analysis_finished_at IS NULL AND source.created_at > NOW() - $4::interval)
                 OR (
                   source.analysis_finished_at > NOW() - $4::interval
                   AND source.retry_result IS NOT NULL AND source.interruption_stage = 'analysis'
                   AND source.interruption_reason IN ('modal', 'page') AND source.viewed_at IS NULL
                   AND NOT EXISTS (
                       SELECT 1 FROM public.menu_scan_events reviewed
                       WHERE reviewed.restaurant_id = source.restaurant_id
                         AND reviewed.reused_from_attempt_id = source.attempt_id AND reviewed.viewed_at IS NOT NULL
                   )
                 )
               )
             ORDER BY already_claimed DESC, (source.analysis_finished_at IS NULL) DESC,
                      source.analysis_finished_at DESC, source.id DESC
             LIMIT 1`,
            [restaurantId, attemptId, fingerprint, RETRY_DRAFT_TTL],
        );
        if (!prior?.already_claimed) {
            const { rowCount } = await client.query(
                `UPDATE public.menu_scan_events SET retry_fingerprint = $3, reused_from_attempt_id = $4
                 WHERE restaurant_id = $1 AND attempt_id = $2
                   AND analysis_finished_at IS NULL AND retry_fingerprint IS NULL`,
                [restaurantId, attemptId, fingerprint, prior?.attempt_id ?? null],
            );
            if (rowCount !== 1) return null;
        }
        return prior;
    });
}

export async function waitForMenuScanResult<Result>(
    restaurantId: string, prior: PriorMenuScan<Result>, signal: AbortSignal,
): Promise<MenuScanResult<Result> | undefined> {
    if (prior.analysis_finished_at) return prior;

    const deadline = prior.retry_until.getTime();
    while (Date.now() < deadline) {
        await delay(Math.min(1500, deadline - Date.now()), undefined, { signal });
        const { rows: [finished] } = await query<MenuScanResult<Result>>(
            `SELECT retry_result AS result, outcome, error_code
             FROM public.menu_scan_events
             WHERE restaurant_id = $1 AND attempt_id = $2 AND analysis_finished_at IS NOT NULL`,
            [restaurantId, prior.attempt_id],
        );
        if (finished) return finished;
    }
}

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

export const scanAttemptIdPattern = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;

export async function beginMenuScan(diagnostic: MenuScanDiagnostics): Promise<void> {
    if (!diagnostic.attemptId) return;

    try {
        await query(
            `INSERT INTO public.menu_scan_events
                (restaurant_id, input_type, outcome, elapsed_ms, attempt_id, link_domain, source)
             VALUES ($1, $2, 'failed', 0, $3, $4, $5)
             ON CONFLICT (restaurant_id, attempt_id) DO UPDATE SET
                input_type = EXCLUDED.input_type, link_domain = EXCLUDED.link_domain, source = EXCLUDED.source
             WHERE menu_scan_events.analysis_finished_at IS NULL AND menu_scan_events.retry_fingerprint IS NULL`,
            [diagnostic.restaurantId, diagnostic.inputType, diagnostic.attemptId,
                diagnostic.linkDomain ?? null, diagnostic.source ?? null],
        );
    } catch {
        console.warn("[SCAN_MENU] Não foi possível registrar o início da importação.");
    }
}

type ScanProgress =
    | { event: "viewed" }
    | { event: "saved"; itemId: string }
    | { event: "interrupted"; inputType: MenuScanDiagnostics["inputType"];
        stage: "analysis" | "review" | "saving"; reason: "modal" | "page" | "retry" | "back" };

export async function recordMenuScanProgress(
    restaurantId: string, attemptId: string, progress: ScanProgress,
): Promise<boolean> {
    if (progress.event === "interrupted") {
        const result = await query(
            `INSERT INTO public.menu_scan_events AS scan
                (restaurant_id, attempt_id, input_type, outcome, elapsed_ms,
                 interrupted_at, interruption_stage, interruption_reason)
             VALUES ($1, $2, $3, 'failed', 0, clock_timestamp(), $4, $5)
             ON CONFLICT (restaurant_id, attempt_id) DO UPDATE SET
                interrupted_at = EXCLUDED.interrupted_at, interruption_stage = EXCLUDED.interruption_stage,
                interruption_reason = EXCLUDED.interruption_reason
             WHERE scan.interrupted_at IS NULL AND scan.first_product_added_at IS NULL`,
            [restaurantId, attemptId, progress.inputType, progress.stage, progress.reason],
        );
        return result.rowCount > 0;
    }

    // Keep the draft available to requests that already joined this analysis.
    // A viewed result is excluded from new reuse and its payload is cleared by cleanup.
    if (progress.event === "viewed") {
        const { rows } = await query<{ recorded: boolean }>(
            `WITH recorded AS (
                UPDATE public.menu_scan_events
                SET viewed_at = COALESCE(viewed_at, LEAST(clock_timestamp(), interrupted_at))
                WHERE restaurant_id = $1 AND attempt_id = $2
                  AND outcome = 'success' AND analysis_finished_at IS NOT NULL
                  AND (interrupted_at IS NULL OR interruption_stage IN ('review', 'saving'))
                RETURNING 1
            ) SELECT EXISTS (SELECT 1 FROM recorded) AS recorded`,
            [restaurantId, attemptId],
        );
        return rows[0]?.recorded === true;
    }

    const { rows } = await query<{ recorded: boolean }>(
        `WITH recorded AS (
            UPDATE public.menu_scan_events AS scan
            SET viewed_at = COALESCE(scan.viewed_at, clock_timestamp()),
                first_product_added_at = COALESCE(scan.first_product_added_at, clock_timestamp())
            WHERE scan.restaurant_id = $1 AND scan.attempt_id = $2
              AND scan.outcome = 'success' AND scan.analysis_finished_at IS NOT NULL
              AND scan.interrupted_at IS NULL
              AND EXISTS (
                  SELECT 1 FROM public.items item
                  WHERE item.id = $3 AND item.restaurant_id = scan.restaurant_id
                    AND item.created_at >= scan.analysis_finished_at
              )
            RETURNING 1
        ) SELECT EXISTS (SELECT 1 FROM recorded) AS recorded`,
        [restaurantId, attemptId, progress.itemId],
    );
    return rows[0]?.recorded === true;
}

export async function recordMenuScan(diagnostic: MenuScanDiagnostics): Promise<void> {
    const text = diagnostic.extractedText;
    const needsExcerpt = diagnostic.outcome !== "success" || diagnostic.geminiItems === 0 || diagnostic.openAiItems === 0;
    try {
        await query(
            `INSERT INTO public.menu_scan_events
                (restaurant_id, input_type, outcome, gemini_items, gemini_error, openai_items, openai_error,
                 error_code, link_domain, extracted_chars, excerpt, elapsed_ms, source, attempt_id, analysis_finished_at,
                 retry_fingerprint, retry_result, reused_from_attempt_id)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,
                     CASE WHEN $14::uuid IS NOT NULL THEN clock_timestamp() END,$15,$16,$17)
             ON CONFLICT (restaurant_id, attempt_id) DO UPDATE SET
                input_type = EXCLUDED.input_type, outcome = EXCLUDED.outcome, gemini_items = EXCLUDED.gemini_items,
                gemini_error = EXCLUDED.gemini_error, openai_items = EXCLUDED.openai_items,
                openai_error = EXCLUDED.openai_error, error_code = EXCLUDED.error_code,
                link_domain = EXCLUDED.link_domain, extracted_chars = EXCLUDED.extracted_chars,
                excerpt = EXCLUDED.excerpt, elapsed_ms = EXCLUDED.elapsed_ms, source = EXCLUDED.source,
                analysis_finished_at = EXCLUDED.analysis_finished_at,
                retry_fingerprint = COALESCE(EXCLUDED.retry_fingerprint, menu_scan_events.retry_fingerprint),
                retry_result = EXCLUDED.retry_result,
                reused_from_attempt_id = COALESCE(EXCLUDED.reused_from_attempt_id, menu_scan_events.reused_from_attempt_id)
             WHERE menu_scan_events.analysis_finished_at IS NULL`,
            [diagnostic.restaurantId, diagnostic.inputType, diagnostic.outcome,
                diagnostic.geminiItems ?? null, diagnostic.geminiError ?? null,
                diagnostic.openAiItems ?? null, diagnostic.openAiError ?? null,
                diagnostic.errorCode ?? null, diagnostic.linkDomain ?? null, text?.length ?? null,
                needsExcerpt && text ? redactExcerpt(text) : null, diagnostic.elapsedMs, diagnostic.source ?? null,
                diagnostic.attemptId ?? null, diagnostic.retryDraft?.fingerprint ?? null,
                diagnostic.retryDraft?.result ?? null, diagnostic.reusedFromAttemptId ?? null],
        );
    } catch {
        console.warn("[SCAN_MENU] Não foi possível registrar o diagnóstico da importação.");
    }
}

export async function cleanupExpiredMenuScans(): Promise<number> {
    const result = await query("DELETE FROM public.menu_scan_events WHERE created_at < NOW() - INTERVAL '14 days'");
    await query(
        `UPDATE public.menu_scan_events SET retry_result = NULL
         WHERE retry_result IS NOT NULL AND analysis_finished_at <= NOW() - $1::interval`,
        [RETRY_DRAFT_TTL],
    );
    return result.rowCount;
}
