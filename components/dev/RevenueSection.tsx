"use client";

import { useEffect, useState } from "react";
import { useDevProfile } from "./DevProfileProvider";
import PagedTable, { type PageData } from "./PagedTable";
import DevLoading from "./DevLoading";
import { devJson } from "@/lib/dev/client";
import { formatCount, formatCurrencyFromCents, formatDateTime, formatRatio } from "@/lib/dev/dashboardFormat";
import styles from "./dashboard.module.css";

type Purchase = {
    id: string;
    restaurantId: string;
    restaurantName: string;
    paidAt: string;
    amountCents: number;
    method: string;
    provider: string | null;
    isRenewal: boolean;
};
type RevenueData = {
    summary: {
        purchases30: number;
        new30: number;
        renewals30: number;
        gross30: number;
        pix30: number;
        pixGross30: number;
        card30: number;
        cardGross30: number;
        other30: number;
    };
    purchases: PageData<Purchase>;
};

const share = (part: number, total: number) => formatRatio(total ? part / total * 100 : 0);
const providerLabel = (value: string | null) => ({
    mercadopago: "Mercado Pago", asaas: "Asaas", payzu: "PayZu",
}[value?.toLowerCase() as "mercadopago" | "asaas" | "payzu"] || value || "—");

export default function RevenueSection() {
    const { openProfile } = useDevProfile();
    const [page, setPage] = useState(0);
    const [data, setData] = useState<RevenueData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        void devJson<RevenueData>(`/api/dev/revenue?page=${page}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); })
            .catch(err => { if (!controller.signal.aborted) setError(err.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page]);

    if (!data && loading) return <DevLoading />;
    return <div className="space-y-6">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {data && <>
            <dl className={styles.metricStrip} aria-label="Receita iMenu Plus nos últimos 30 dias">
                <div>
                    <dt>Pagamentos Plus</dt>
                    <dd className="tabular-nums">{formatCount(data.summary.purchases30)}</dd>
                    <p>{formatCount(data.summary.new30)} novas · {formatCount(data.summary.renewals30)} renovações · 30 dias</p>
                </div>
                <div>
                    <dt>Receita bruta</dt>
                    <dd className="tabular-nums">{formatCurrencyFromCents(data.summary.gross30)}</dd>
                    <p>Todos os pagamentos confirmados · 30 dias</p>
                </div>
                <div>
                    <dt>Pix</dt>
                    <dd className="tabular-nums">{formatCurrencyFromCents(data.summary.pixGross30)}</dd>
                    <p>{formatCount(data.summary.pix30)} compras · {share(data.summary.pixGross30, data.summary.gross30)} da receita</p>
                </div>
                <div>
                    <dt>Cartão</dt>
                    <dd className="tabular-nums">{formatCurrencyFromCents(data.summary.cardGross30)}</dd>
                    <p>{formatCount(data.summary.card30)} compras · {share(data.summary.cardGross30, data.summary.gross30)} da receita</p>
                </div>
            </dl>
            <section className={styles.tableSection}>
                <h2>Compras iMenu Plus <span className="font-normal text-gray-500">({formatCount(data.purchases.total)})</span></h2>
                <PagedTable data={data.purchases} loading={loading} onPage={setPage} rowKey={row => row.id}
                    onRowClick={row => openProfile({ id: row.restaurantId, name: row.restaurantName })}
                    columns={[
                        { key: "restaurant", label: "Restaurante", render: row => <button type="button" className={styles.profileLink} onClick={event => { event.stopPropagation(); openProfile({ id: row.restaurantId, name: row.restaurantName }); }} title={row.restaurantName}><span className="block max-w-72 truncate">{row.restaurantName}</span></button> },
                        { key: "type", label: "Tipo", className: "whitespace-nowrap", render: row => row.isRenewal ? "Renovação" : "Nova" },
                        { key: "paidAt", label: "Pagamento", className: styles.dateCell, render: row => formatDateTime(row.paidAt) },
                        { key: "method", label: "Método", className: "whitespace-nowrap", render: row => row.method },
                        { key: "amount", label: "Valor", className: styles.numericCell, render: row => formatCurrencyFromCents(row.amountCents) },
                        { key: "provider", label: "Provedor", className: "whitespace-nowrap", render: row => providerLabel(row.provider) },
                    ]} />
            </section>
        </>}
    </div>;
}
