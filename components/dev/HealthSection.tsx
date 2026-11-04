"use client";

import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import Tabs from "@/components/ui/Tabs";
import Card from "@/components/ui/Card";
import Loader from "@/components/ui/Loader";
import DataTable from "@/components/ui/DataTable";
import AlertsSection from "./AlertsSection";
import { MetricChart } from "./DashboardPresentation";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);
type Health = {
    latest: { reported_at: string; data: { cpu_used_percent?: number; memory_used_percent: number; disk_used_percent: number; containers?: Record<string, string>; operations?: { alerts?: string[] } } } | null;
    history: { reported_at: string; cpu_percent: number | null; memory_percent: number; disk_percent: number }[];
    connections: { id: string; name: string; priority: number; observation: { ok: boolean; status: number | null; checkedAt: string } | null }[];
    failures: { source: string; created_at: string; message: string }[];
};

export default function HealthSection() {
    const [range, setRange] = useState("24h");
    const [data, setData] = useState<Health | null>(null);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        const load = () => {
            if (document.hidden) return;
            void devJson<Health>(`/api/dev/health?range=${range}`, { signal: controller.signal }).then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        };
        load(); const timer = setInterval(load, 300000);
        return () => { controller.abort(); clearInterval(timer); };
    }, [range]);
    const sample = data?.latest?.data;
    const stale = data?.latest && Date.now() - new Date(data.latest.reported_at).getTime() > 15 * 60000;
    return <>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {!data ? <Loader /> : <>
            <div className="flex flex-wrap items-center justify-between gap-4"><p className={`text-sm ${stale ? "text-red-700" : "text-gray-500"}`}>{data.latest ? `Última leitura: ${formatDateTime(data.latest.reported_at)}${stale ? " · monitor sem atualização" : ""}` : "Aguardando primeira leitura do monitor."}</p><Tabs tabs={["24h", "7d", "30d"]} active={range} onChange={setRange} /></div>
            <div className="grid gap-4 sm:grid-cols-3">{[["CPU", sample?.cpu_used_percent], ["Memória", sample?.memory_used_percent], ["Disco", sample?.disk_used_percent]].map(([label, value]) => <Card key={label}><p className="text-sm text-gray-500">{label}</p><p className="mt-2 text-2xl font-semibold">{value == null ? "—" : `${Number(value).toFixed(1)}%`}</p></Card>)}</div>
            <div className="grid gap-4 lg:grid-cols-3">{([['CPU', 'cpu_percent'], ['Memória', 'memory_percent'], ['Disco', 'disk_percent']] as const).map(([title, key]) => <MetricChart key={key} title={title} color="#d93d00" percentage series={data.history.filter(row => row[key] !== null).map(row => ({ label: new Date(row.reported_at).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), value: Number(row[key]) }))} />)}</div>
            <section className="space-y-4"><h2 className="text-lg font-semibold">Conexões</h2>
                <DataTable rows={data.connections} rowKey={row => row.id} columns={[
                    { key: "name", label: "Integração", render: row => row.name },
                    { key: "priority", label: "Prioridade", render: row => row.priority === 1 ? "Crítica" : row.priority === 2 ? "Alta" : "Normal" },
                    { key: "status", label: "Última verificação", render: row => { const failure = data.failures.find(f => f.source === row.id); const observation = row.observation; const newerFailure = failure && (!observation || new Date(failure.created_at).getTime() > new Date(observation.checkedAt).getTime()); return <span className={newerFailure || observation?.ok === false ? "text-red-700" : "text-gray-600"}>{newerFailure ? `${failure.message} · ${formatDateTime(failure.created_at)}` : observation ? `${observation.ok ? "Conectado" : "Falha"} · ${formatDateTime(observation.checkedAt)}` : "Aguardando uso"}</span>; } },
                ]} /><p className="text-xs text-gray-500">Verificações acompanham chamadas reais, sem consultas extras aos provedores.</p>
            </section>
            <section className="space-y-4"><h2 className="text-lg font-semibold">Serviços VPS</h2><DataTable rows={Object.entries(sample?.containers || {}).map(([name, status]) => ({ name, status }))} rowKey={row => row.name} columns={[{ key: "name", label: "Serviço", render: row => row.name }, { key: "status", label: "Estado", render: row => row.status }]} /></section>
        </>}
        <AlertsSection />
    </>;
}
