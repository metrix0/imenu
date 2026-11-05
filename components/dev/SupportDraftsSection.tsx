"use client";

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
    id: string; reply_text: string; review_status: "pending" | "approved" | "rejected";
    session_name: string; created_at: string; customer_name: string | null;
    phone: string | null; restaurant_name: string | null; inbound_message: string | null;
};
type DraftPage = PageData<Draft> & { pending: number };

const statusByTab: Record<Tab, Draft["review_status"]> = {
    Pendentes: "pending", Aprovadas: "approved", Rejeitadas: "rejected",
};

export default function SupportDraftsSection() {
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

    const whatsappUrl = getWhatsappUrl(selected?.phone || null);

    return <>
        <section className={`${styles.section} ${styles.scrollTable}`}>
            <div className={styles.sectionHeader}>
                <div>
                    <div className="flex items-center gap-3">
                        <h2>Respostas IA para revisão</h2>
                        {data.pending > 0 && <Badge variant="warning">{data.pending} pendente(s)</Badge>}
                    </div>
                    <p className="mt-1 text-sm text-gray-500">Respostas sugeridas após solicitação de atendimento humano.</p>
                </div>

            </div>
            <div className="px-5">
                <Tabs<Tab> tabs={["Pendentes", "Aprovadas", "Rejeitadas"]} active={tab}
                    onChange={(value) => { setTab(value); setPage(0); }} />
            </div>
            {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
            <div>
                <PagedTable data={data} loading={loading} onPage={setPage}
                    rowKey={(draft) => draft.id} onRowClick={open} columns={[
                    { key: "contact", label: "Contato", render: (draft) => <div className="min-w-36">
                        <p className="font-medium text-gray-900">{draft.customer_name || draft.restaurant_name || "Contato sem nome"}</p>
                        <p className="text-xs text-gray-500">{draft.phone ? formatPhone(draft.phone) : draft.session_name === "imenu-blast" ? "WhatsApp Blast" : "WhatsApp Suporte"}</p>
                    </div> },
                    { key: "reply", label: "Resposta sugerida", render: (draft) =>
                        <p className="max-w-xl line-clamp-3 whitespace-pre-wrap break-words">{draft.reply_text}</p> },
                    { key: "date", label: "Criada", render: (draft) =>
                        <span className="whitespace-nowrap">{formatDateTime(draft.created_at)}</span> },
                    { key: "action", label: "", render: (draft) =>
                        <Button variant="secondary" onClick={(event) => { event.stopPropagation(); open(draft); }}>Revisar</Button> },
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
                {selected.inbound_message && <div className="rounded-lg border border-[#e2e5e9] bg-[#f7f8fa] p-4">
                    <p className="text-xs font-medium text-gray-600">Mensagem do cliente</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm">{selected.inbound_message}</p>
                </div>}
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
                        <Button loading={action === "approve"} disabled={Boolean(action) || saveStatus === "saving" || saveStatus === "error" || !reply.trim()}
                            onClick={() => void review("approve")}>Aprovar</Button>
                        <Button variant="secondary" loading={action === "reject"} disabled={Boolean(action) || saveStatus === "saving" || saveStatus === "error"}
                            onClick={() => void review("reject")}>Rejeitar</Button>
                    </>}
                    {whatsappUrl && <Button variant="secondary" onClick={() => window.open(whatsappUrl, "_blank", "noopener,noreferrer")}>Abrir WhatsApp</Button>}
                </div>
                <p className="text-xs text-gray-500">A aprovação não envia mensagens automaticamente.</p>
            </div>}
        </DevDialog>
    </>;
}
