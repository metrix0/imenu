"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import DevDialog from "./DevDialog";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";

import type {DateRange} from "@/lib/utils/dateRange";

type Alert = { id: string; source: string; title: string; message: string; severity: string; phone_notified: boolean|null; alarm_triggered: boolean|null; delivery_error:string|null; created_at: string };

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
        <PagedTable onRowClick={setSelected} data={data} onPage={setPage} rowKey={row => String(row.id)} loading={loading} columns={[
            { key: "date", label: "Data", render: row => formatDateTime(row.created_at), className: "whitespace-nowrap" },
            { key: "source", label: "Origem", render: row => row.source === "phone" ? "Origem não registrada" : row.source },
            {key:"phone",label:"Notificado no celular",render:row=>row.phone_notified==null?"Não registrado":row.phone_notified?"Sim":"Não"},
            {key:"alarm",label:"TRIGGER ALARM",render:row=>row.alarm_triggered==null?"Não registrado":row.alarm_triggered?"Sim":"Não"},
            { key: "title", label: "Alerta", render: row => <div className="max-w-2xl"><p className="font-medium">{row.title}</p><p className="mt-1 line-clamp-2 break-words text-xs text-gray-500">{row.message}</p></div> },
        ]} />
        <DevDialog open={Boolean(selected)} onClose={()=>setSelected(null)} title={selected?.title || "Alerta"}><><p className="whitespace-pre-wrap text-sm leading-7">{selected?.message}</p>{selected?.delivery_error&&<p role="alert" className="text-red-700">{selected.delivery_error}</p>}</></DevDialog>
    </section>;
}
