"use client";

import { useEffect, useState } from "react";
import {Eye} from "lucide-react";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import DevDialog from "./DevDialog";
import PagedTable, { type PageData } from "./PagedTable";
import { useDevProfile } from "./DevProfileProvider";
import styles from "./dashboard.module.css";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";
import { formatPhone, statusPresentation } from "@/lib/dev/supportView";
import type { Connection } from "@/lib/dev/supportTypes";

type Target = { restaurant_id: string; name: string; kind: string };
type Destination = { phone?: string | null; profiles?: Target[] };
type Group = Destination & { id: string; created_at: string; message: string; sender: string; campaign_id: string | null; status?: string; total: number; sent: number; failed: number };
type Recipient = Destination & { id: string; message: string; status: string; error: string | null; sent_at: string | null; scheduled_at?: string };
type Automation = { id: string; name: string; message: string | null; sender: string };
type Data = PageData<Group> & { automations: Automation[] };
type Connections = { support: Connection | null; blast: Connection | null };
const empty = <T,>(): PageData<T> => ({ rows: [], total: 0, page: 0, pageCount: 1 });
const compactButton = "!min-h-8 !px-3 !py-1.5 whitespace-nowrap";
function groupLabel(row: Group) {
    return row.id === "automation:recovery" ? "Recuperação e ativação" : row.id.startsWith("congratulations:") ? "Boas-vindas iMenu Plus" : row.id.startsWith("followup:") ? "Follow-up" : row.id.startsWith("customer:") ? "Automação de clientes" : row.id.startsWith("payout:") ? "Problemas com repasse" : row.id.startsWith("expiry:") ? "Vencimento iMenu Plus" : null;
}
function SendProgress({ row }: { row: Group }) {
    return <span className="whitespace-nowrap tabular-nums">{row.sent} / {row.total}</span>;
}
function Sender({ sender, connections }: { sender:string;connections:Connections }) {
 const connection=sender==="blast"?connections.blast:connections.support;
 const status=statusPresentation(connection);
 const healthy=connection?.desired_state==="connected"&&connection.status==="WORKING";
 return <span className="inline-flex max-w-full items-center gap-2 whitespace-nowrap" title={connection?.last_error||status.label}><span role="img" aria-label={status.label} className={`h-2 w-2 shrink-0 rounded-full ${healthy?"bg-green-600":connection?.status==="UNKNOWN"||!connection?"bg-gray-400":"bg-red-600"}`}/><span className="truncate">{sender==="blast"?"Blast":"Suporte"}</span></span>;
}

