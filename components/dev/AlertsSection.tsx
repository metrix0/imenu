"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";

type Alert = { id: string; source: string; title: string; message: string; severity: string; created_at: string };

export default function AlertsSection() {
    const [page, setPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [data, setData] = useState<PageData<Alert>>({ rows: [], total: 0, page: 0, pageCount: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<PageData<Alert>>(`/api/dev/health?section=alerts&page=${page}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page, revision]);
    return <section className="space-y-4">
        <div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Alertas</h2><Button variant="secondary" loading={loading} onClick={() => setRevision(r => r + 1)}>Atualizar</Button></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <PagedTable data={data} onPage={setPage} rowKey={row => String(row.id)} loading={loading} columns={[
            { key: "date", label: "Data", render: row => formatDateTime(row.created_at), className: "whitespace-nowrap" },
            { key: "source", label: "Origem", render: row => row.source === "phone" ? "Celular" : row.source },
            { key: "title", label: "Alerta", render: row => <div className="max-w-2xl"><p className="font-medium">{row.title}</p><p className="mt-1 whitespace-pre-wrap break-words text-gray-500">{row.message}</p></div> },
        ]} />
    </section>;
}
