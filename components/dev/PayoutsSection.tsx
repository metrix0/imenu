"use client";

import { useEffect, useState } from "react";
import styles from "./dashboard.module.css";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import { formatPhone, getWhatsappUrl } from "@/lib/dev/supportView";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import DevDialog from "./DevDialog";
import Loader from "@/components/ui/Loader";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents as money, formatDateTime } from "@/lib/dev/dashboardFormat";
import { calculateOnePercentPayout, summarizeOnePercentPayouts } from "@/lib/services/payoutSafety";

type Payable = { restaurantId: string; restaurantName: string; grossCents: number; payzuFeeCents: number; waitingGrossCents: number; canSend: boolean; pixKey: string | null; pixKeyType: string | null; nextEligibleAt: string | null };
type PayoutRestaurantError = { restaurantId: string; restaurantName: string; grossCents: number; message: string };
type Dashboard = { asaasBalanceCents: number | null; asaasConfigured: boolean; asaasError: string | null; cutoffAt: string; payables: Payable[]; validationErrors: PayoutRestaurantError[]; ownerPhones:Record<string,string> };
type History = {
    id: string; restaurant_name: string; created_at: string; amount_cents: number; status: string; failure_reason: string | null;
    run_date?: string; payout_cents?: number; restaurant_count?: number; failed_count?: number; paid_count?: number; processing_count?: number;
    pix_key?: string | null; pix_key_type?: string | null; pix_address_key?: string | null; owner_phone?: string | null; asaas_transfer_id?: string | null;
    gross_cents?: number | null; payzu_fee_cents?: number | null; discount_cents?: number | null; paid_profit_cents?: number | null;
    transferred_cents?: number | null; asaas_balance_before_payout_cents?: number | null; difference_cents?: number | null;
    payzu_step_status?: string; adjustment_step_status?: string; comparison_step_status?: string; payout_step_status?: string; error_message?: string | null;
};
const statusLabels: Record<string, string> = { failed: "Falhou", cancelled: "Cancelado", canceled: "Cancelado", paid: "Pago", processing: "Processando", pending: "Pendente", completed: "Concluído", partial: "Parcial", blocked: "Bloqueado", running: "Executando", skipped: "Não executado" };
const nullableMoney = (value: number | null | undefined) => value == null ? "—" : money(value);
const runDate = (value?: string) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
function PayoutStatus({ status }: { status?: string }) {
    return <Badge variant={status === "failed" || status === "blocked" ? "danger" : status === "partial" ? "warning" : status === "paid" || status === "completed" ? "success" : status === "running" || status === "processing" ? "info" : "neutral"}>{status ? statusLabels[status] || status : "—"}</Badge>;
}

