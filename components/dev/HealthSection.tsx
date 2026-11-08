"use client";

import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import type { DateRange } from "@/lib/utils/dateRange";
import styles from "./dashboard.module.css";
import DevLoading from "./DevLoading";
import DataTable from "@/components/ui/DataTable";
import Badge from "@/components/ui/Badge";
import AlertsSection from "./AlertsSection";
import { MetricChart } from "./DashboardPresentation";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);
type Health = {
    latest: { reported_at: string; data: { cpu_used_percent?: number; memory_used_percent: number; disk_used_percent: number; containers?: Record<string, string>; operations?: { alerts?: string[] } } } | null;
    history: { reported_at: string; cpu_percent: number | null; memory_percent: number; disk_percent: number }[];
    connections: { id: string; name: string; priority: number; observation: { state: "connected" | "degraded" | "failed" | "unverified"; status: number | null; checkedAt: string; operation: string | null; detail: string | null } | null }[];
    failures: { source: string; created_at: string; message: string }[];
};

export default function HealthSection({range}:{range:DateRange}) {
    const [data, setData] = useState<Health | null>(null);
    const [error, setError] = useState("");
    const [alertRefresh, setAlertRefresh] = useState(0);
    useEffect(() => {
        const controller = new AbortController();
        setData(null);
        const load = () => {
            void devJson<Health>(`/api/dev/health?startDate=${range.startDate}&endDate=${range.endDate}`, { signal: controller.signal }).then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        };
        load();
        return () => { controller.abort(); };
    }, [range.startDate,range.endDate]);
    const sample = data?.latest?.data;
    return <>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {!data ? error ? null : <DevLoading /> : <>
            <section className={styles.externalSection}><h2>Uso do VPS</h2><div className={`${styles.section} ${styles.chartGrid}`}>{([['CPU','cpu_percent',sample?.cpu_used_percent],['Memória','memory_percent',sample?.memory_used_percent],['Disco','disk_percent',sample?.disk_used_percent]] as const).map(([title,key,value])=><MetricChart embedded key={key} title={title} value={value == null ? "—" : `${Number(value).toLocaleString("pt-BR",{maximumFractionDigits:1})}%`} color="#d93d00" percentage series={data.history.filter(row=>row[key]!==null).map(row=>({label:new Date(row.reported_at).toLocaleString("pt-BR",range.startDate===range.endDate?{hour:"2-digit",minute:"2-digit"}:{day:"2-digit",month:"2-digit"}),value:Number(row[key])}))}/>)}</div></section>
            <section className={styles.externalSection}><h2>Conexões</h2>
                <DataTable rows={data.connections} rowKey={row => row.id} columns={[
                    { key: "name", label: "Integração", render: row => <div><div>{row.name}</div>{row.observation?.operation && <div className="mt-1 text-xs text-gray-500">{row.observation.operation}</div>}</div> },
                    { key: "priority", label: "Prioridade", render: row => row.priority === 1 ? "Crítica" : row.priority === 2 ? "Alta" : "Normal" },
                    { key: "status", label: "Status", render: row => {
                        const observation = row.observation;
                        const state = observation?.state || "unverified";
                        const variants = {connected:"success",degraded:"warning",failed:"danger",unverified:"neutral"} as const;
                        const labels = {connected:"Conectado",degraded:"Degradado",failed:"Falha",unverified:"Sem verificação"};
                        return <Badge variant={variants[state]}>{labels[state]}</Badge>;
                    } },
                    { key:"details",label:"Diagnóstico",render:row=>row.observation?.detail||"—" },
                    { key:"checked",label:"Última verificação",render:row=>formatDateTime(row.observation?.checkedAt||null),className:"whitespace-nowrap" },
                ]} />
            </section>

        </>}
        <AlertsSection mode="unread" refresh={alertRefresh} onMarkedRead={() => setAlertRefresh(value => value + 1)} />
        <AlertsSection mode="history" range={range} refresh={alertRefresh} />
    </>;
}
