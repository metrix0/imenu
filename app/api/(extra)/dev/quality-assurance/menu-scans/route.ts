import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { devPage, paged } from "@/lib/dev/pagination";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const PAGE_SIZE = 10;

const scansSql = `
    WITH recent AS (
        SELECT id, restaurant_id, created_at, input_type, outcome, gemini_items, openai_items, openai_error
        FROM public.menu_scan_events
        WHERE created_at >= NOW() - INTERVAL '14 days'
    ), summary AS (
        SELECT COUNT(*)::int AS total,
            COUNT(*) FILTER (WHERE openai_items IS NOT NULL OR openai_error IS NOT NULL)::int AS fallback_attempts,
            COUNT(DISTINCT restaurant_id)::int AS restaurants_tried,
            COUNT(DISTINCT restaurant_id) FILTER (WHERE outcome = 'success')::int AS restaurants_completed
        FROM recent
    )
    SELECT summary.*, history.rows
    FROM summary
    CROSS JOIN LATERAL (
        SELECT COALESCE(jsonb_agg(to_jsonb(scan) ORDER BY scan.created_at DESC, scan.id::bigint DESC), '[]'::jsonb) AS rows
        FROM (
            SELECT scan.id::text AS id, scan.restaurant_id, COALESCE(restaurant.name, 'Restaurante') AS restaurant_name,
                scan.created_at, scan.input_type, scan.outcome,
                CASE WHEN scan.outcome = 'success' THEN COALESCE(scan.openai_items, scan.gemini_items) END AS items,
                CASE WHEN scan.openai_items IS NOT NULL OR scan.openai_error IS NOT NULL THEN 'OpenAI'
                     WHEN scan.gemini_items IS NOT NULL THEN 'Gemini' END AS provider
            FROM (
                SELECT * FROM recent ORDER BY created_at DESC, id DESC LIMIT $1 OFFSET $2
            ) scan
            LEFT JOIN public.restaurants restaurant ON restaurant.id = scan.restaurant_id
        ) scan
    ) history
`;

type ScanHistoryResult = {
    total: number;
    fallback_attempts: number;
    restaurants_tried: number;
    restaurants_completed: number;
    rows: {
        id: string;
        created_at: string;
        restaurant_id: string;
        restaurant_name: string;
        input_type: string;
        outcome: string;
        items: number | null;
        provider: string | null;
    }[];
};

export async function GET(request: Request) {
    try {
        const denied = await authorize(request);
        if (denied) return denied;

        const page = devPage(new URL(request.url).searchParams);
        const { rows: [result] } = await query<ScanHistoryResult>(scansSql, [PAGE_SIZE, page * PAGE_SIZE]);
        return NextResponse.json({
            restaurantsTried: result.restaurants_tried,
            restaurantsCompleted: result.restaurants_completed,
            fallbackAttempts: result.fallback_attempts,
            history: paged(result.rows, result.total, page, PAGE_SIZE),
        }, { headers: { "Cache-Control": "no-store" } });
    } catch (error) {
        console.error("Quality assurance menu scans:", error);
        return NextResponse.json({ error: "Não foi possível carregar os scans." }, { status: 500 });
    }
}