function HistoryTable({ section, revision, onRetry, canRetry = false }: { section: "failed" | "history" | "runs"; revision: number; onRetry: (id: string) => void; canRetry?: boolean }) {
    const [page, setPage] = useState(0);
    const [data, setData] = useState<PageData<History>>({ rows: [], total: 0, page: 0, pageCount: 1 });
    const [selectedRun, setSelectedRun] = useState<History | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<PageData<History>>(`/api/dev/payout?section=${section}&page=${page}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [section, page, revision]);
    const columns: TableColumn<History>[] = section === "runs" ? [
        { key: "date", label: "Dia", className: styles.dateCell, render: r => runDate(r.run_date) },
        { key: "amount", label: "Planejado", className: styles.numericCell, render: r => nullableMoney(r.payout_cents) },
        { key: "sent", label: "Envios", render: r => <div className="min-w-48"><p>{r.restaurant_count} restaurante(s)</p><p className="mt-1 text-xs text-gray-500">{r.paid_count || 0} pagos · {r.processing_count || 0} processando · {r.failed_count || 0} falhas</p></div> },
        { key: "status", label: "Status", render: r => <PayoutStatus status={r.status} /> },
        { key: "error", label: "Erro", render: r => <p className="min-w-32 max-w-64 break-words text-xs text-red-700">{r.error_message || "—"}</p> },
        { key: "details", label: "", render: r => <Button variant="secondary" onClick={event => { event.stopPropagation(); setSelectedRun(r); }}>Ver detalhes</Button> },
    ] : [
        { key: "name", label: "Restaurante", render: r => <div className="min-w-40"><p className="font-medium">{r.restaurant_name}</p>{r.owner_phone && <a className="text-xs text-[#c43700]" href={getWhatsappUrl(r.owner_phone)||undefined} target="_blank" rel="noopener noreferrer">{formatPhone(r.owner_phone)}</a>}</div> },
        { key: "date", label: "Data", className: styles.dateCell, render: r => formatDateTime(r.created_at) },
        { key: "pix", label: section === "failed" ? "PIX atual" : "PIX", render: r => <p className="min-w-24 max-w-40 break-all text-xs">{(section === "history" && r.pix_address_key) || r.pix_key || "Não cadastrado"}</p> },
        { key: "gross", label: "Bruto", className: styles.numericCell, render: r => nullableMoney(r.gross_cents) },
        { key: "gateway", label: "Gateway", className: styles.numericCell, render: r => nullableMoney(r.payzu_fee_cents) },
        { key: "discount", label: "Desconto", className: styles.numericCell, render: r => nullableMoney(r.discount_cents) },
        { key: "amount", label: section === "history" ? "Valor do repasse" : "Valor", className: styles.numericCell, render: r => money(r.amount_cents) },
        { key: "status", label: "Status", render: r => <div><PayoutStatus status={r.status}/>{section === "failed" && <p className="mt-2 min-w-40 max-w-64 text-xs text-gray-500">{r.failure_reason || "Motivo não registrado."}</p>}</div> },
        ...(section === "failed" ? [{ key: "retry", label: "", render: (r: History) => <Button variant="secondary" disabled={!canRetry || r.status !== "failed" || !r.pix_key || Boolean(r.asaas_transfer_id)} onClick={() => onRetry(r.id)}>Tentar novamente</Button> }] : []),
    ];
    return <>
        <section className={`${styles.section} ${styles.scrollTable} ${section === "failed" ? styles.payoutFailures : ""}`}>
            <div className={styles.sectionHeader}><h2>{section === "failed" ? "Repasses com falha" : section === "runs" ? "Histórico diário" : "Histórico de repasses"}</h2>{section === "failed" && data.total > 0 && <Badge variant="danger">{data.total} registro(s)</Badge>}</div>
            {error && <p role="alert" className="text-red-700">{error}</p>}
            <PagedTable data={data} loading={loading} rowKey={r => r.id} onPage={setPage} columns={columns} onRowClick={section === "runs" ? setSelectedRun : undefined}/>
        </section>
        <DevDialog title={`Execução de ${runDate(selectedRun?.run_date)}`} open={Boolean(selectedRun)} onClose={() => setSelectedRun(null)}>
            {selectedRun && <div className="space-y-5">
                <dl className={styles.detailMetrics}>{[
                    ["Bruto", selectedRun.gross_cents], ["Gateway", selectedRun.payzu_fee_cents], ["Desconto", selectedRun.discount_cents], ["Lucro líquido pago", selectedRun.paid_profit_cents],
                    ["Planejado para envio", selectedRun.payout_cents], ["Transferido ao Asaas", selectedRun.transferred_cents], ["Saldo Asaas antes do envio", selectedRun.asaas_balance_before_payout_cents], ["Saldo Asaas − planejado", selectedRun.difference_cents],
                ].map(([label, value]) => <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-2 font-semibold tabular-nums">{nullableMoney(value as number | null | undefined)}</dd></div>)}</dl>
                <DataTable rows={[
                    { step: "Transferir saldo", status: selectedRun.payzu_step_status }, { step: "Ajustar para 1% líquido", status: selectedRun.adjustment_step_status },
                    { step: "Comparação de saldo", status: selectedRun.comparison_step_status }, { step: "Enviar aos restaurantes", status: selectedRun.payout_step_status },
                ]} rowKey={r => r.step} columns={[{key:"step",label:"Etapa",render:r=>r.step},{key:"status",label:"Status",render:r=><PayoutStatus status={r.status}/>}]} />
                <p className="text-sm">{selectedRun.paid_count || 0} pagos · {selectedRun.processing_count || 0} processando · {selectedRun.failed_count || 0} falhas</p>
                {selectedRun.error_message && <p role="alert" className="text-sm text-red-700">{selectedRun.error_message}</p>}
            </div>}
        </DevDialog>
    </>;
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
    const totals = summarizeOnePercentPayouts(payables);
    const selected = payables.filter(row => row.canSend && row.grossCents > 0 && (!confirmation?.ids || confirmation.ids.includes(row.restaurantId)));
    async function send() {
        if (!confirmation || !data) return;
        setSending(true); setError(""); setMessage("");
        try {
            const result = await devJson<{ paidCount?: number; processingCount?: number; failedCount?: number; validationErrors?: PayoutRestaurantError[] }>("/api/dev/payout", { method: "POST", body: JSON.stringify(confirmation.fund ? { action: "fund_asaas" } : confirmation.retry ? { retryPayoutId: confirmation.retry } : { discountPercent: 1, adjustToOnePercent: true, restaurantIds: selected.map(row => row.restaurantId), cutoffAt: data.cutoffAt }) });
            setMessage(confirmation.fund ? "Transferência para o Asaas solicitada." : `${result.paidCount || 0} pagos · ${result.processingCount || 0} processando · ${result.failedCount || 0} com falha · ${result.validationErrors?.length || 0} bloqueados por validação.`);
            setConfirmation(null); setRevision(r => r + 1);
        } catch (e) { setError((e as Error).message); } finally { setSending(false); }
    }
    return <>
        {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status" className="text-green-700">{message}</p>}
        <HistoryTable section="failed" revision={revision} canRetry={Boolean(data?.asaasConfigured)} onRetry={id => setConfirmation({ retry: id })} />
        {!data ? <Loader /> : <>
            <dl className={styles.metricStrip}><div><dt>Saldo Asaas</dt><dd>{data.asaasBalanceCents === null ? "—" : money(data.asaasBalanceCents)}</dd>{data.asaasError ? <p className="mt-2 text-sm text-red-700">{data.asaasError}</p> : !data.asaasConfigured && <p>Asaas não configurado.</p>}</div><div><dt>Total a repassar (líquido)</dt><dd>{money(totals.netCents)}</dd><p>{money(totals.grossCents)} bruto · Gateway {money(totals.payzuFeeCents)} · Desconto {money(totals.discountCents)} · 1% total</p></div></dl>
            {data.validationErrors?.length > 0 && <section className={`${styles.section} ${styles.scrollTable}`}>
                <div className={styles.sectionHeader}><h2>Restaurantes bloqueados por validação</h2><Badge variant="danger">{data.validationErrors.length} restaurante(s)</Badge></div>
                <DataTable rows={data.validationErrors} rowKey={row => row.restaurantId} columns={[
                    { key: "restaurant", label: "Restaurante", render: row => row.restaurantName },
                    { key: "gross", label: "Bruto bloqueado", className: styles.numericCell, render: row => money(row.grossCents) },
                    { key: "error", label: "Motivo", render: row => <p className="max-w-xl break-words text-xs text-red-700">{row.message}</p> },
                ]} />
            </section>}
            <section className={`${styles.section} ${styles.scrollTable}`}><div className={styles.sectionHeader}><h2>Valores por restaurante</h2><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={sending || !data.asaasConfigured} onClick={() => setConfirmation({ fund: true })}>Abastecer Asaas</Button><Button disabled={sending || !data.asaasConfigured || !payables.some(row => row.canSend && row.grossCents > 0)} onClick={() => setConfirmation({})}>Enviar repasses</Button></div></div>
                <PagedTable data={{ rows: payables.slice(page * 25, (page + 1) * 25), total: payables.length, page, pageCount: Math.ceil(payables.length / 25) }} onPage={setPage} rowKey={r => r.restaurantId} columns={[
                    { key: "name", label: "Restaurante", render: r => <div className="min-w-40"><p className="font-medium">{r.restaurantName}</p>{data.ownerPhones[r.restaurantId] && <a className="text-xs text-[#c43700]" href={getWhatsappUrl(data.ownerPhones[r.restaurantId])||undefined} target="_blank" rel="noopener noreferrer">{formatPhone(data.ownerPhones[r.restaurantId])}</a>}</div> },
                    { key: "pix", label: "PIX", render: r => <p className="min-w-24 max-w-40 break-all text-xs">{r.pixKey ? <>{r.pixKeyType && <span className="text-gray-500">{r.pixKeyType} · </span>}{r.pixKey}</> : <span className="text-red-700">Não cadastrado</span>}</p> },
                    { key: "gross", label: "Bruto elegível", className: styles.numericCell, render: r => money(r.grossCents) },
                    { key: "gateway", label: "Gateway", className: styles.numericCell, render: r => money(r.payzuFeeCents) },
                    { key: "discount", label: "Desconto", className: styles.numericCell, render: r => money(calculateOnePercentPayout(r.grossCents,r.payzuFeeCents).discountCents) },
                    { key: "net", label: "Repasse líquido", className: styles.numericCell, render: r => <span className="font-semibold">{money(net(r))}</span> },
                    { key: "waiting", label: "A liberar", className: styles.numericCell, render: r => <div><span>{money(r.waitingGrossCents)}</span>{r.waitingGrossCents > 0 && r.nextEligibleAt && <p className="mt-1 text-xs text-gray-500">Até {formatDateTime(r.nextEligibleAt)}</p>}</div> },
                    { key: "send", label: "", render: r => <Button variant="secondary" disabled={sending || !data.asaasConfigured || !r.canSend || r.grossCents <= 0} onClick={() => setConfirmation({ ids: [r.restaurantId] })}>Enviar repasse</Button> },
                ]} />
            </section>
        </>}
        <Tabs tabs={["Histórico diário","Histórico de repasses"]} active={historyTab} onChange={setHistoryTab}/><HistoryTable key={historyTab} section={historyTab==="Histórico diário"?"runs":"history"} revision={revision} onRetry={()=>undefined}/>
        <ConfirmModal open={Boolean(confirmation)} onClose={() => { if (!sending) setConfirmation(null); }} onConfirm={() => void send()} isLoading={sending} variant="primary" title={confirmation?.fund ? "Abastecer Asaas" : "Confirmar repasse"} description={confirmation?.fund ? "Transferir apenas o valor necessário do Mercado Pago para cobrir os repasses elegíveis." : confirmation?.retry ? "Tentar novamente este repasse usando os valores registrados e os dados PIX atuais da loja." : `Enviar ${money(selected.reduce((sum, row) => sum + net(row), 0))} para ${selected.length} restaurante(s), com desconto total de 1% do bruto.`} confirmLabel="Confirmar e enviar" />
    </>;
}
