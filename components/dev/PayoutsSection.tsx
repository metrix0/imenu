"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import { formatPhone, getWhatsappUrl } from "@/lib/dev/supportView";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Loader from "@/components/ui/Loader";
import Tooltip from "@/components/ui/Tooltip";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents as money, formatDateTime } from "@/lib/dev/dashboardFormat";
import { calculateOnePercentPayout } from "@/lib/services/payoutSafety";

type Payable = { restaurantId: string; restaurantName: string; grossCents: number; payzuFeeCents: number; waitingGrossCents: number; canSend: boolean; pixKey: string | null; nextEligibleAt: string | null };
type Dashboard = { asaasBalanceCents: number | null; asaasConfigured: boolean; asaasError: string | null; cutoffAt: string; outstandingPayoutCents: number; payables: Payable[]; ownerPhones:Record<string,string> };
type History = { id: string; restaurant_name: string; created_at: string; amount_cents: number; status: string; failure_reason: string | null; run_date?: string; payout_cents?: number; restaurant_count?: number; failed_count?: number;pix_key?:string|null;owner_phone?:string|null;asaas_transfer_id?:string|null };

function HistoryTable({ section, revision, onRetry }: { section: "failed" | "history" | "runs"; revision: number; onRetry: (id: string) => void }) {
    const [page, setPage] = useState(0);
    const [data, setData] = useState<PageData<History>>({ rows: [], total: 0, page: 0, pageCount: 1 });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<PageData<History>>(`/api/dev/payout?section=${section}&page=${page}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [section, page, revision]);
    return <section className={`${styles.section} ${styles.scrollTable} ${section === "failed" ? styles.payoutFailures : ""}`}><div className={styles.sectionHeader}><h2>{section === "failed" ? "Repasses com falha" : section === "runs" ? "Histórico diário" : "Histórico de repasses"}</h2>{section === "failed" && data.total > 0 && <Badge variant="danger">{data.total} registro(s)</Badge>}</div>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <PagedTable data={data} loading={loading} rowKey={r => r.id} onPage={setPage} columns={[
            { key: "name", label: section === "runs" ? "Dia" : "Restaurante", render: r => section === "runs" ? String(r.run_date).slice(0, 10) : <div className="min-w-40"><p className="font-medium">{r.restaurant_name}</p>{r.owner_phone && <a className="text-xs text-[#c43700]" href={getWhatsappUrl(r.owner_phone)||undefined} target="_blank" rel="noopener noreferrer">{formatPhone(r.owner_phone)}</a>}</div> },
            { key: "amount", label: "Valor", className: styles.numericCell, render: r => money(section === "runs" ? r.payout_cents || 0 : r.amount_cents) },
            { key: "status", label: "Status", render: r => <div><Tooltip text={r.failure_reason || ""} showOnClick><Badge variant={r.status === "failed" ? "danger" : r.status === "paid" ? "success" : "neutral"}>{({ failed: "Falhou", cancelled: "Cancelado", paid: "Pago", processing: "Processando", pending: "Pendente", completed: "Concluído" } as Record<string, string>)[r.status] || r.status}</Badge></Tooltip>{section === "failed" && <p className="mt-2 min-w-40 max-w-64 text-xs text-gray-500">{r.failure_reason || "Motivo não registrado."}</p>}</div> },
            { key: "date", label: section === "runs" ? "Restaurantes / falhas" : "Data", className: styles.dateCell, render: r => section === "runs" ? `${r.restaurant_count} / ${r.failed_count}` : formatDateTime(r.created_at) },
            ...(section === "failed" ? [{key:"pix",label:"PIX atual",render:(r:History)=><p className="min-w-24 max-w-40 break-all text-xs">{r.pix_key || "Não cadastrado"}</p>},{ key: "retry", label: "", render: (r: History) => <Button variant="secondary" disabled={r.status!=="failed"||!r.pix_key||Boolean(r.asaas_transfer_id)} onClick={() => onRetry(r.id)}>Tentar novamente</Button> }] : []),
        ]} />
    </section>;
}

export default function PayoutsSection() {
    const [historyTab,setHistoryTab] = useState("Histórico diário");
    const [data, setData] = useState<Dashboard | null>(null);
    const [revision, setRevision] = useState(0);
    const [page, setPage] = useState(0);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [confirmation, setConfirmation] = useState<{ ids?: string[]; retry?: string; fund?: boolean } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        void devJson<Dashboard>("/api/dev/payout", { signal: controller.signal }).then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => controller.abort();
    }, [revision]);
    const payables = [...(data?.payables || [])].sort((a,b)=>Number(!b.pixKey)-Number(!a.pixKey)||b.grossCents-a.grossCents);
    const net = (row: Payable) => calculateOnePercentPayout(row.grossCents, row.payzuFeeCents).netCents;
    const due = payables.reduce((sum, row) => sum + net(row) + calculateOnePercentPayout(row.waitingGrossCents, 0).netCents, data?.outstandingPayoutCents || 0);
    const selected = payables.filter(row => row.canSend && row.grossCents > 0 && (!confirmation?.ids || confirmation.ids.includes(row.restaurantId)));
    async function send() {
        if (!confirmation || !data) return;
        setSending(true); setError(""); setMessage("");
        try {
            const result = await devJson<{ paidCount?: number; processingCount?: number; failedCount?: number }>("/api/dev/payout", { method: "POST", body: JSON.stringify(confirmation.fund ? { action: "fund_asaas" } : confirmation.retry ? { retryPayoutId: confirmation.retry } : { discountPercent: 1, adjustToOnePercent: true, restaurantIds: selected.map(row => row.restaurantId), cutoffAt: data.cutoffAt }) });
            setMessage(confirmation.fund ? "Transferência para o Asaas solicitada." : `${result.paidCount || 0} pagos · ${result.processingCount || 0} processando · ${result.failedCount || 0} com falha.`);
            setConfirmation(null); setRevision(r => r + 1);
        } catch (e) { setError((e as Error).message); } finally { setSending(false); }
    }
    return <>
        {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status" className="text-green-700">{message}</p>}
        <HistoryTable section="failed" revision={revision} onRetry={id => setConfirmation({ retry: id })} />
        {!data ? <Loader /> : <>
            <dl className={styles.metricStrip}><div><dt>Saldo Asaas</dt><dd>{data.asaasBalanceCents === null ? "—" : money(data.asaasBalanceCents)}</dd>{data.asaasError && <p className="mt-2 text-sm text-red-700">{data.asaasError}</p>}</div><div><dt>Total a repassar (líquido)</dt><dd>{money(due)}</dd></div></dl>
            <section className={`${styles.section} ${styles.scrollTable}`}><div className={styles.sectionHeader}><h2>Valores por restaurante</h2><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={sending || !data.asaasConfigured} onClick={() => setConfirmation({ fund: true })}>Abastecer Asaas</Button><Button disabled={sending || !data.asaasConfigured || !payables.some(row => row.canSend && row.grossCents > 0)} onClick={() => setConfirmation({})}>Enviar repasses</Button></div></div>
                <PagedTable data={{ rows: payables.slice(page * 25, (page + 1) * 25), total: payables.length, page, pageCount: Math.ceil(payables.length / 25) }} onPage={setPage} rowKey={r => r.restaurantId} columns={[
                    { key: "name", label: "Restaurante", render: r => <div className="min-w-40"><p className="font-medium">{r.restaurantName}</p>{data.ownerPhones[r.restaurantId] && <a className="text-xs text-[#c43700]" href={getWhatsappUrl(data.ownerPhones[r.restaurantId])||undefined} target="_blank" rel="noopener noreferrer">{formatPhone(data.ownerPhones[r.restaurantId])}</a>}</div> },
                    { key: "pix", label: "PIX", render: r => <p className="min-w-24 max-w-40 break-all text-xs">{r.pixKey || <span className="text-red-700">Não cadastrado</span>}</p> },
                    { key: "gross", label: "Bruto elegível", className: styles.numericCell, render: r => <div>{money(r.grossCents)}<p className="mt-1 text-xs text-gray-500">Taxa 1% · {money(r.grossCents-net(r))}</p></div> },
                    { key: "net", label: "Repasse líquido", className: styles.numericCell, render: r => <span className="font-semibold">{money(net(r))}</span> },
                    { key: "waiting", label: "A liberar", className: styles.numericCell, render: r => <Tooltip text={r.nextEligibleAt ? formatDateTime(r.nextEligibleAt) : "Margem de liberação: 1h30."} showOnClick><span>{money(r.waitingGrossCents)}</span></Tooltip> },
                    { key: "send", label: "", render: r => <Button variant="secondary" disabled={sending || !data.asaasConfigured || !r.canSend || r.grossCents <= 0} onClick={() => setConfirmation({ ids: [r.restaurantId] })}>Enviar repasse</Button> },
                ]} />
            </section>
        </>}
        <Tabs tabs={["Histórico diário","Histórico de repasses"]} active={historyTab} onChange={setHistoryTab}/><HistoryTable key={historyTab} section={historyTab==="Histórico diário"?"runs":"history"} revision={revision} onRetry={()=>undefined}/>
        <ConfirmModal open={Boolean(confirmation)} onClose={() => { if (!sending) setConfirmation(null); }} onConfirm={() => void send()} isLoading={sending} variant="primary" title={confirmation?.fund ? "Abastecer Asaas" : "Confirmar repasse"} description={confirmation?.fund ? "Transferir apenas o valor necessário do Mercado Pago para cobrir os repasses elegíveis." : confirmation?.retry ? "Tentar novamente este repasse usando os valores registrados e os dados PIX atuais da loja." : `Enviar ${money(selected.reduce((sum, row) => sum + net(row), 0))} para ${selected.length} restaurante(s), com desconto total de 1% do bruto.`} confirmLabel="Confirmar e enviar" />
    </>;
}
