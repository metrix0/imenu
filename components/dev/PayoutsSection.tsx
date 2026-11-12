"use client";

import { useEffect, useState } from "react";
import { Eye, Send } from "lucide-react";
import { useDevProfile } from "./DevProfileProvider";
import styles from "./dashboard.module.css";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import { formatPhone, getWhatsappUrl } from "@/lib/dev/supportView";
import Button from "@/components/ui/Button";
import ConfirmModal from "@/components/ui/ConfirmModal";
import DataTable, { type TableColumn } from "@/components/ui/DataTable";
import DevDialog from "./DevDialog";
import DevLoading from "./DevLoading";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents as money, formatDateTime } from "@/lib/dev/dashboardFormat";
import { calculateOnePercentPayout, summarizeOnePercentPayouts } from "@/lib/services/payoutSafety";

type Payable = { restaurantId: string; restaurantName: string; grossCents: number; payzuFeeCents: number; waitingGrossCents: number; canSend: boolean; pixKey: string | null; pixKeyType: string | null; nextEligibleAt: string | null };
type PayoutRestaurantError = { restaurantId: string; restaurantName: string; orderId: string; paymentRef: string; grossCents: number; message: string };
type Dashboard = { asaasBalanceCents: number | null; asaasConfigured: boolean; asaasError: string | null; cutoffAt: string; payables: Payable[]; validationErrors: PayoutRestaurantError[]; ownerPhones:Record<string,string> };
type TroubledPayout = { id: string; restaurant_name: string; amount_cents: number; status: string; failure_reason: string | null; alert_status: string | null };
type History = {
    id: string; restaurant_id: string; alert_status?: string | null; alert_message?: string | null; alert_error?: string | null; restaurant_name: string; created_at: string; amount_cents: number; status: string; failure_reason: string | null;
    run_date?: string; payout_cents?: number; restaurant_count?: number; failed_count?: number; paid_count?: number; processing_count?: number; troubled_payouts?: TroubledPayout[];
    pix_key?: string | null; pix_key_type?: string | null; pix_address_key?: string | null; owner_phone?: string | null; asaas_transfer_id?: string | null;
    gross_cents?: number | null; payzu_fee_cents?: number | null; discount_cents?: number | null; paid_profit_cents?: number | null;
    transferred_cents?: number | null; asaas_balance_before_payout_cents?: number | null; difference_cents?: number | null;
    payzu_step_status?: string; adjustment_step_status?: string; comparison_step_status?: string; payout_step_status?: string; error_message?: string | null;
};
const statusLabels: Record<string, string> = { failed: "Falhou", cancelled: "Cancelado", canceled: "Cancelado", paid: "Pago", processing: "Processando", pending: "Pendente", completed: "Concluído", partial: "Parcial", blocked: "Bloqueado", running: "Executando", skipped: "Não executado" };
const nullableMoney = (value: number | null | undefined) => value == null ? "—" : money(value);
const payoutFigure = (cents: number) => (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const runDate = (value?: string) => value ? value.slice(0, 10).split("-").reverse().join("/") : "—";
function PayoutStatus({ status }: { status?: string }) {
    return <Badge variant={status === "failed" || status === "cancelled" || status === "canceled" || status === "blocked" ? "danger" : status === "partial" ? "warning" : status === "paid" || status === "completed" ? "success" : status === "running" || status === "processing" ? "info" : "neutral"}>{status ? statusLabels[status] || status : "—"}</Badge>;
}

function HistoryTable({ section, revision, onRetry, onMarkPaid, busy = false, canRetry = false }: { section: "failed" | "history" | "runs"; revision: number; onRetry: (payout: History) => void; onMarkPaid?: (payout: History) => void; busy?: boolean; canRetry?: boolean }) {
    const { openProfile } = useDevProfile();
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
        { key: "sent", label: "Envios", render: r => <div className="min-w-0"><p>{r.restaurant_count} restaurante(s)</p><p className="mt-1 text-xs text-gray-500">{r.paid_count || 0} pagos · {r.processing_count || 0} processando · {r.failed_count || 0} falhas</p></div> },
        { key: "status", label: "Status", render: r => <PayoutStatus status={r.status} /> },
        { key: "error", label: "Erro", render: r => <p className="min-w-0 max-w-64 break-words text-xs text-red-700">{r.error_message || "—"}</p> },
        { key: "details", label: "", render: r => <button type="button" title="Ver detalhes" aria-label="Ver detalhes da execução" className="cursor-pointer rounded-md p-2 text-gray-500 hover:bg-gray-100 hover:text-brand" onClick={event => { event.stopPropagation(); setSelectedRun(r); }}><Eye size={16} aria-hidden="true" /></button> },
    ] : [
        { key: "name", label: "Restaurante", render: r => <div className="min-w-0"><button type="button" className={styles.profileLink} onClick={event => {event.stopPropagation();openProfile({id:r.restaurant_id,name:r.restaurant_name});}}>{r.restaurant_name}</button>{section !== "failed" && r.owner_phone && <a className="text-xs text-[#c43700]" href={getWhatsappUrl(r.owner_phone)||undefined} target="_blank" rel="noopener noreferrer">{formatPhone(r.owner_phone)}</a>}</div> },
        { key: "date", label: "Data", className: styles.dateCell, render: r => formatDateTime(r.created_at) },
        { key: "pix", label: section === "failed" ? "PIX atual" : "PIX", render: r => <p className="min-w-0 max-w-40 break-all text-xs">{(section === "history" && r.pix_address_key) || r.pix_key || "Não cadastrado"}</p> },
        { key: "breakdown", label: "Bruto / Gateway / Desconto / Lucro", render: r => <span className={styles.payoutBreakdown}>{r.gross_cents == null ? "—" : `R$ ${payoutFigure(r.gross_cents)}`} / {r.payzu_fee_cents == null ? "—" : payoutFigure(r.payzu_fee_cents)} / {r.gross_cents == null ? "—" : payoutFigure(r.gross_cents - r.amount_cents)} / {r.discount_cents == null ? "—" : payoutFigure(r.discount_cents)}</span> },
        { key: "amount", label: section === "history" ? "Valor do repasse" : "Valor", className: styles.numericCell, render: r => money(r.amount_cents) },
        { key: "status", label: "Status", render: r => <div><PayoutStatus status={r.status}/>{section === "failed" && <p className="mt-2 min-w-0 max-w-64 text-xs text-gray-500">{r.failure_reason || "Motivo não registrado."}</p>}</div> },
        ...(section === "failed" ? [{ key: "alert", label: "Alerta", render: (r: History) => <div className="flex flex-wrap gap-1" title={r.alert_error || undefined}><Badge variant={r.alert_status === "sent" ? "success" : r.alert_status === "failed" ? "danger" : "neutral"}>{r.alert_status === "sent" ? "Enviado" : r.alert_status === "failed" ? "Falhou" : r.alert_status === "sending" ? "Enviando" : "Não enviado"}</Badge>{(!r.pix_key || r.alert_message?.includes("não tem uma chave PIX")) ? <Badge variant="warning">Pix não cadastrado</Badge> : (r.alert_message?.includes("incorretamente") || /pix.*(invalid|incorret)|invalid.*pix/i.test(r.failure_reason || "")) ? <Badge variant="warning">Pix incorreto</Badge> : null}</div> }] : []),
        ...(section === "failed" ? [{ key: "actions", label: "", render: (r: History) => <div className={styles.payoutRowActions}><Button variant="secondary" disabled={busy || !canRetry} onClick={() => onRetry(r)}>Tentar novamente</Button><Button variant="secondary" disabled={busy} onClick={() => onMarkPaid?.(r)}>Marcar como pago</Button></div> }] : []),
    ];
    return <>
        <section className={`${styles.tableSection} ${styles.payoutTable} ${section === "failed" ? styles.payoutFailed : ""}`} aria-label={section === "failed" ? "Repasses com falha" : section === "runs" ? "Histórico" : "Histórico por restaurante"}>
            {section === "failed" && <div className="mb-3.5 flex items-center gap-3"><h2 className="text-lg font-semibold">Repasses com falha</h2>{data.total > 0 && <Badge variant="danger">{data.total} registro(s)</Badge>}</div>}
            {error && <p role="alert" className="text-red-700">{error}</p>}
            <PagedTable pageSize={10} data={data} loading={loading} rowKey={r => r.id} onPage={setPage} columns={columns} onRowClick={section === "runs" ? setSelectedRun : undefined}/>
        </section>
        <DevDialog title={`Execução de ${runDate(selectedRun?.run_date)}`} open={Boolean(selectedRun)} onClose={() => setSelectedRun(null)} wide={section === "runs"}>
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
                <section className="space-y-3">
                    <h3 className="text-base font-semibold">Repasses com problema</h3>
                    {selectedRun.troubled_payouts?.length ? <div className="overflow-x-auto">
                        <DataTable rows={selectedRun.troubled_payouts} rowKey={row => row.id} columns={[
                            { key: "restaurant", label: "Restaurante", render: row => row.restaurant_name },
                            { key: "amount", label: "Valor", render: row => money(row.amount_cents) },
                            { key: "status", label: "Status", render: row => <PayoutStatus status={row.status} /> },
                            { key: "reason", label: "Motivo", render: row => row.failure_reason || "Motivo não registrado." },
                            { key: "notice", label: "Aviso automático", render: row => <Badge variant={row.alert_status === "sent" ? "success" : row.alert_status === "failed" ? "danger" : "neutral"}>{row.alert_status === "sent" ? "Enviado" : row.alert_status === "failed" ? "Falhou" : row.alert_status === "sending" ? "Enviando" : "Não enviado"}</Badge> },
                        ]} />
                    </div> : <p className="text-sm text-gray-500">Nenhum repasse individual com problema registrado.</p>}
                </section>
                {selectedRun.error_message && <p role="alert" className="text-sm text-red-700">{selectedRun.error_message}</p>}
            </div>}
        </DevDialog>
    </>;
}

