"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import DevDialog from "./DevDialog";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";
import Badge from "@/components/ui/Badge";

import type {DateRange} from "@/lib/utils/dateRange";

type Alert = { id: string; source: string; title: string; message: string; severity: string;
    phone_notified: boolean|null; alarm_triggered: boolean|null; delivery_error:string|null;
    trigger_type:"notification"|"alarm"|"blast"|"none"|null; operation:string|null; http_status:number|null;
    occurrences:number; last_seen_at:string|null; resolved_at:string|null; created_at: string };

export default function AlertsSection({range}:{range?:DateRange}) {
    const [page, setPage] = useState(0);
    const [selected,setSelected] = useState<Alert|null>(null);
    const [data, setData] = useState<PageData<Alert>>({ rows: [], total: 0, page: 0, pageCount: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<PageData<Alert>>(`/api/dev/health?section=alerts&page=${page}&startDate=${range?.startDate||""}&endDate=${range?.endDate||""}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page,range?.startDate,range?.endDate]);
    useEffect(()=>setPage(0),[range?.startDate,range?.endDate]);
    return <section className={styles.externalSection}>
        <h2>Alertas</h2>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className={styles.alertsTable}><PagedTable pageSize={10} onRowClick={setSelected} data={data} onPage={setPage} rowKey={row => String(row.id)} loading={loading} columns={[
            { key: "date", label: "Data", render: row => formatDateTime(row.last_seen_at||row.created_at), className: "whitespace-nowrap" },
            { key: "source", label: "Origem", render: row => row.source === "phone" || row.source === "unknown" ? "Origem não registrada" : row.source },
            { key: "operation", label: "Operação", render: row => row.operation||"—" },
            { key: "trigger", label: "Trigger", render: row => {
                const t=row.trigger_type;
                if(!t)return "Não registrado";
                const labels={notification:"Notification",alarm:"Alarm",blast:"Blast",none:"None"} as const;
                const variants={notification:"info",alarm:"danger",blast:"brand",none:"neutral"} as const;
                return <Badge variant={variants[t]}>{labels[t]}</Badge>;
            } },
            { key: "count", label: "Ocorrências", render: row => row.occurrences>1?row.occurrences:"—" },
            { key: "title", label: "Alerta", render: row => <span className="block max-w-full truncate font-medium" title={`${row.title} · ${row.message}`}>{row.title}{row.http_status ? ` · HTTP ${row.http_status}` : ""}</span> },
        ]} /></div>
        <DevDialog open={Boolean(selected)} onClose={()=>setSelected(null)} title={selected?.title || "Alerta"}><>
            <div className="mb-3 space-y-1 text-sm text-gray-600">
                <p>Origem: {selected?.source || "—"} · Operação: {selected?.operation||"—"}</p>
                <p>HTTP: {selected?.http_status??"—"} · Ocorrências: {selected?.occurrences??1}</p>
                <p>Primeira ocorrência: {formatDateTime(selected?.created_at||null)}</p>
                <p>Última ocorrência: {formatDateTime(selected?.last_seen_at||selected?.created_at||null)}</p>
                <p>Status: {selected?.resolved_at?"Resolvido":selected?.trigger_type?"Em aberto":"Histórico"}</p>
                <p>Notificado no celular: {selected?.phone_notified==null?"Não registrado":selected.phone_notified?"Sim":"Não"}</p>
            </div>
            <p className="whitespace-pre-wrap text-sm leading-7">{selected?.message}</p>
            {selected?.delivery_error&&<p role="alert" className="text-red-700">{selected.delivery_error}</p>}
        </></DevDialog>
    </section>;
}
