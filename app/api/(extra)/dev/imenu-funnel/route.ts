import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { runPostHogQuery } from "@/lib/analytics/posthogQuery";
import { PUBLIC_CONTENT_PAGES } from "@/lib/seo/publicContent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

type CohortRow = {
    period: "current" | "previous";
    registered: number | string;
    restaurants: number | string;
    cardapio: number | string;
    horarios: number | string;
    loja: number | string;
    finished: number | string;
    items: number | string;
    first_order: number | string;
    active: number | string;
};

function validDate(value: string | null): value is string {
    return Boolean(value && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
        Number.isFinite(Date.parse(value)) &&
        new Date(value + "T12:00:00Z").toISOString().slice(0, 10) === value);
}
function timestamp(value: number): string {
    return new Date(value).toISOString().replace("T", " ").replace(/\.\d{3}Z$/, "");
}

const cohortSql = `
WITH cohort AS (
    SELECT u.id,
        CASE WHEN u.created_at >= $2::timestamptz THEN 'current' ELSE 'previous' END AS period
    FROM auth.users u
    WHERE u.created_at >= $1::timestamptz AND u.created_at < $3::timestamptz
        AND u.deleted_at IS NULL AND COALESCE(u.is_anonymous, false) = false
),
states AS (
    SELECT c.period, c.id,
        EXISTS (SELECT 1 FROM restaurants r WHERE r.user_id = c.id) AS restaurant,
        EXISTS (SELECT 1 FROM restaurants r WHERE r.user_id = c.id
            AND (r.creation_step >= 2 OR r.first_time = false)) AS cardapio,
        EXISTS (SELECT 1 FROM restaurants r WHERE r.user_id = c.id
            AND (r.creation_step >= 3 OR r.first_time = false)) AS horarios,
        EXISTS (SELECT 1 FROM restaurants r WHERE r.user_id = c.id
            AND (r.creation_step >= 4 OR r.first_time = false)) AS loja,
        EXISTS (SELECT 1 FROM restaurants r WHERE r.user_id = c.id AND r.first_time = false) AS finished,
        EXISTS (SELECT 1 FROM restaurants r JOIN items i ON i.restaurant_id = r.id
            WHERE r.user_id = c.id) AS items,
        EXISTS (SELECT 1 FROM restaurants r JOIN orders o ON o.restaurant_id = r.id
            WHERE r.user_id = c.id AND o.status NOT IN ('canceled', 'pending_online_payment')) AS first_order,
        EXISTS (
            SELECT 1 FROM restaurants r JOIN orders o ON o.restaurant_id = r.id
            WHERE r.user_id = c.id AND o.status = 'done'
                AND o.created_at >= NOW() - interval '30 days'
            GROUP BY r.user_id
            HAVING COUNT(DISTINCT (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date) >= 2
                AND COUNT(DISTINCT (o.created_at AT TIME ZONE 'America/Sao_Paulo')::date)
                    FILTER (WHERE o.created_at >= NOW() - interval '14 days') >= 1
        ) AS active
    FROM cohort c
)
SELECT period, COUNT(*)::int AS registered,
    COUNT(*) FILTER (WHERE restaurant)::int AS restaurants,
    COUNT(*) FILTER (WHERE cardapio)::int AS cardapio,
    COUNT(*) FILTER (WHERE horarios)::int AS horarios,
    COUNT(*) FILTER (WHERE loja)::int AS loja,
    COUNT(*) FILTER (WHERE finished)::int AS finished,
    COUNT(*) FILTER (WHERE items)::int AS items,
    COUNT(*) FILTER (WHERE first_order)::int AS first_order,
    COUNT(*) FILTER (WHERE active)::int AS active
FROM states GROUP BY period
`;

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;
    const params = new URL(request.url).searchParams;
    const startDate = params.get("startDate");
    const endDate = params.get("endDate");
    if (!validDate(startDate) || !validDate(endDate) || startDate > endDate) {
        return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }
    const startAt = Date.parse(startDate + "T00:00:00-03:00");
    const endAt = Math.min(Date.now(), Date.parse(endDate + "T23:59:59.999-03:00") + 1);
    if (startAt >= endAt) {
        return NextResponse.json({ error: "Período inválido." }, { status: 400 });
    }
    const previousStart = startAt - (endAt - startAt);

    // Match the iMenu-owned pages in /api/dev/traffic-sources, excluding restaurant menus.
    const paths = Array.from(new Set([
        "/", "/restaurante/registrar", "/cardapio-web", "/delivery-direto", "/consumer",
        ...PUBLIC_CONTENT_PAGES.map(page => page.path),
    ].flatMap(path => path === "/" ? [path] : [path, path + "/"])));
    const pathList = paths.map(path => "'" + path.replace(/'/g, "''") + "'").join(", ");
    const pathname = "toString(properties.$pathname)";
    const pages = "(" + pathname + " IN (" + pathList + ") OR startsWith(" + pathname + ", '/restaurantes/'))";
    const trafficSql = [
        "SELECT if(timestamp >= toDateTime('" + timestamp(startAt) + "', 'UTC'), 'current', 'previous') AS period,",
        "uniqExactIf(distinct_id, " + pages + ") AS visitors,",
        "uniqExactIf(distinct_id, " + pathname + " IN ('/restaurante/registrar','/restaurante/registrar/')) AS signup_page",
        "FROM events WHERE event = '$pageview'",
        "AND timestamp >= toDateTime('" + timestamp(previousStart) + "', 'UTC')",
        "AND timestamp < toDateTime('" + timestamp(endAt) + "', 'UTC')",
        "AND toString(properties.$host) IN ('www.imenuapp.com.br', 'imenuapp.com.br')",
        "AND " + pages,
        "GROUP BY period",
    ].join(" ");

    const [cohorts, traffic] = await Promise.allSettled([
        query<CohortRow>(cohortSql, [
            new Date(previousStart).toISOString(),
            new Date(startAt).toISOString(),
            new Date(endAt).toISOString(),
        ]),
        runPostHogQuery(trafficSql),
    ]);
    if (cohorts.status === "rejected") {
        console.error("[IMENU_FUNNEL] Cohort query failed:", cohorts.reason);
        return NextResponse.json({ error: "Não foi possível carregar o funil iMenu." }, { status: 502 });
    }
    if (traffic.status === "rejected") {
        console.warn("[IMENU_FUNNEL] PostHog unavailable:", traffic.reason);
    }
    const getCounts = (period: "current" | "previous") => {
        const row = cohorts.value.rows.find(item => item.period === period);
        const visitors = traffic.status === "fulfilled"
            ? traffic.value.find(item => item[0] === period) : undefined;
        const num = (value: number | string | undefined) => Number(value || 0);
        return {
            visitors: traffic.status === "fulfilled" ? num(visitors?.[1] as number | string | undefined) : null,
            signupPage: traffic.status === "fulfilled" ? num(visitors?.[2] as number | string | undefined) : null,
            registered: num(row?.registered),
            restaurants: num(row?.restaurants),
            cardapio: num(row?.cardapio),
            horarios: num(row?.horarios),
            loja: num(row?.loja),
            finished: num(row?.finished),
            items: num(row?.items),
            firstOrder: num(row?.first_order),
            active: num(row?.active),
        };
    };
    return NextResponse.json({ ...getCounts("current"), previous: getCounts("previous") },
        { headers: { "Cache-Control": "no-store" } });
}
