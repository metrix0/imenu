"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import DevDialog from "./DevDialog";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";

type Alert = { id: string; source: string; title: string; message: string; severity: string; created_at: string };

export default function AlertsSection() {
    const [page, setPage] = useState(0);
    const [selected,setSelected] = useState<Alert|null>(null);
    const [data, setData] = useState<PageData<Alert>>({ rows: [], total: 0, page: 0, pageCount: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<PageData<Alert>>(`/api/dev/health?section=alerts&page=${page}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page]);
    return <section className={styles.section}>
        <div className={styles.sectionHeader}><h2 className="text-lg font-semibold">Alertas</h2></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <PagedTable onRowClick={setSelected} data={data} onPage={setPage} rowKey={row => String(row.id)} loading={loading} columns={[
            { key: "date", label: "Data", render: row => formatDateTime(row.created_at), className: "whitespace-nowrap" },
            { key: "source", label: "Origem", render: row => row.source === "phone" ? "Celular" : row.source },
            { key: "title", label: "Alerta", render: row => <div className="max-w-2xl"><p className="font-medium">{row.title}</p><p className="mt-1 line-clamp-2 break-words text-xs text-gray-500">{row.message}</p></div> },
        ]} />
        <DevDialog open={Boolean(selected)} onClose={()=>setSelected(null)} title={selected?.title || "Alerta"}><p className="whitespace-pre-wrap text-sm leading-7">{selected?.message}</p></DevDialog>
    </section>;
}
