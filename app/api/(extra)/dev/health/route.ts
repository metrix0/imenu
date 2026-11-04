import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { devPage, DEV_PAGE_SIZE, paged } from "@/lib/dev/pagination";
import { integrationObservations } from "@/lib/dev/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;
    try {
        const params = new URL(request.url).searchParams;
        const page = devPage(params);
        if (params.get("section") === "alerts") {
            const [rows, count] = await Promise.all([
                query("SELECT id,source,title,message,severity,created_at FROM public.dev_alerts ORDER BY created_at DESC,id DESC LIMIT $1 OFFSET $2", [DEV_PAGE_SIZE, page * DEV_PAGE_SIZE]),
                query<{ total: number }>("SELECT COUNT(*)::int total FROM public.dev_alerts"),
            ]);
            return NextResponse.json(paged(rows.rows, count.rows[0].total, page));
        }
        const days = params.get("range") === "30d" ? 30 : params.get("range") === "7d" ? 7 : 1;
        const [latest, history, failures] = await Promise.all([
            query("SELECT reported_at,data FROM imenu_ops.health WHERE id=true"),
            query(`SELECT date_trunc($2,reported_at) AS reported_at,
                AVG(cpu_percent)::float8 cpu_percent,AVG(memory_percent)::float8 memory_percent,
                AVG(disk_percent)::float8 disk_percent FROM public.dev_health_history
                WHERE reported_at >= NOW()-($1*INTERVAL '1 day') GROUP BY 1 ORDER BY 1`, [days, days === 1 ? "minute" : "hour"]),
            query("SELECT DISTINCT ON(source) source,created_at,title,message FROM public.dev_alerts WHERE source <> 'phone' AND created_at > NOW()-INTERVAL '1 day' ORDER BY source,created_at DESC"),
        ]);
        return NextResponse.json({ latest: latest.rows[0] || null, history: history.rows, connections: integrationObservations(), failures: failures.rows });
    } catch {
        return NextResponse.json({ error: "Não foi possível carregar a saúde do sistema." }, { status: 500 });
    }
}
