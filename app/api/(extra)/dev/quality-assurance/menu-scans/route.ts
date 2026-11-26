import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { devPage, paged } from "@/lib/dev/pagination";
import { MENU_SCAN_BUCKET, MENU_SCAN_BUCKET_PATH } from "@/lib/menu/scanDiagnostics";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const scansSql = `
    WITH recent AS (
        SELECT id, restaurant_id, created_at, input_type, attempt_id, gemini_items, gemini_error, openai_items, openai_error,
            reused_from_attempt_id,
            CASE WHEN elapsed_ms > 0 AND (attempt_id IS NULL OR analysis_finished_at IS NOT NULL)
                AND (gemini_items IS NOT NULL OR gemini_error IS NOT NULL OR openai_items IS NOT NULL OR openai_error IS NOT NULL)
                THEN elapsed_ms
            END AS analysis_elapsed_ms,
            CASE
                WHEN interrupted_at IS NOT NULL THEN 'interrupted'
                WHEN attempt_id IS NULL AND outcome = 'success' THEN 'unconfirmed'
                WHEN attempt_id IS NOT NULL AND analysis_finished_at IS NULL THEN 'analyzing'
                WHEN input_type = 'link' AND outcome = 'failed' AND error_code IN ('invalid_link_input', 'link_http_400')
                    THEN 'invalid_link'
                WHEN outcome IN ('failed', 'empty') THEN outcome
                WHEN viewed_at IS NOT NULL AND first_product_added_at IS NOT NULL THEN 'success'
                WHEN viewed_at IS NOT NULL THEN 'reviewed'
                ELSE 'awaiting_review'
            END AS status
        FROM public.menu_scan_events
        WHERE created_at >= NOW() - INTERVAL '14 days'
    ), summary AS (
        SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE gemini_error IS NOT NULL AND (openai_items IS NOT NULL OR openai_error IS NOT NULL))::int AS fallback_attempts,
            COUNT(DISTINCT restaurant_id)::int AS restaurants_tried,
            COUNT(DISTINCT restaurant_id) FILTER (WHERE attempt_id IS NOT NULL)::int AS restaurants_tracked,
            COUNT(DISTINCT restaurant_id) FILTER (WHERE status = 'success')::int AS restaurants_completed,
            AVG(analysis_elapsed_ms)::double precision AS average_analysis_ms
        FROM recent
    )
    SELECT summary.*, history.rows
    FROM summary
    CROSS JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(to_jsonb(scan) ORDER BY scan.created_at DESC, scan.id::bigint DESC), '[]'::jsonb) AS rows
        FROM (
            SELECT scan.id::text AS id, scan.restaurant_id, COALESCE(restaurant.name, 'Restaurante') AS restaurant_name,
                scan.created_at, scan.input_type, scan.status AS outcome,
                COALESCE(scan.openai_items, scan.gemini_items, original.openai_items, original.gemini_items) AS items,
                CASE WHEN scan.openai_items IS NOT NULL OR scan.openai_error IS NOT NULL THEN 'OpenAI'
                     WHEN scan.gemini_items IS NOT NULL THEN 'Gemini'
                     WHEN original.openai_items IS NOT NULL OR original.openai_error IS NOT NULL THEN 'OpenAI'
                     WHEN original.gemini_items IS NOT NULL THEN 'Gemini' END AS provider,
                (COALESCE(scan.gemini_error, original.gemini_error) IS NOT NULL AND
                    (COALESCE(scan.openai_items, original.openai_items) IS NOT NULL OR COALESCE(scan.openai_error, original.openai_error) IS NOT NULL)) AS fallback,
                scan.reused_from_attempt_id IS NOT NULL AS reused,
                scan.analysis_elapsed_ms
            FROM (
                SELECT * FROM recent ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2
            ) scan
            LEFT JOIN public.restaurants restaurant ON restaurant.id = scan.restaurant_id
            LEFT JOIN public.menu_scan_events original ON original.restaurant_id = scan.restaurant_id
                AND original.attempt_id = scan.reused_from_attempt_id
        ) scan
    ) history
`;

