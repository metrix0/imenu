import { NextResponse } from "next/server";
import { authorize } from "@/lib/dev/authorize";
import { query } from "@/lib/database/sql";
import { devPage, paged } from "@/lib/dev/pagination";
import { INTEGRATIONS } from "@/lib/dev/health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Individual Gemini-to-OpenAI fallbacks are diagnostic events, not alerts.
// Keep them in dev_alerts so the hourly recurrence threshold still counts them.
const VISIBLE_ALERT_FILTER = "(source IS DISTINCT FROM 'gemini' OR operation IS DISTINCT FROM 'Importação de cardápio: fallback OpenAI' OR severity IS DISTINCT FROM 'info' OR trigger_type IS DISTINCT FROM 'none')";
const UNREAD_ALERT_FILTER = "(read_at IS NULL OR (resolved_at IS NULL AND last_seen_at > read_at))";

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
            const history = params.get("view") === "history";
            // A newly repeated incident is unread again until acknowledged.
            const filter = history
                ? "(read_at IS NOT NULL AND (resolved_at IS NOT NULL OR last_seen_at IS NULL OR last_seen_at <= read_at))"
                : UNREAD_ALERT_FILTER;
            const dates = history ? bounds : [null, null];
            // History is dated by acknowledgement, so an older alert just marked
            // as read appears immediately in the selected day's history.
            const timestamp = history ? "read_at" : "COALESCE(last_seen_at,created_at)";
            const where = `${filter} AND ${VISIBLE_ALERT_FILTER} AND ($3::timestamptz IS NULL OR ${timestamp} >= $3) AND ($4::timestamptz IS NULL OR ${timestamp} <= $4)`;
            const [rows, count] = await Promise.all([
                query(`SELECT id,source,title,message,severity,created_at,phone_notified,alarm_triggered,delivery_error,trigger_type,operation,http_status,occurrences,last_seen_at,resolved_at FROM public.dev_alerts WHERE ${where} ORDER BY ${timestamp} DESC,id DESC LIMIT $1 OFFSET $2`, [alertPageSize, page * alertPageSize,...dates]),
                query<{ total: number }>(`SELECT COUNT(*)::int total FROM public.dev_alerts WHERE ${filter} AND ${VISIBLE_ALERT_FILTER} AND ($1::timestamptz IS NULL OR ${timestamp} >= $1) AND ($2::timestamptz IS NULL OR ${timestamp} <= $2)`,dates),
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
        const delivery = latest.rows[0]?.data?.operations?.webhook_delivery;
        return NextResponse.json({ latest: latest.rows[0] || null, history: history.rows, connections: INTEGRATIONS.map(item=>{
            if(item.id==="waha_webhooks"){
                if(!delivery)return {id:item.id,name:item.name,priority:item.priority,observation:null};
                const checkedAt=typeof delivery.checked_at==="string" ? delivery.checked_at : null;
                const stale=!checkedAt || !Number.isFinite(Date.parse(checkedAt)) || Date.now()-Date.parse(checkedAt)>45*60_000;
                const state=["connected","degraded","failed","unverified"].includes(delivery.state) ? delivery.state : "unverified";
                return {id:item.id,name:item.name,priority:item.priority,observation:{
                    state:stale?"unverified":state,status:delivery.http_status??null,
                    checkedAt,operation:"Entrega de webhook",
                    detail:stale?"Verificação desatualizada.":delivery.detail||"Sem dados de entrega."
                }};
            }
            const found=connections.rows.find(row=>row.source===item.id && row.check_kind==="probe");
            if(!found)return {id:item.id,name:item.name,priority:item.priority,observation:null};
            const freshnessMs = item.id === "tomtom" || item.id === "arcgis" ? 26*60*60_000 : 45*60_000;
            const stale=Date.now()-Date.parse(found.checked_at)>freshnessMs;
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

export async function POST(request: Request) {
    const denied = await authorize(request);
    if (denied) return denied;
    if (new URL(request.url).searchParams.get("section") !== "alerts") {
        return NextResponse.json({ error: "Operação inválida." }, { status: 400 });
    }
    const body = await request.json().catch(() => null);
    if (body?.all === true && body?.id === undefined) {
        try {
            await query(`UPDATE public.dev_alerts SET read_at = NOW() WHERE ${UNREAD_ALERT_FILTER} AND ${VISIBLE_ALERT_FILTER}`);
            return NextResponse.json({ ok: true });
        } catch {
            return NextResponse.json({ error: "Não foi possível marcar todos os alertas como lidos." }, { status: 500 });
        }
    }
    if (typeof body?.id !== "string" || !/^[1-9]\d{0,18}$/.test(body.id)) {
        return NextResponse.json({ error: "Alerta inválido." }, { status: 400 });
    }
    try {
        const updated = await query<{ id: string }>(
            "UPDATE public.dev_alerts SET read_at = NOW() WHERE id = $1 RETURNING id",
            [body.id]
        );
        if (!updated.rows.length) {
            return NextResponse.json({ error: "Alerta não encontrado." }, { status: 404 });
        }
        return NextResponse.json({ ok: true });
    } catch {
        return NextResponse.json({ error: "Não foi possível marcar o alerta como lido." }, { status: 500 });
    }
}
