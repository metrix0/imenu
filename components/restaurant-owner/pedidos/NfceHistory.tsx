"use client";

import { useEffect, useState, type FormEvent } from "react";
import { faFileInvoice, faLock } from "@fortawesome/free-solid-svg-icons";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import CollapsibleSection from "@/components/ui/CollapsibleSection";
import Modal from "@/components/ui/Modal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Input from "@/components/ui/Input";
import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import PanelTabCard from "@/components/restaurant-owner/ia-vendas/PanelTabCard";
import ShortcutDatePicker from "@/components/ui/ShortcutDatePicker";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { supabase } from "@/lib/database/supabaseClient";
import { CARD_AT_DELIVERY_LABELS } from "@/lib/payments/deliveryMethods";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
import type { NoteSummary } from "@/lib/nfce/service";
import type { Order } from "./OrdersTable";

type History = { available: boolean; plus: boolean; archive: boolean; configured: boolean; notes: NoteSummary[] };

export async function nfceRequest(restaurant: string, params: Record<string, string>, init?: RequestInit) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) throw new Error("Sua sessão expirou. Entre novamente.");
    const headers = new Headers(init?.headers);
    headers.set("Authorization", "Bearer " + session.access_token);
    const response = await fetch("/api/nfce?" + new URLSearchParams({ restaurantId: restaurant, ...params }), { ...init, headers, cache: "no-store" });
    if (!response.ok) {
        const body = await response.json().catch(() => null);
        throw new Error(body?.error || "Não foi possível acessar as notas fiscais.");
    }
    return response;
}

const emptyHistory: History = { available: false, plus: true, archive: false, configured: false, notes: [] };

export function useNfceHistory(restaurant: string | null, orders: Order[], refresh: number) {
    const [history, setHistory] = useState<History>(emptyHistory);
    const ids = orders.map(order => order.id).join(",");
    useEffect(() => {
        if (!restaurant) { setHistory(emptyHistory); return; }
        const controller = new AbortController();
        nfceRequest(restaurant, { orders: ids }, { signal: controller.signal })
            .then(response => response.json())
            .then(value => { if (!controller.signal.aborted) setHistory(value); })
            .catch(async () => {
                try {
                    // Keep the fiscal UI visible if its API fails; check the Plus entitlement independently.
                    const response = await qrTableAuthenticatedFetch("/api/addons/billing?restaurantId=" + encodeURIComponent(restaurant), { signal: controller.signal, cache: "no-store" });
                    if (!response.ok) throw new Error("Não foi possível consultar o plano.");
                    const data = await response.json() as { addons: { addon: { product_key: string }; active: boolean }[] };
                    if (!controller.signal.aborted) setHistory({ ...emptyHistory, plus: data.addons.some(item => item.addon.product_key === "ia_plus" && item.active) });
                } catch {
                    if (!controller.signal.aborted) setHistory(emptyHistory);
                }
            });
        return () => controller.abort();
    }, [restaurant, ids, refresh]);
    return history;
}

async function download(restaurant: string, params: Record<string, string>, fallback: string) {
    const response = await nfceRequest(restaurant, params);
    const url = URL.createObjectURL(await response.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = response.headers.get("Content-Disposition")?.match(/filename="([^"]+)"/)?.[1] || fallback;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return response.headers.get("X-Nfce-Archive-Receipt");
}

function thisMonth() {
    const parts = new Intl.DateTimeFormat("pt-BR", {
        year: "numeric", month: "2-digit", day: "2-digit", timeZone: "America/Sao_Paulo",
    }).formatToParts(new Date());
    const datePart = (type: string) => parts.find(part => part.type === type)!.value;
    const month = `${datePart("year")}-${datePart("month")}`;
    return { startDate: month + "-01", endDate: month + "-" + datePart("day") };
}

export function NfceUpgradeButton({ restaurant, onPaid, row = false }: { restaurant: string; onPaid: () => void | Promise<void>; row?: boolean }) {
    const [open, setOpen] = useState(false);

    return <>
        {row ? (
            <CollapsibleSection
                title="Emissão automática de NFC-e"
                description="Emita notas fiscais dos pedidos automaticamente com o iMenu Plus."
                titleBadge={<Badge preset="plusIncluded" />}
                toggle={{ checked: false, label: "Ativar emissão automática de NFC-e", onChange: () => setOpen(true) }}
            >
                <Button variant="secondary" onClick={() => setOpen(true)}>Ativar com iMenu Plus</Button>
            </CollapsibleSection>
        ) : (
            <Button variant="secondary" leftIcon={<PanelIcon icon={faLock} />} onClick={() => setOpen(true)}>
                Notas Fiscais · Recurso do iMenu Plus
            </Button>
        )}
        {open && <IaPlusSalesModal open onClose={() => setOpen(false)} restaurantId={restaurant}
            contextMessage="Com o iMenu Plus, emita NFC-e e baixe os XMLs das suas notas fiscais por período."
            onPaid={() => { setOpen(false); return onPaid(); }} />}
    </>;
}