export default function PayoutsSection() {
    const { openProfile } = useDevProfile();
    const [validationPage,setValidationPage] = useState(0);
    const [historyTab,setHistoryTab] = useState("Histórico");
    const [data, setData] = useState<Dashboard | null>(null);
    const [revision, setRevision] = useState(0);
    const [page, setPage] = useState(0);
    const [error, setError] = useState("");
    const [message, setMessage] = useState("");
    const [sending, setSending] = useState(false);
    const [selectedRestaurantIds,setSelectedRestaurantIds] = useState<string[]>([]);
    const [confirmation, setConfirmation] = useState<{ ids?: string[]; retry?: History } | null>(null);
    const [manualPayment, setManualPayment] = useState<{ payable?: Payable; payout?: History } | null>(null);
    useEffect(() => {
        const controller = new AbortController();
        void devJson<Dashboard>("/api/dev/payout", { signal: controller.signal }).then(result => {setData(result);setSelectedRestaurantIds(result.payables.filter(row=>row.canSend && row.grossCents > 0).map(row=>row.restaurantId));}).catch(e => { if (!controller.signal.aborted) setError(e.message); });
        return () => controller.abort();
    }, [revision]);
    const payables = [...(data?.payables || [])].sort((a,b)=>Number(!b.pixKey)-Number(!a.pixKey)||b.grossCents-a.grossCents);
    const net = (row: Payable) => calculateOnePercentPayout(row.grossCents, row.payzuFeeCents).netCents;
    const totals = summarizeOnePercentPayouts(payables);
    const eligible = payables.filter(row=>row.canSend && row.grossCents > 0);
    const selectedForBatch = eligible.filter(row=>selectedRestaurantIds.includes(row.restaurantId));
    const selected = eligible.filter(row=>confirmation?.ids?.includes(row.restaurantId));
    const selectedTotal = summarizeOnePercentPayouts(selectedForBatch).netCents;
    async function send() {
        if (!confirmation || !data || (!confirmation.retry && !selected.length)) return;
        setSending(true); setError(""); setMessage("");
        try {
            const result = await devJson<{ paidCount?: number; processingCount?: number; failedCount?: number; validationErrors?: PayoutRestaurantError[] }>("/api/dev/payout", { method: "POST", body: JSON.stringify(confirmation.retry ? { retryPayoutId: confirmation.retry.id } : { discountPercent: 1, adjustToOnePercent: true, restaurantIds: selected.map(row => row.restaurantId), cutoffAt: data.cutoffAt }) });
            setMessage(`${result.paidCount || 0} pagos · ${result.processingCount || 0} processando · ${result.failedCount || 0} com falha · ${result.validationErrors?.length || 0} pedidos excluídos por validação.`);
            setConfirmation(null); setRevision(r => r + 1);
        } catch (e) { setError((e as Error).message); } finally { setSending(false); }
    }
    async function markPaid() {
        if (!manualPayment || (!manualPayment.payout && (!manualPayment.payable || !data))) return;
        setSending(true); setError(""); setMessage("");
        try {
            const payout = manualPayment.payout;
            const payable = manualPayment.payable;
            const result = await devJson<{ amountCents: number; restaurantName: string }>("/api/dev/payout", {
                method: "POST",
                body: JSON.stringify(payout
                    ? { action: "mark_paid", payoutId: payout.id, expectedAmountCents: payout.amount_cents }
                    : { action: "mark_paid", restaurantId: payable!.restaurantId, cutoffAt: data!.cutoffAt,
                        expectedAmountCents: net(payable!) }),
            });
            setMessage(`${result.restaurantName}: ${money(result.amountCents)} marcado como pago, sem enviar Pix.`);
            setManualPayment(null);
            setRevision(current => current + 1);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setSending(false);
        }
    }
    const manualName = manualPayment?.payout?.restaurant_name || manualPayment?.payable?.restaurantName || "";
    const manualAmount = manualPayment?.payout?.amount_cents ??
        (manualPayment?.payable ? net(manualPayment.payable) : 0);
    return <>
        {error && <p role="alert" className="text-red-700">{error}</p>}{message && <p role="status" className="text-green-700">{message}</p>}
        <HistoryTable section="failed" revision={revision} canRetry={Boolean(data?.asaasConfigured)} busy={sending} onRetry={payout => setConfirmation({ retry: payout })} onMarkPaid={payout => setManualPayment({ payout })} />
        {!data ? <DevLoading /> : <>
            <dl className={styles.metricStrip}><div><dt>Saldo Asaas</dt><dd>{data.asaasBalanceCents === null ? "—" : money(data.asaasBalanceCents)}</dd>{data.asaasError ? <p className="mt-2 text-sm text-red-700">{data.asaasError}</p> : !data.asaasConfigured && <p>Asaas não configurado.</p>}</div><div><dt>Total a repassar (líquido)</dt><dd>{money(totals.netCents)}</dd><p>{money(totals.grossCents)} bruto · Gateway {money(totals.payzuFeeCents)} · Desconto {money(totals.discountCents)} · 1% total</p></div></dl>
            {data.validationErrors?.length > 0 && <section className={`${styles.tableSection} ${styles.payoutTable}`}>
                <h2>Pedidos excluídos por validação <Badge variant="danger">{data.validationErrors.length} pedido(s)</Badge></h2>
                <PagedTable pageSize={10} data={{rows:data.validationErrors.slice(validationPage*10,(validationPage+1)*10),total:data.validationErrors.length,page:validationPage,pageCount:Math.ceil(data.validationErrors.length/10)}} onPage={setValidationPage} rowKey={row => row.orderId} columns={[
                    { key: "restaurant", label: "Restaurante", render: row => row.restaurantName },
                    { key: "payment", label: "Pagamento", render: row => <p className="max-w-36 break-all text-xs">{row.paymentRef}</p> },
                    { key: "gross", label: "Bruto excluído", className: styles.numericCell, render: row => money(row.grossCents) },
                    { key: "error", label: "Motivo", render: row => <p className="max-w-xl break-words text-xs text-red-700">{row.message}</p> },
                ]} />
            </section>}
            <section className={`${styles.tableSection} ${styles.payoutTable} ${styles.payoutPayables}`}><div className="mb-3.5 flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Valores por restaurante</h2><div className="flex w-full flex-wrap items-center gap-3 md:w-auto"><label className="inline-flex items-center gap-2 text-sm text-[#626973] md:hidden"><input type="checkbox" checked={eligible.length > 0 && selectedForBatch.length === eligible.length} ref={element=>{if(element)element.indeterminate=selectedForBatch.length > 0 && selectedForBatch.length < eligible.length;}} disabled={sending || !eligible.length} onChange={event=>setSelectedRestaurantIds(event.target.checked ? eligible.map(row=>row.restaurantId) : [])} className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-not-allowed disabled:opacity-40" />Selecionar todos os elegíveis</label><Button className="min-w-0 w-full md:w-auto" leftIcon={<Send size={16} aria-hidden="true" />} disabled={sending || !data.asaasConfigured || !selectedForBatch.length} onClick={() => setConfirmation({ids:selectedForBatch.map(row=>row.restaurantId)})}>Enviar selecionados — {money(selectedTotal)}</Button></div></div>
                <PagedTable pageSize={10} data={{ rows: payables.slice(page * 10, (page + 1) * 10), total: payables.length, page, pageCount: Math.ceil(payables.length / 10) }} onPage={setPage} rowKey={r => r.restaurantId} columns={[
                    {key:"select",label:"Selecionar",header:<input type="checkbox" aria-label="Selecionar todos os restaurantes elegíveis" checked={eligible.length > 0 && selectedForBatch.length === eligible.length} ref={element=>{if(element)element.indeterminate=selectedForBatch.length > 0 && selectedForBatch.length < eligible.length;}} disabled={sending || !eligible.length} onChange={event=>setSelectedRestaurantIds(event.target.checked ? eligible.map(row=>row.restaurantId) : [])} className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-not-allowed disabled:opacity-40" />,render:r=><input type="checkbox" aria-label={`Selecionar ${r.restaurantName}`} checked={selectedRestaurantIds.includes(r.restaurantId)} disabled={sending || !r.canSend || r.grossCents <= 0} onChange={event=>setSelectedRestaurantIds(current=>event.target.checked ? [...current.filter(id=>id!==r.restaurantId),r.restaurantId] : current.filter(id=>id!==r.restaurantId))} className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-not-allowed disabled:opacity-40" />},
                    { key: "name", label: "Restaurante", render: r => <div className="min-w-0"><button type="button" className={styles.profileLink} onClick={event => {event.stopPropagation();openProfile({id:r.restaurantId,name:r.restaurantName});}}>{r.restaurantName}</button>{data.ownerPhones[r.restaurantId] && <a className="text-xs text-[#c43700]" href={getWhatsappUrl(data.ownerPhones[r.restaurantId])||undefined} target="_blank" rel="noopener noreferrer">{formatPhone(data.ownerPhones[r.restaurantId])}</a>}</div> },
                    { key: "pix", label: "PIX", render: r => <p className="min-w-0 max-w-40 break-all text-xs">{r.pixKey ? <>{r.pixKeyType && <span className="text-gray-500">{r.pixKeyType} · </span>}{r.pixKey}</> : <span className="text-red-700">Não cadastrado</span>}</p> },
                    { key: "breakdown", label: "Bruto / Gateway / Desconto / Lucro", render: r => {
                        const payout = calculateOnePercentPayout(r.grossCents, r.payzuFeeCents);
                        return <span className={styles.payoutBreakdown}>R$ {payoutFigure(r.grossCents)} / {payoutFigure(r.payzuFeeCents)} / {payoutFigure(r.grossCents - payout.netCents)} / {payoutFigure(payout.discountCents)}</span>;
                    } },
                    { key: "net", label: "Repasse líquido", className: styles.numericCell, render: r => <span className="font-semibold">{money(net(r))}</span> },
                    { key: "waiting", label: "A liberar", className: styles.numericCell, render: r => <div><span>{money(r.waitingGrossCents)}</span>{r.waitingGrossCents > 0 && r.nextEligibleAt && <p className="mt-1 text-xs text-gray-500">Até {formatDateTime(r.nextEligibleAt)}</p>}</div> },
                    { key: "send", label: "", render: r => <div className={styles.payoutRowActions}><Button variant="secondary" disabled={sending || !data.asaasConfigured || !r.canSend || r.grossCents <= 0} onClick={() => setConfirmation({ ids: [r.restaurantId] })}>Enviar repasse</Button><Button variant="secondary" aria-label={`Marcar repasse de ${r.restaurantName} como pago`} disabled={sending || r.grossCents <= 0} onClick={() => setManualPayment({ payable: r })}>Marcar pago</Button></div> },
                ]} />
            </section>
        </>}
        <Tabs tabs={["Histórico","Histórico por restaurante"]} active={historyTab} onChange={setHistoryTab}/><HistoryTable key={historyTab} section={historyTab==="Histórico"?"runs":"history"} revision={revision} onRetry={()=>undefined}/>
        <ConfirmModal open={Boolean(confirmation)} onClose={() => { if (!sending) setConfirmation(null); }} onConfirm={() => void send()} isLoading={sending} variant="primary" title={confirmation?.retry ? "Confirmar reenvio do Pix" : "Confirmar repasse"} description={confirmation?.retry ? `Reenviar ${money(confirmation.retry.amount_cents)} para ${confirmation.retry.restaurant_name} usando os dados PIX atuais da loja? Antes do envio, o Asaas será consultado para confirmar que a transferência anterior não foi concluída.` : `Enviar ${money(selected.reduce((sum, row) => sum + net(row), 0))} para ${selected.length} restaurante(s), com desconto total de 1% do bruto.`} confirmLabel={confirmation?.retry ? "Confirmar reenvio" : "Confirmar e enviar"} />
        <ConfirmModal open={Boolean(manualPayment)} onClose={() => { if (!sending) setManualPayment(null); }} onConfirm={() => void markPaid()} isLoading={sending} variant="primary" title="Marcar repasse como pago?" description={`Confirma que ${manualName} já recebeu ${money(manualAmount)}? Essa ação registra o pagamento, sem enviar Pix pelo iMenu.`} confirmLabel="Sim, marcar como pago" />
    </>;
}