type ScanHistoryResult = {
    total: number;
    fallback_attempts: number;
    restaurants_tried: number;
    restaurants_tracked: number;
    restaurants_completed: number;
    average_analysis_ms: number | null;
    rows: {
        id: string;
        created_at: string;
        restaurant_id: string;
        restaurant_name: string;
        input_type: string;
        outcome: string;
        items: number | null;
        provider: string | null;
        reused: boolean;
        fallback: boolean;
        analysis_elapsed_ms: number | null;
    }[];
};

type ScanDetails = {
    link_domain: string | null;
    source_url: string | null;
    source_input: string | null;
    files: { path: string; available: boolean }[];
    elapsed_ms: number | null;
    viewed_at: string | null;
    first_product_added_at: string | null;
    interrupted_at: string | null;
    interruption_stage: "analysis" | "review" | "saving" | null;
    interruption_reason: "modal" | "page" | "retry" | "back" | null;
    gemini_error: string | null;
    openai_error: string | null;
    excerpt: string | null;
};

const scanDetailsSql = `
    SELECT scan.link_domain, scan.source->>'url' AS source_url, scan.source->>'input' AS source_input,
        CASE WHEN scan.attempt_id IS NULL OR scan.analysis_finished_at IS NOT NULL THEN scan.elapsed_ms END AS elapsed_ms,
        scan.viewed_at, scan.first_product_added_at, scan.interrupted_at, scan.interruption_stage, scan.interruption_reason,
        scan.gemini_error, scan.openai_error, scan.excerpt,
        COALESCE((
            SELECT jsonb_agg(jsonb_build_object('path', file.path, 'available', object.id IS NOT NULL)
                ORDER BY file.position)
            FROM jsonb_array_elements_text(scan.source->'files') WITH ORDINALITY file(path, position)
            LEFT JOIN storage.objects object ON object.bucket_id = '${MENU_SCAN_BUCKET}' AND object.name = file.path
        ), '[]'::jsonb) AS files
    FROM public.menu_scan_events scan
    WHERE scan.id = $1::bigint AND scan.created_at >= NOW() - INTERVAL '14 days'
`;

async function getScanDetails(scanId: string) {
    if (!/^\d{1,19}$/.test(scanId) || BigInt(scanId) > BigInt("9223372036854775807")) {
        return NextResponse.json({ error: "Scan inválido." }, { status: 400 });
    }
    const { rows: [scan] } = await query<ScanDetails>(scanDetailsSql, [scanId]);
    if (!scan) return NextResponse.json({ error: "Scan indisponível." }, { status: 404 });

    const storageUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    return NextResponse.json({
        sourceUrl: scan.source_url,
        sourceInput: scan.source_input,
        linkDomain: scan.link_domain,
        files: scan.files.map(({ path, available }) => ({
            name: path.slice(37),
            url: available && storageUrl
                ? storageUrl.replace(/\/+$/, "") + MENU_SCAN_BUCKET_PATH + encodeURIComponent(path)
                : null,
        })),
        elapsedMs: scan.elapsed_ms,
        viewedAt: scan.viewed_at,
        firstProductAddedAt: scan.first_product_added_at,
        interruptedAt: scan.interrupted_at,
        interruptionStage: scan.interruption_stage,
        interruptionReason: scan.interruption_reason,
        geminiError: scan.gemini_error,
        openAiError: scan.openai_error,
        excerpt: scan.excerpt,
    }, { headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: Request) {
    try {
        const denied = await authorize(request);
        if (denied) return denied;

        const params = new URL(request.url).searchParams;
        const scanId = params.get("scanId");
        if (scanId !== null) return await getScanDetails(scanId);

        const page = devPage(params);
        const { rows: [result] } = await query<ScanHistoryResult>(scansSql, [PAGE_SIZE, page * PAGE_SIZE]);
        return NextResponse.json({
            restaurantsTried: result.restaurants_tried,
            restaurantsTracked: result.restaurants_tracked,
            restaurantsCompleted: result.restaurants_completed,
            fallbackAttempts: result.fallback_attempts,
            averageAnalysisMs: result.average_analysis_ms,
            history: paged(result.rows, result.total, page, PAGE_SIZE),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Quality assurance menu scans:", error);
        return NextResponse.json({ error: "Não foi possível carregar os scans." }, { status: 500 });
    }
}
