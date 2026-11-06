"use client";

import { useEffect, useState } from "react";
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

function MessageSummary({ row }: { row: Group }) {
    const type = row.id === "automation:recovery" ? "Recuperação e ativação" : row.id.startsWith("congratulations:") ? "Boas-vindas iMenu Plus" : row.id.startsWith("followup:") ? "Follow-up" : row.id.startsWith("customer:") ? "Automação de clientes" : null;
    return <div className={styles.messageSummary}>{type && <Badge variant="neutral">{type}</Badge>}{row.id !== "automation:recovery" && <p className={styles.messagePreview} title={row.message}>{row.message}</p>}{row.id === "automation:recovery" && <p className="text-xs text-gray-500">Campanhas automáticas agrupadas</p>}</div>;
}

function SendProgress({ row }: { row: Group }) {
    return <div className="whitespace-nowrap tabular-nums"><p className="font-medium">{row.sent.toLocaleString("pt-BR")} <span className="font-normal text-gray-500">/ {row.total.toLocaleString("pt-BR")}</span></p>{row.failed > 0 && <p className="mt-1 text-xs text-red-700">{row.failed} falha(s)</p>}</div>;
}

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
    const [detailsLoading, setDetailsLoading] = useState(true);
    const [action, setAction] = useState("");
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<Data>(`/api/dev/support?section=blasts&page=${page}`, { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page, revision, refreshKey]);
    useEffect(() => {
        if (!selected) return;
        const controller = new AbortController(); setDetailsLoading(true);
        void devJson<PageData<Recipient>>(`/api/dev/support?section=blasts&group=${encodeURIComponent(selected.id)}&page=${recipientPage}${view === "Campanhas" ? "&view=campaigns" : ""}`, { signal: controller.signal }).then(result=>{if(view==="Campanhas")setCampaigns(result as unknown as PageData<Group>);else setRecipients(result)}).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setDetailsLoading(false); });
        return () => controller.abort();
    }, [selected, recipientPage, revision,view]);
    async function status(row: Group, nextStatus: string) {
        setAction(row.id); setError("");
        try { await devJson("/api/dev/support", { method: "POST", body: JSON.stringify({ action: "set_blast_status", id: row.campaign_id, nextStatus }) }); setRevision(r => r + 1); }
        catch (e) { setError((e as Error).message); } finally { setAction(""); }
    }
    return <>

        <section className={`${styles.section} ${styles.scrollTable}`}><div className={styles.sectionHeader}><h2>Todos os envios</h2><span className="text-xs text-gray-500">{data.total.toLocaleString("pt-BR")} grupos</span></div>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            <PagedTable data={data} loading={loading} onPage={setPage} rowKey={r => r.id} onRowClick={r => { setRecipientPage(0); setRecipients({ rows: [], total: 0, page: 0, pageCount: 1 }); setView("Destinatários"); setSelected(r); }} columns={[
                { key: "date", label: "Data", className: styles.dateCell, render: r => <div>{formatDateTime(r.created_at).split(", ").map((part, index) => <p key={index} className={index ? "mt-1 text-xs text-gray-500" : ""}>{part}</p>)}</div> },
                { key: "message", label: "Mensagem / grupo", render: r => <MessageSummary row={r} /> },
                { key: "progress", label: "Envios", render: r => <SendProgress row={r} /> },
                { key: "sender", label: "Remetente", className: "whitespace-nowrap", render: r => r.sender === "blast" ? "WhatsApp Blast" : "Suporte" },
                { key: "actions", label: "", render: r => r.id==="automation:recovery" ? <Button variant="secondary" onClick={event=>{event.stopPropagation();setRecipientPage(0);setSelected(r);setView("Campanhas")}}>Ver campanhas</Button> : <div onClick={e => e.stopPropagation()} className="flex gap-2">{r.status === "running" && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "pause")}>Pausar</Button>}{r.status === "paused" && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "resume")}>Retomar</Button>}{["running", "paused"].includes(r.status || "") && <Button variant="secondary" loading={action === r.id} onClick={() => void status(r, "cancel")}>Parar</Button>}</div> },
            ]} />
        </section>
        <details className={`${styles.section} ${styles.disclosure}`}><summary className={styles.sectionHeader}><h2>Blasts automáticos</h2></summary><div className="grid gap-5 p-5 md:grid-cols-2">{data.automations.map(row => <div className="py-3" key={row.name}><h3 className="text-sm font-medium">{row.name}</h3><p className="mt-1 text-sm text-gray-500">{row.rule}</p></div>)}</div></details>
        <DevDialog title="Mensagens do envio" open={Boolean(selected)} onClose={() => setSelected(null)}><div className="space-y-5 p-5">{error && <p role="alert" className="text-sm text-red-700">{error}</p>}{selected?.id === "automation:recovery" && <Tabs tabs={["Destinatários","Campanhas"]} active={view} onChange={value=>{setView(value);setRecipientPage(0)}}/>}{selected?.id.startsWith("campaign:") && <Button variant="secondary" onClick={()=>{const group=data.rows.find(r=>r.id==="automation:recovery");if(group){setSelected(group);setView("Campanhas");setRecipientPage(0)}}}>Voltar ao histórico</Button>}{view === "Campanhas" ? <PagedTable data={campaigns} loading={detailsLoading} rowKey={r=>r.id} onPage={setRecipientPage} onRowClick={r=>{setSelected(r);setRecipientPage(0);setView("Destinatários")}} columns={[
{key:"date",label:"Data",className:styles.dateCell,render:r=>formatDateTime(r.created_at)},{key:"message",label:"Campanha",render:r=><p className="min-w-56 max-w-lg line-clamp-3 text-xs leading-5">{r.message}</p>},{key:"progress",label:"Enviados",render:r=><SendProgress row={r}/>},{key:"actions",label:"",render:r=><div className="flex gap-2" onClick={e=>e.stopPropagation()}>{r.status==="running" && <Button variant="secondary" onClick={()=>void status(r,"pause")}>Pausar</Button>}{r.status==="paused" && <Button variant="secondary" onClick={()=>void status(r,"resume")}>Retomar</Button>}{["running","paused"].includes(r.status||"") && <Button variant="secondary" onClick={()=>void status(r,"cancel")}>Parar</Button>}</div>}
]}/> : <PagedTable data={recipients} loading={detailsLoading} rowKey={r => r.id} onPage={setRecipientPage} columns={[
            { key: "phone", label: "Contato", className: "whitespace-nowrap", render: r => r.phone },
            { key: "message", label: "Mensagem", render: r => <p className="min-w-48 max-w-lg whitespace-pre-wrap">{r.message}</p> },
            { key: "status", label: "Status", render: r => <div><p>{r.status}</p>{r.error && <p className="text-red-700">{r.error}</p>}</div> },
            { key: "date", label: "Data", className: styles.dateCell, render: r => r.sent_at ? formatDateTime(r.sent_at) : r.scheduled_at ? formatDateTime(r.scheduled_at) : "—" },
        ]} />}</div></DevDialog>
    </>;
}
