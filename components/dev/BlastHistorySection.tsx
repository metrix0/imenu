"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";

type Group = { id: string; created_at: string; message: string; sender: string; campaign_id: string | null; status?: string; total: number; sent: number; failed: number };
type Recipient = { id: string; phone: string; message: string; status: string; error: string | null; sent_at: string | null; scheduled_at?: string };
type Data = PageData<Group> & { automations: { name: string; route: string; rule: string }[] };

export default function BlastHistorySection({ refreshKey = 0 }: { refreshKey?: number }) {
    const [page, setPage] = useState(0);
    const [recipientPage, setRecipientPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [data, setData] = useState<Data>({ rows: [], total: 0, page: 0, pageCount: 1, automations: [] });
    const [recipients, setRecipients] = useState<PageData<Recipient>>({ rows: [], total: 0, page: 0, pageCount: 1 });
    const [selected, setSelected] = useState<Group | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [action, setAction] = useState("");
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<Data>(`/api/dev/support?section=blasts&page=${page}`, { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page, revision, refreshKey]);
    useEffect(() => {
        if (!selected) return;
        const controller = new AbortController();
        void devJson<PageData<Recipient>>(`/api/dev/support?section=blasts&group=${encodeURIComponent(selected.id)}&page=${recipientPage}`, { signal: controller.signal }).then(setRecipients).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => controller.abort();
    }, [selected, recipientPage, revision]);
    const hasRunning = data.rows.some(row => row.status === "running");
    useEffect(() => {
        if (!hasRunning) return;
        const timer = setInterval(() => { if (!document.hidden) setRevision(value => value + 1); }, 30000);
        return () => clearInterval(timer);
    }, [hasRunning]);
    async function status(row: Group, nextStatus: string) {
        setAction(row.id); setError("");
        try { await devJson("/api/dev/support", { method: "POST", body: JSON.stringify({ action: "set_blast_status", id: row.campaign_id, nextStatus }) }); setRevision(r => r + 1); }
        catch (e) { setError((e as Error).message); } finally { setAction(""); }
    }
    return <>
        <Card><h2 className="text-lg font-semibold">Blasts automáticos</h2><div className="mt-4 divide-y divide-gray-100">{data.automations.map(row => <div className="py-3" key={row.name}><h3 className="text-sm font-medium">{row.name}</h3><p className="mt-1 text-sm text-gray-500">{row.rule}</p></div>)}</div></Card>
        <section className="space-y-4"><div className="flex items-center justify-between gap-4"><h2 className="text-lg font-semibold">Todos os envios</h2><Button variant="secondary" loading={loading} onClick={() => setRevision(r => r + 1)}>Atualizar</Button></div>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            <PagedTable data={data} loading={loading} onPage={setPage} rowKey={r => r.id} onRowClick={r => { setRecipientPage(0); setRecipients({ rows: [], total: 0, page: 0, pageCount: 1 }); setSelected(r); }} columns={[
                { key: "date", label: "Data", render: r => formatDateTime(r.created_at) },
                { key: "message", label: "Mensagem / grupo", render: r => <p className="max-w-lg truncate" title={r.message}>{r.message}</p> },
                { key: "progress", label: "Envios", render: r => `${r.sent}/${r.total} · ${r.failed} falhas` },
                { key: "sender", label: "Remetente", render: r => r.sender === "blast" ? "WhatsApp Blast" : "Suporte" },
                { key: "actions", label: "", render: r => <div onClick={e => e.stopPropagation()} className="flex gap-2">{r.status === "running" && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "pause")}>Pausar</Button>}{r.status === "paused" && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "resume")}>Retomar</Button>}{["running", "paused"].includes(r.status || "") && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "cancel")}>Parar</Button>}</div> },
            ]} />
        </section>
        <Modal height="85dvh" open={Boolean(selected)} onClose={() => setSelected(null)} showCloseButton><div className="space-y-5 p-5"><h2 className="pr-8 text-lg font-semibold">Mensagens do envio</h2><PagedTable data={recipients} rowKey={r => r.id} onPage={setRecipientPage} columns={[
            { key: "phone", label: "Contato", render: r => r.phone },
            { key: "message", label: "Mensagem", render: r => <p className="min-w-48 max-w-lg whitespace-pre-wrap">{r.message}</p> },
            { key: "status", label: "Status", render: r => <div><p>{r.status}</p>{r.error && <p className="text-red-700">{r.error}</p>}</div> },
            { key: "date", label: "Data", render: r => r.sent_at ? formatDateTime(r.sent_at) : r.scheduled_at ? formatDateTime(r.scheduled_at) : "—" },
        ]} /></div></Modal>
    </>;
}
