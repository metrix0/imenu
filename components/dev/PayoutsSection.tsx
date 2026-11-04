"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Loader from "@/components/ui/Loader";
import Tooltip from "@/components/ui/Tooltip";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents as money, formatDateTime } from "@/lib/dev/dashboardFormat";
import { calculateOnePercentPayout } from "@/lib/services/payoutSafety";

type Payable = { restaurantId: string; restaurantName: string; grossCents: number; payzuFeeCents: number; waitingGrossCents: number; canSend: boolean; pixKey: string | null; nextEligibleAt: string | null };
type Dashboard = { asaasBalanceCents: number | null; asaasConfigured: boolean; asaasError: string | null; cutoffAt: string; outstandingPayoutCents: number; payables: Payable[] };
type History = { id: string; restaurant_name: string; created_at: string; amount_cents: number; status: string; failure_reason: string | null; run_date?: string; payout_cents?: number; restaurant_count?: number; failed_count?: number };

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
    return <section className="space-y-4"><h2 className="text-lg font-semibold">{section === "failed" ? "Repasses com falha" : section === "runs" ? "Histórico diário" : "Histórico de repasses"}</h2>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <PagedTable data={data} loading={loading} rowKey={r => r.id} onPage={setPage} columns={[
            { key: "name", label: section === "runs" ? "Dia" : "Restaurante", render: r => section === "runs" ? String(r.run_date).slice(0, 10) : r.restaurant_name },
            { key: "amount", label: "Valor", render: r => money(section === "runs" ? r.payout_cents || 0 : r.amount_cents) },
            { key: "status", label: "Status", render: r => <Tooltip text={r.failure_reason || ""} showOnClick><span className={section === "failed" ? "text-red-700" : ""}>{r.status}</span></Tooltip> },
            { key: "date", label: section === "runs" ? "Restaurantes / falhas" : "Data", render: r => section === "runs" ? `${r.restaurant_count} / ${r.failed_count}` : formatDateTime(r.created_at) },
            ...(section === "failed" ? [{ key: "retry", label: "", render: (r: History) => <Button variant="secondary" onClick={() => onRetry(r.id)}>Tentar novamente</Button> }] : []),
        ]} />
    </section>;
}

export default function PayoutsSection() {
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
    const payables = data?.payables || [];
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
            <div className="grid gap-4 sm:grid-cols-2"><Card><p className="text-sm text-gray-500">Saldo Asaas</p><p className="mt-2 text-2xl font-semibold">{data.asaasBalanceCents === null ? "—" : money(data.asaasBalanceCents)}</p>{data.asaasError && <p className="mt-2 text-sm text-red-700">{data.asaasError}</p>}</Card><Card><p className="text-sm text-gray-500">Total a repassar (líquido)</p><p className="mt-2 text-2xl font-semibold">{money(due)}</p></Card></div>
            <section className="space-y-4"><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Valores por restaurante</h2><div className="flex flex-wrap gap-2"><Button variant="secondary" disabled={sending} onClick={() => setRevision(r => r + 1)}>Atualizar</Button><Button variant="secondary" disabled={sending || !data.asaasConfigured} onClick={() => setConfirmation({ fund: true })}>Abastecer Asaas</Button><Button disabled={sending || !data.asaasConfigured || !payables.some(row => row.canSend && row.grossCents > 0)} onClick={() => setConfirmation({})}>Enviar repasses</Button></div></div>
                <PagedTable data={{ rows: payables.slice(page * 25, (page + 1) * 25), total: payables.length, page, pageCount: Math.ceil(payables.length / 25) }} onPage={setPage} rowKey={r => r.restaurantId} columns={[
                    { key: "name", label: "Restaurante", render: r => r.restaurantName },
                    { key: "pix", label: "PIX", render: r => r.pixKey || <span className="text-red-700">Não cadastrado</span> },
                    { key: "gross", label: "Bruto elegível", render: r => money(r.grossCents) },
                    { key: "net", label: "Repasse líquido", render: r => money(net(r)) },
                    { key: "waiting", label: "Na margem de 1h30", render: r => <Tooltip text={r.nextEligibleAt ? formatDateTime(r.nextEligibleAt) : ""} showOnClick><span>{money(r.waitingGrossCents)}</span></Tooltip> },
                    { key: "send", label: "", render: r => <Button variant="secondary" disabled={sending || !data.asaasConfigured || !r.canSend || r.grossCents <= 0} onClick={() => setConfirmation({ ids: [r.restaurantId] })}>Enviar repasse</Button> },
                ]} />
            </section>
        </>}
        <HistoryTable section="runs" revision={revision} onRetry={() => undefined} /><HistoryTable section="history" revision={revision} onRetry={() => undefined} />
        <ConfirmModal open={Boolean(confirmation)} onClose={() => { if (!sending) setConfirmation(null); }} onConfirm={() => void send()} isLoading={sending} variant="primary" title={confirmation?.fund ? "Abastecer Asaas" : "Confirmar repasse"} description={confirmation?.fund ? "Transferir apenas o valor necessário do Mercado Pago para cobrir os repasses elegíveis." : confirmation?.retry ? "Tentar novamente este repasse usando os valores registrados e os dados PIX atuais da loja." : `Enviar ${money(selected.reduce((sum, row) => sum + net(row), 0))} para ${selected.length} restaurante(s), com desconto total de 1% do bruto.`} confirmLabel="Confirmar e enviar" />
    </>;
}