export default function BlastHistorySection({ refreshKey = 0, connections }: { refreshKey?: number; connections: Connections }) {
    const { openProfile } = useDevProfile();
    const [page, setPage] = useState(0);
    const [automationPage, setAutomationPage] = useState(0);
    const [recipientPage, setRecipientPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [data, setData] = useState<Data>({ ...empty<Group>(), automations: [] });
    const [recipients, setRecipients] = useState(empty<Recipient>);
    const [campaigns, setCampaigns] = useState(empty<Group>);
    const [selected, setSelected] = useState<Group | null>(null);
    const [view, setView] = useState("Destinatários");
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    const [detailsLoading, setDetailsLoading] = useState(true);
    const [action, setAction] = useState("");
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<Data>(`/api/dev/support?section=blasts&page=${page}`, { signal: controller.signal }).then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page, revision, refreshKey]);
    useEffect(() => {
        if (!selected) return;
        const controller = new AbortController(); setDetailsLoading(true);
        void devJson<PageData<Recipient>>(`/api/dev/support?section=blasts&group=${encodeURIComponent(selected.id)}&page=${recipientPage}${view === "Campanhas" ? "&view=campaigns" : ""}`, { signal: controller.signal }).then(result => { if (view === "Campanhas") setCampaigns(result as unknown as PageData<Group>); else setRecipients(result); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setDetailsLoading(false); });
        return () => controller.abort();
    }, [selected, recipientPage, revision, view]);
    const openDetails = (row: Group) => { setRecipientPage(0); setRecipients(empty<Recipient>()); setView("Destinatários"); setSelected(row); };
    async function changeStatus(row: Group, nextStatus: string) {
        setAction(row.id); setError("");
        try { await devJson("/api/dev/support", { method: "POST", body: JSON.stringify({ action: "set_blast_status", id: row.campaign_id, nextStatus }) }); setRevision(r => r + 1); }
        catch (e) { setError((e as Error).message); } finally { setAction(""); }
    }
    const campaignActions = (row: Group) => <div className="flex gap-2" onClick={e => e.stopPropagation()}>{row.status === "running" && <Button variant="secondary" className={compactButton} loading={action === row.id} onClick={() => void changeStatus(row, "pause")}>Pausar</Button>}{row.status === "paused" && <Button variant="secondary" className={compactButton} loading={action === row.id} onClick={() => void changeStatus(row, "resume")}>Retomar</Button>}{["running", "paused"].includes(row.status || "") && <Button variant="secondary" className={compactButton} loading={action === row.id} onClick={() => void changeStatus(row, "cancel")}>Parar</Button>}</div>;
    const destination = (row: Destination, group?: Group) => row.profiles?.length ? <div className="flex flex-wrap gap-x-3 gap-y-1">{row.profiles.map(target => <button key={target.restaurant_id} className={styles.profileLink} title={target.name} onClick={event => { event.stopPropagation(); setSelected(null); openProfile({ id: target.restaurant_id, name: target.name }); }}><span className="max-w-40 truncate">{target.name}</span><Badge variant="neutral" className="shrink-0 whitespace-nowrap">{target.kind === "Dono e loja" ? "Dono/loja" : target.kind}</Badge></button>)}</div> : row.phone ? <span className="whitespace-nowrap">{formatPhone(row.phone)}</span> : group ? <button className={styles.profileLink} onClick={event=>{event.stopPropagation();openDetails(group);}}>{group.total} destinatário(s)</button> : "—";
    return <>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <section className={`${styles.tableSection} ${styles.blastTable} ${styles.blastMain}`} aria-label="Blasts">
            <PagedTable data={data} loading={loading} onPage={setPage} rowKey={r => r.id} onRowClick={openDetails} columns={[
                { key: "date", label: "Data", className: styles.dateCell, render: r => formatDateTime(r.created_at) },
                { key: "message", label: "Blast", render: r => groupLabel(r) ? <Badge variant="neutral">{groupLabel(r)}</Badge> : <p className={styles.blastPreview}>{r.message}</p> },
                { key: "destination", label: "Destino", render: r => destination(r, r) },
                { key: "progress", label: "Envios", render: r => <SendProgress row={r} /> },
                { key: "sender", label: "Remetente", render: r => <Sender sender={r.sender} connections={connections} /> },
                { key: "details", label: "", render: r => <button type="button" title="Ver detalhes" aria-label="Ver detalhes do blast" className="cursor-pointer rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-brand" onClick={event=>{event.stopPropagation();openDetails(r);}}><Eye size={16} aria-hidden="true"/></button> },
            ]} />
        </section>
        <section className={`${styles.tableSection} ${styles.blastTable} ${styles.blastAutomations}`}><h2>Blasts automáticos</h2>
            <PagedTable data={{ rows: data.automations.slice(automationPage * 25, (automationPage + 1) * 25), total: data.automations.length, page: automationPage, pageCount: Math.max(1, Math.ceil(data.automations.length / 25)) }} loading={loading} onPage={setAutomationPage} rowKey={r => r.id} columns={[
                { key: "name", label: "Título", render: r => <span className="font-medium">{r.name}</span> },
                { key: "message", label: "Mensagem", render: r => <p className={styles.blastMessage}>{r.message || "—"}</p> },
                { key: "sender", label: "Remetente", render: r => <Sender sender={r.sender} connections={connections} /> },
            ]} />
        </section>
        <DevDialog title={selected ? groupLabel(selected) || "Detalhes do blast" : "Detalhes do blast"} open={Boolean(selected)} onClose={() => setSelected(null)}>
            <div className={`space-y-5 ${styles.blastTable}`}>
                {selected && selected.id !== "automation:recovery" && <p className="whitespace-pre-wrap break-words text-sm leading-6">{selected.message}</p>}
                {selected && campaignActions(selected)}
                {selected?.id === "automation:recovery" && <Tabs tabs={["Destinatários", "Campanhas"]} active={view} onChange={value => { setView(value); setRecipientPage(0); }} />}
                {view === "Campanhas" ? <PagedTable data={campaigns} loading={detailsLoading} rowKey={r => r.id} onPage={setRecipientPage} columns={[
                    { key: "date", label: "Data", render: r => formatDateTime(r.created_at) },
                    { key: "message", label: "Campanha", render: r => <p className={styles.blastPreview}>{r.message}</p> },
                    { key: "progress", label: "Envios", render: r => <SendProgress row={r} /> },
                    { key: "details", label: "", render: r => <button type="button" title="Ver detalhes" aria-label="Ver detalhes do blast" className="cursor-pointer rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-brand" onClick={event=>{event.stopPropagation();openDetails(r);}}><Eye size={16} aria-hidden="true"/></button> },
                    { key: "actions", label: "", render: campaignActions },
                ]} /> : <PagedTable data={recipients} loading={detailsLoading} rowKey={r => r.id} onPage={setRecipientPage} columns={[
                    { key: "destination", label: "Destino", render: r => destination(r) },
                    { key: "phone", label: "Contato", render: r => formatPhone(r.phone || "") },
                    { key: "message", label: "Mensagem", render: r => <p className={styles.blastMessage}>{r.message}</p> },
                    { key: "status", label: "Status", render: r => <span title={r.error || undefined}>{r.status}</span> },
                    { key: "date", label: "Data", className: styles.dateCell, render: r => r.sent_at ? formatDateTime(r.sent_at) : r.scheduled_at ? formatDateTime(r.scheduled_at) : "—" },
                ]} />}
            </div>
        </DevDialog>
    </>;
}