export function NfceHistoryButton({ restaurant, history }: { restaurant: string; history: History }) {
    const [open, setOpen] = useState(false);
    const [custom, setCustom] = useState(false);
    const [receipt, setReceipt] = useState<string | null>(null);
    const [confirmDelete, setConfirmDelete] = useState(false);
    const [removed, setRemoved] = useState(false);
    const [range, setRange] = useState(thisMonth);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const exportPeriod = async (period: ReturnType<typeof thisMonth>) => {
        setLoading(true);
        setError("");
        try {
            await download(restaurant, { action: "zip", start: period.startDate, end: period.endDate }, "notas-fiscais.zip");
        } catch (error) {
            setError((error as Error).message);
        } finally { setLoading(false); }
    };
    const downloadArchive = async () => {
        setLoading(true);
        setError("");
        try { setReceipt(await download(restaurant, { action: "zip", all: "1" }, "nfce-arquivo-completo.zip")); }
        catch (error) { setError((error as Error).message); }
        finally { setLoading(false); }
    };
    const finishArchive = async () => {
        setLoading(true);
        try {
            await nfceRequest(restaurant, { action: "archive-received" }, { method: "POST", body: JSON.stringify({ confirmed: true, receipt }) });
            setRemoved(true);
            setConfirmDelete(false);
            setOpen(false);
        } catch (error) {
            setConfirmDelete(false);
            setError((error as Error).message);
        } finally { setLoading(false); }
    };
    if (!history.plus && (!history.archive || removed)) return null;
    return <>
        <Button variant="secondary" leftIcon={<PanelIcon icon={faFileInvoice} />} onClick={() => { setError(""); setCustom(false); setOpen(true); }}>
            {history.plus ? "Notas Fiscais" : "Baixar notas anteriores"}
        </Button>
        <Modal open={open} onClose={() => setOpen(false)} height={380} showCloseButton>
            <section className="w-full max-w-lg space-y-5 rounded-lg bg-white p-6" aria-label="Notas Fiscais">
                <h2 className="text-xl font-bold text-gray-900">Notas Fiscais</h2>
                {history.plus && (!history.available || !history.configured) ? (
                    <div>
                        <p className="text-sm text-gray-600">
                            Para baixar notas fiscais, ative e configure a emissão de NFC-e na aba Configurações.
                        </p>
                        <PanelTabCard tab="configuracoes" />
                    </div>
                ) : (
                    <>
                        <p className="text-sm text-gray-600">Baixe um ZIP com os XMLs autorizados e os eventos de cancelamento.</p>
                        <div className="flex flex-wrap gap-2">
                            <Button onClick={() => void exportPeriod(thisMonth())} loading={loading && !custom} disabled={loading || !history.available}>Baixar notas deste mês</Button>
                            <Button variant="secondary" onClick={() => { setCustom(value => !value); setError(""); }} disabled={loading || !history.available}>Período personalizado</Button>
                        </div>
                        {custom && <div className="flex flex-wrap items-end gap-3">
                            <ShortcutDatePicker value={range} onChange={setRange} />
                            <Button onClick={() => void exportPeriod(range)} loading={loading} disabled={!range.startDate || !range.endDate}>Baixar XMLs</Button>
                        </div>}
                        {!history.plus && <div className="flex flex-wrap gap-2">
                            <Button variant="secondary" onClick={() => void downloadArchive()} disabled={loading}>Baixar arquivo completo</Button>
                            {receipt && <Button variant="secondary" onClick={() => setConfirmDelete(true)} disabled={loading}>Confirmar recebimento</Button>}
                        </div>}
                    </>
                )}
                {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
            </section>
        </Modal>
        <ConfirmModal open={confirmDelete} onClose={() => setConfirmDelete(false)} onConfirm={() => void finishArchive()}
            title="Excluir a cópia do iMenu?" description="Confirme somente após salvar e abrir o ZIP completo. Guarde seus XMLs pelo prazo fiscal."
            confirmLabel="Confirmar e excluir" isLoading={loading} variant="danger" />
    </>;
}

const stateLabels: Record<string, string> = {
    pending: "Aguardando emissão", processing: "Em processamento", contingency: "Emitida em contingência",
    rejected: "Rejeitada", authorized: "Autorizada", canceled: "Cancelada",
};

export function NfceOrderSection({ order, note, restaurant, configured, focus, onChange }: {
    order: Order; note?: NoteSummary; restaurant: string; configured: boolean; focus: boolean; onChange: () => void;
}) {
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const [edit, setEdit] = useState(false);
    const [cancel, setCancel] = useState(false);
    const [queued, setQueued] = useState(false);
    const [payment, setPayment] = useState("");
    const delivery = order.is_delivery === "entrega";
    const pending = !note?.access_key && (!note || note.status === "rejected");
    useEffect(() => {
        if (focus) document.getElementById("order-nfce")?.scrollIntoView({ block: "nearest" });
    }, [focus]);
    const run = async (task: () => Promise<void>) => {
        setBusy(true);
        setError("");
        try { await task(); } catch (error) { setError((error as Error).message); }
        finally { setBusy(false); }
    };
    const submit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const body = { order: order.id, payment };
        void run(async () => {
            await nfceRequest(restaurant, { action: "issue" }, { method: "POST", body: JSON.stringify(body) });
            setQueued(true);
            setEdit(false);
            onChange();
        });
    };
    const cancelSubmit = (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        const form = new FormData(event.currentTarget);
        void run(async () => {
            await nfceRequest(restaurant, { action: "cancel" }, {
                method: "POST", body: JSON.stringify({ order: order.id, reason: form.get("reason"), noDispatch: form.get("noDispatch") === "on" }),
            });
            setCancel(false);
            onChange();
        });
    };
    return <section id="order-nfce" className="space-y-3" tabIndex={-1}>
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">Nota fiscal (NFC-e)</h3>
        <p className="text-sm text-gray-600">{note ? stateLabels[note.status] : queued ? "Aguardando emissão" : "Não emitida"}</p>
        {note?.number && <p className="text-sm text-gray-700">Nº {note.number} · Série {note.series} · {new Date(note.issued_at).toLocaleString("pt-BR")}</p>}
        {note?.access_key && <p className="break-all text-xs text-gray-600">{note.access_key}</p>}
        {note?.error && <p className="text-sm text-red-700">{note.error}</p>}
        <div className="flex flex-wrap gap-2">
            {note && ["authorized", "canceled", "contingency"].includes(note.status) && <Button variant="secondary" className="!border-transparent !bg-gray-100 hover:!bg-gray-200" disabled={busy} onClick={() => void run(async () => { await download(restaurant, { action: "pdf", order: order.id }, "danfe.pdf"); })}>Baixar PDF</Button>}
            {note && ["authorized", "canceled"].includes(note.status) && <Button variant="secondary" className="!border-transparent !bg-gray-100 hover:!bg-gray-200" disabled={busy} onClick={() => void run(async () => { await download(restaurant, { action: "xml", order: order.id }, "nfce.xml"); })}>Baixar XML</Button>}
            {note?.status === "authorized" && order.status === "canceled" && <Button variant="secondary" className="!border-transparent !bg-gray-100 hover:!bg-gray-200" onClick={() => setCancel(value => !value)}>Cancelar nota</Button>}
            {pending && configured && !delivery && !queued && ["preparing", "delivering", "done"].includes(order.status) && <Button variant="secondary" className="!border-transparent !bg-gray-100 hover:!bg-gray-200" onClick={() => setEdit(value => !value)}>
                {note ? "Corrigir e tentar novamente" : "Emitir NFC-e"}
            </Button>}
        </div>
        {delivery && !note && <p className="text-sm text-gray-600">Emissão fiscal para entregas indisponível nesta configuração.</p>}
        {edit && <form onSubmit={submit} className="space-y-3">
            <label className="block text-sm">Pagamento
                <select className="ml-2 rounded-md border border-gray-300 p-2" value={payment} onChange={event => setPayment(event.target.value)}>
                    <option value="">Do pedido</option>
                    {Object.entries({ dinheiro: "Dinheiro", "pix-entrega": "Pix na entrega", ...CARD_AT_DELIVERY_LABELS }).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
                    <option value="pix">Pix online</option>
                </select>
            </label>
            <Button type="submit" loading={busy}>Emitir nota</Button>
        </form>}
        {cancel && <form onSubmit={cancelSubmit} className="space-y-3">
            <Input name="reason" label="Justificativa" minLength={15} maxLength={255} required />
            <label className="flex gap-2 text-sm"><input type="checkbox" name="noDispatch" required />A mercadoria não saiu do estabelecimento</label>
            <Button type="submit" loading={busy}>Confirmar cancelamento</Button>
        </form>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
    </section>;
}
