import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { devPage, paged } from "@/lib/dev/pagination";
import { INTEGRATIONS } from "@/lib/dev/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;
    try {
        const params = new URL(request.url).searchParams;
        const page = devPage(params);
        const alertPageSize = 10;
        const validDate=(value:string|null)=>Boolean(value&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value))&&new Date(value+"T12:00:00Z").toISOString().slice(0,10)===value);
        const start=params.get("startDate"),end=params.get("endDate");
        if((start&&!validDate(start))||(end&&!validDate(end))||(start&&end&&start>end))return NextResponse.json({error:"Período inválido."},{status:400});
        const bounds=[start?`${start}T00:00:00-03:00`:null,end?`${end}T23:59:59.999-03:00`:null];
        if (params.get("section") === "alerts") {
            const [rows, count] = await Promise.all([
                query("SELECT id,source,title,message,severity,created_at,phone_notified,alarm_triggered,delivery_error,trigger_type,operation,http_status,occurrences,last_seen_at,resolved_at FROM public.dev_alerts WHERE ($3::timestamptz IS NULL OR COALESCE(last_seen_at,created_at) >= $3) AND ($4::timestamptz IS NULL OR COALESCE(last_seen_at,created_at) <= $4) ORDER BY COALESCE(last_seen_at,created_at) DESC,id DESC LIMIT $1 OFFSET $2", [alertPageSize, page * alertPageSize,...bounds]),
                query<{ total: number }>("SELECT COUNT(*)::int total FROM public.dev_alerts WHERE ($1::timestamptz IS NULL OR COALESCE(last_seen_at,created_at) >= $1) AND ($2::timestamptz IS NULL OR COALESCE(last_seen_at,created_at) <= $2)",bounds),
            ]);
            return NextResponse.json(paged(rows.rows, count.rows[0].total, page, alertPageSize));
        }
        const days = params.get("range") === "30d" ? 30 : params.get("range") === "7d" ? 7 : 1;
        const [latest, history, connections] = await Promise.all([
            query("SELECT reported_at,data FROM imenu_ops.health WHERE id=true"),
            query(`SELECT date_trunc($2,reported_at) AS reported_at,
                AVG(cpu_percent)::float8 cpu_percent,AVG(memory_percent)::float8 memory_percent,
                AVG(disk_percent)::float8 disk_percent FROM public.dev_health_history
                WHERE reported_at >= COALESCE($3::timestamptz,NOW()-($1*INTERVAL '1 day')) AND ($4::timestamptz IS NULL OR reported_at <= $4) GROUP BY 1 ORDER BY 1`, [days, start===end ? "minute" : "hour",...bounds]),
            query<{source:string;ok:boolean;http_status:number|null;checked_at:string;check_kind:string;state:string|null;operation:string|null;detail:string|null}>("SELECT source,ok,http_status,checked_at,check_kind,state,operation,detail FROM public.dev_integration_status"),
        ]);
        return NextResponse.json({ latest: latest.rows[0] || null, history: history.rows, connections: INTEGRATIONS.map(item=>{
            const found=connections.rows.find(row=>row.source===item.id && row.check_kind==="probe");
            if(!found)return {id:item.id,name:item.name,priority:item.priority,observation:null};
            const stale=Date.now()-Date.parse(found.checked_at)>45*60_000;
            return {id:item.id,name:item.name,priority:item.priority,observation:{
                state:stale?"unverified":found.state||"unverified",
                status:found.http_status,checkedAt:found.checked_at,
                operation:found.operation,detail:stale?"Verificação desatualizada.":found.detail
            }};
        }) });
    } catch {
        return NextResponse.json({ error: "Não foi possível carregar a saúde do sistema." }, { status: 500 });
    }
}
