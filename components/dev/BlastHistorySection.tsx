"use client";

import { useEffect, useState } from "react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import DevDialog from "./DevDialog";
import styles from "./dashboard.module.css";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";

type Group = { id: string; created_at: string; message: string; sender: string; campaign_id: string | null; status?: string; total: number; sent: number; failed: number };
type Recipient = { id: string; phone: string; message: string; status: string; error: string | null; sent_at: string | null; scheduled_at?: string };
type Data = PageData<Group> & { automations: { name: string; route: string; rule: string }[] };

export default function BlastHistorySection({ refreshKey = 0 }: { refreshKey?: number }) {
    const [view,setView] = useState("Destinatários");
    const [campaigns,setCampaigns] = useState<PageData<Group>>({rows:[],total:0,page:0,pageCount:1});
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
        void devJson<PageData<Recipient>>(`/api/dev/support?section=blasts&group=${encodeURIComponent(selected.id)}&page=${recipientPage}${view === "Campanhas" ? "&view=campaigns" : ""}`, { signal: controller.signal }).then(result=>{if(view==="Campanhas")setCampaigns(result as unknown as PageData<Group>);else setRecipients(result)}).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => controller.abort();
    }, [selected, recipientPage, revision,view]);
    async function status(row: Group, nextStatus: string) {
        setAction(row.id); setError("");
        try { await devJson("/api/dev/support", { method: "POST", body: JSON.stringify({ action: "set_blast_status", id: row.campaign_id, nextStatus }) }); setRevision(r => r + 1); }
        catch (e) { setError((e as Error).message); } finally { setAction(""); }
    }
    return <>

        <section className={styles.section}><div className={styles.sectionHeader}><h2>Todos os envios</h2></div>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            <PagedTable data={data} loading={loading} onPage={setPage} rowKey={r => r.id} onRowClick={r => { setRecipientPage(0); setRecipients({ rows: [], total: 0, page: 0, pageCount: 1 }); setView("Destinatários"); setSelected(r); }} columns={[
                { key: "date", label: "Data", render: r => formatDateTime(r.created_at) },
                { key: "message", label: "Mensagem / grupo", render: r => <p className="max-w-lg truncate" title={r.message}>{r.id==="automation:recovery" ? "Recuperação e ativação · Automático" : r.id.startsWith("congratulations:") ? "Boas-vindas iMenu Plus · "+r.message : r.id.startsWith("followup:") ? "Follow-up · "+r.message : r.id.startsWith("customer:") ? "Automação de clientes · "+r.message : r.message}</p> },
                { key: "progress", label: "Envios", render: r => `${r.sent}/${r.total} · ${r.failed} falhas` },
                { key: "sender", label: "Remetente", render: r => r.sender === "blast" ? "WhatsApp Blast" : "Suporte" },
                { key: "actions", label: "", render: r => r.id==="automation:recovery" ? <Button variant="secondary" onClick={event=>{event.stopPropagation();setRecipientPage(0);setSelected(r);setView("Campanhas")}}>Ver campanhas</Button> : <div onClick={e => e.stopPropagation()} className="flex gap-2">{r.status === "running" && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "pause")}>Pausar</Button>}{r.status === "paused" && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "resume")}>Retomar</Button>}{["running", "paused"].includes(r.status || "") && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "cancel")}>Parar</Button>}</div> },
            ]} />
        </section>
        <details className={`${styles.section} ${styles.disclosure}`}><summary className={styles.sectionHeader}><h2>Blasts automáticos</h2></summary><div className="grid gap-5 p-5 md:grid-cols-2">{data.automations.map(row => <div className="py-3" key={row.name}><h3 className="text-sm font-medium">{row.name}</h3><p className="mt-1 text-sm text-gray-500">{row.rule}</p></div>)}</div></details>
        <DevDialog title="Mensagens do envio" open={Boolean(selected)} onClose={() => setSelected(null)}><div className="space-y-5 p-5">{selected?.id === "automation:recovery" && <Tabs tabs={["Destinatários","Campanhas"]} active={view} onChange={value=>{setView(value);setRecipientPage(0)}}/>}{selected?.id.startsWith("campaign:") && <Button variant="secondary" onClick={()=>{const group=data.rows.find(r=>r.id==="automation:recovery");if(group){setSelected(group);setView("Campanhas");setRecipientPage(0)}}}>Voltar ao histórico</Button>}{view === "Campanhas" ? <PagedTable data={campaigns} rowKey={r=>r.id} onPage={setRecipientPage} onRowClick={r=>{setSelected(r);setRecipientPage(0);setView("Destinatários")}} columns={[
{key:"date",label:"Data",render:r=>formatDateTime(r.created_at)},{key:"message",label:"Campanha",render:r=><p className="max-w-lg line-clamp-3 text-xs leading-5">{r.message}</p>},{key:"progress",label:"Enviados",render:r=>`${r.sent}/${r.total} · ${r.failed} falhas`},{key:"actions",label:"",render:r=><div className="flex gap-2" onClick={e=>e.stopPropagation()}>{r.status==="running" && <Button variant="secondary" onClick={()=>void status(r,"pause")}>Pausar</Button>}{r.status==="paused" && <Button variant="secondary" onClick={()=>void status(r,"resume")}>Retomar</Button>}{["running","paused"].includes(r.status||"") && <Button variant="secondary" onClick={()=>void status(r,"cancel")}>Parar</Button>}</div>}
]}/> : <PagedTable data={recipients} rowKey={r => r.id} onPage={setRecipientPage} columns={[
            { key: "phone", label: "Contato", render: r => r.phone },
            { key: "message", label: "Mensagem", render: r => <p className="min-w-48 max-w-lg whitespace-pre-wrap">{r.message}</p> },
            { key: "status", label: "Status", render: r => <div><p>{r.status}</p>{r.error && <p className="text-red-700">{r.error}</p>}</div> },
            { key: "date", label: "Data", render: r => r.sent_at ? formatDateTime(r.sent_at) : r.scheduled_at ? formatDateTime(r.scheduled_at) : "—" },
        ]} />}</div></DevDialog>
    </>;
}
