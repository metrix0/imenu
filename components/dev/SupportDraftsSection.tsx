"use client";

import { Eye, Send } from "lucide-react";
import SupportConversation from "./SupportConversation";
import { useDevProfile } from "./DevProfileProvider";
import { useCallback, useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import styles from "./dashboard.module.css";
import DevDialog from "./DevDialog";
import PagedTable, { type PageData } from "@/components/dev/PagedTable";
import SaveStatus from "@/components/ui/SaveStatus";
import Tabs from "@/components/ui/Tabs";
import Textarea from "@/components/ui/Textarea";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";
import { formatPhone, getWhatsappUrl } from "@/lib/dev/supportView";
import { useAutoSave } from "@/lib/utils/useAutoSave";

type Tab = "Pendentes" | "Aprovadas" | "Rejeitadas";
type Draft = {
    restaurant_id: string | null; id: string; reply_text: string; review_status: "pending" | "approved" | "rejected";
    session_name: string; created_at: string; customer_name: string | null;
    phone: string | null; restaurant_name: string | null; inbound_message: string | null;
    attended: boolean;
};
type DraftPage = PageData<Draft> & { pending: number };

const statusByTab: Record<Tab, Draft["review_status"]> = {
    Pendentes: "pending", Aprovadas: "approved", Rejeitadas: "rejected",
};

export default function SupportDraftsSection() {
    const {openProfile} = useDevProfile();
    const [tab, setTab] = useState<Tab>("Pendentes");
    const [page, setPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [data, setData] = useState<DraftPage>({ rows: [], total: 0, page: 0, pageCount: 1, pending: 0 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [selected, setSelected] = useState<Draft | null>(null);
    const [reply, setReply] = useState("");
    const [modalError, setModalError] = useState("");
    const [action, setAction] = useState("");
    const [rejectingId, setRejectingId] = useState<string | null>(null);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        void devJson<DraftPage>("/api/dev/support/drafts?status=" + statusByTab[tab] + "&page=" + page, {
            signal: controller.signal,
        }).then((result) => {
            setData(result);
            setError("");
        }).catch((caught) => {
            if (!controller.signal.aborted) setError(caught instanceof Error ? caught.message : "Falha ao carregar respostas.");
        }).finally(() => {
            if (!controller.signal.aborted) setLoading(false);
        });
        return () => controller.abort();
    }, [tab, page, revision]);

    const selectedId = selected?.id || null;
    const save = useCallback(async (text: string) => {
        if (!selectedId) return;
        await devJson("/api/dev/support/drafts", {
            method: "POST", body: JSON.stringify({ id: selectedId, action: "edit", text }),
        });
    }, [selectedId]);
    const { status: saveStatus, error: saveError, schedule, reset } = useAutoSave<string>(selectedId, save);

    const open = (draft: Draft) => {
        setSelected(draft);
        setReply(draft.reply_text);
        setModalError("");
    };

    const close = () => {
        if (action || saveStatus === "saving") return;
        if (saveStatus === "error") {
            if (!window.confirm("A edição não foi salva. Descartar alterações?")) return;
            reset();
        }
        setSelected(null);
    };

    const review = async (next: "approve" | "reject") => {
        if (!selected || saveStatus === "saving" || saveStatus === "error" || !reply.trim()) return;
        setAction(next);
        setModalError("");
        try {
            await devJson("/api/dev/support/drafts", {
                method: "POST", body: JSON.stringify({ id: selected.id, action: next }),
            });
            setSelected(null);
            setRevision((value) => value + 1);
        } catch (caught) {
            setModalError(caught instanceof Error ? caught.message : "Falha ao revisar resposta.");
        } finally { setAction(""); }
    };

    const rejectFromTable = async (draft: Draft) => {
        if (rejectingId || action || draft.review_status !== "pending") return;
        setRejectingId(draft.id);
        setError("");
        try {
            await devJson("/api/dev/support/drafts", {
                method: "POST", body: JSON.stringify({ id: draft.id, action: "reject" }),
            });
            if (data.rows.length === 1 && page > 0) setPage(page - 1);
            else setRevision((value) => value + 1);
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Falha ao rejeitar resposta.");
        } finally {
            setRejectingId(null);
        }
    };

    const whatsappUrl = getWhatsappUrl(selected?.phone || null);

    return <>
        <section className={`${styles.tableSection} ${styles.supportTable}`}>
            <h2>Respostas IA para revisão</h2>
            <Tabs<Tab> tabs={["Pendentes", "Aprovadas", "Rejeitadas"]} active={tab}
                onChange={(value) => { setTab(value); setPage(0); }} />
            {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
            <div>
                <PagedTable data={data} loading={loading} onPage={setPage}
                    rowKey={(draft) => draft.id} onRowClick={open} columns={[
                    { key: "contact", label: "Pessoa", render: draft => <div className="min-w-0"><p className="truncate font-medium">{draft.customer_name || "—"}</p><span className="text-xs text-gray-500">{formatPhone(draft.phone)}</span></div> },
                    { key: "restaurant", label: "Restaurante", render: draft => draft.restaurant_id ? <button type="button" className={styles.profileLink} onClick={event=>{event.stopPropagation();setSelected(null);openProfile({id:draft.restaurant_id!,name:draft.restaurant_name || "Restaurante"});}}>{draft.restaurant_name || "Restaurante"}</button> : "—" },
                    { key: "attended", label: "Situação", render: draft => <Badge variant={draft.attended ? "success" : "danger"}>{draft.attended ? "Atendido" : "Aguardando"}</Badge> },
                    { key: "reply", label: "Resposta sugerida", render: draft => <p className="truncate" title={draft.reply_text}>{draft.reply_text}</p> },
                    { key: "date", label: "Criada", render: (draft) =>
                        <span className="whitespace-nowrap">{formatDateTime(draft.created_at)}</span> },
                    { key: "action", label: "", render: (draft) => <div className="flex items-center justify-end gap-2">
                        {draft.review_status === "pending" && <Button variant="secondary" loading={rejectingId === draft.id}
                            disabled={Boolean(rejectingId) || Boolean(action)}
                            onClick={event => { event.stopPropagation(); void rejectFromTable(draft); }}>Rejeitar</Button>}
                        <button type="button" className={styles.supportIcon} title="Revisar resposta" aria-label="Revisar resposta"
                            onClick={event => { event.stopPropagation(); open(draft); }}><Eye size={16} aria-hidden="true" /></button>
                    </div> },
                ]} />
            </div>
        </section>

        <DevDialog title="Resposta sugerida" open={Boolean(selected)} onClose={close}>
            {selected && <div className="space-y-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-start justify-between gap-3 pr-8">
                    <div>
                        <p className="mt-1 text-sm text-gray-500">
                            {selected.customer_name || selected.restaurant_name || "Contato sem nome"}
                            {selected.phone ? " · " + formatPhone(selected.phone) : ""}
                        </p>
                        <p className="mt-1 text-xs text-gray-500">{formatDateTime(selected.created_at)} · {selected.session_name === "imenu-blast" ? "WhatsApp Blast" : "WhatsApp Suporte"}</p>
                    </div>
                    {selected.review_status === "pending" ? <SaveStatus status={saveStatus} />
                        : <Badge variant={selected.review_status === "approved" ? "success" : "neutral"}>
                            {selected.review_status === "approved" ? "Aprovada" : "Rejeitada"}
                        </Badge>}
                </div>
                <section className="space-y-3" aria-label="Conversa">
                    <h3 className="text-sm font-medium">Conversa</h3>
                    <SupportConversation url={"/api/dev/support/drafts?id="+selected.id} fallback={selected.inbound_message}/>
                </section>
                <div>
                    <label htmlFor="support-draft-reply" className="mb-2 block text-sm font-medium">Resposta</label>
                    <Textarea id="support-draft-reply" value={reply} maxLength={8000} rows={7}
                        readOnly={selected.review_status !== "pending"}
                        className="w-full resize-y rounded-lg border border-[#e2e5e9] bg-white p-3 text-sm focus:border-[#d93d00] focus:outline-none"
                        onChange={(event) => { setReply(event.target.value); schedule(event.target.value); }} />
                    {saveError && <p role="alert" className="mt-2 text-sm text-red-700">{saveError}</p>}
                </div>
                {modalError && <p role="alert" className="text-sm text-red-700">{modalError}</p>}
                <div className="flex flex-wrap items-center gap-2">
                    {selected.review_status === "pending" && <>
                        <Button leftIcon={<Send size={16} aria-hidden="true" />} loading={action === "approve"} disabled={Boolean(action) || saveStatus === "saving" || saveStatus === "error" || !reply.trim()}
                            onClick={() => void review("approve")}>Aprovar e enviar</Button>
                        <Button variant="secondary" loading={action === "reject"} disabled={Boolean(action) || saveStatus === "saving" || saveStatus === "error"}
                            onClick={() => void review("reject")}>Rejeitar</Button>
                    </>}
                    {whatsappUrl && <Button variant="secondary" onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}>Abrir WhatsApp</Button>}
                </div>
            </div>}
        </DevDialog>
    </>;
}
