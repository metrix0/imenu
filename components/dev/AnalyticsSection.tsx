"use client";

import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import styles from "./dashboard.module.css";
import type {DateRange} from "@/lib/utils/dateRange";
import DevLoading from "./DevLoading";
import { MetricCard, MetricChart, ProductOverviewSections } from "./DashboardPresentation";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents, formatCount, formatAverage } from "@/lib/dev/dashboardFormat";
import type { ProductOverview } from "@/lib/analytics/productOverview";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);
type Point = { label: string; value: number };
type Analytics = {
    productOverview: ProductOverview;
    previousProductOverview?: ProductOverview;
    range: { startAt: string; endAt: string };
    cards: { activatedUsers: number; activeUsers: number; activeCustomerUsers: number; moneyHandledCents: number; onlineMoneyHandledCents: number };
    series: { activatedUsersPerDay: Point[]; activeUsers: Point[]; activeCustomerUsers: Point[]; moneyHandledCents: Point[]; onlineMoneyHandledCents: Point[] };
    acquisitions: { registrations: Point[]; subscriptions: Point[]; previous: {registrations:number;subscriptions:number} };
    cardChanges: Record<string,number|null>;
};

const change=(current:number,previous:number)=>previous===0?(current===0?0:null):(current-previous)/previous*100;

export default function AnalyticsSection({range}:{range:DateRange}) {
    const [data, setData] = useState<Analytics | null>(null);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<Analytics>(`/api/dev/dashboard?startDate=${range.startDate}&endDate=${range.endDate}&compact=1`, { signal: controller.signal }).then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [range.startDate,range.endDate]);
    const days = data ? Math.max(1, Math.ceil((new Date(data.range.endAt).getTime() - new Date(data.range.startAt).getTime()) / 86400000)) : 1;
    return <>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {loading ? <DevLoading /> : data && <>
            <section aria-label="Indicadores-chave" className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                    <MetricCard inlineChange truncateTitle title="Usuários ativados / dia"
                        value={formatAverage(data.cards.activatedUsers / days)}
                        change={data.cardChanges.activatedUsers}
                        description={formatCount(data.cards.activatedUsers) + " usuários ativados no período"}
                        info="Contas que registraram o primeiro pedido no iMenu durante o período selecionado. A média divide esse total pelos dias do período." />
                    <MetricCard inlineChange truncateTitle title="Assinaturas iMenu Plus"
                        value={formatCount(data.productOverview.ia_plus.buyers)}
                        change={change(data.productOverview.ia_plus.buyers, data.acquisitions.previous.subscriptions)}
                        info="Contas com a primeira compra confirmada de iMenu Plus neste período. Renovações não entram." />
                    <MetricCard inlineChange truncateTitle title="Registros"
                        value={formatCount(data.acquisitions.registrations.reduce((sum, point) => sum + point.value, 0))}
                        change={change(data.acquisitions.registrations.reduce((sum, point) => sum + point.value, 0), data.acquisitions.previous.registrations)}
                        info="Novas contas cadastradas no iMenu durante o período selecionado." />
                    <MetricCard inlineChange truncateTitle title="Usuários ativos"
                        value={formatCount(data.cards.activeUsers)}
                        change={data.cardChanges.activeUsers}
                        info="Contas com pedidos concluídos em pelo menos 2 dias dos últimos 30 dias e em pelo menos 1 dia dos últimos 14 dias." />
                    <MetricCard inlineChange truncateTitle title="Usuários com clientes ativos"
                        value={formatCount(data.cards.activeCustomerUsers)}
                        change={data.cardChanges.activeCustomerUsers}
                        info="Contas com pelo menos 4 pedidos concluídos para 4 clientes distintos nos últimos 30 dias." />
                    <MetricCard inlineChange truncateTitle title="Dinheiro movimentado"
                        value={formatCurrencyFromCents(data.cards.moneyHandledCents)}
                        change={data.cardChanges.moneyHandledCents}
                        info="Soma dos pedidos movimentados no iMenu durante o período, excluindo cancelados e pagamentos online pendentes." />
                    <MetricCard inlineChange truncateTitle title="Dinheiro movimentado online"
                        value={formatCurrencyFromCents(data.cards.onlineMoneyHandledCents)}
                        change={data.cardChanges.onlineMoneyHandledCents}
                        info="Valor movimentado em pedidos pagos por Pix online no período selecionado." />
                </div>
            </section>
            <ProductOverviewSections metrics={data.productOverview} previousMetrics={data.previousProductOverview}
                productsOnly={["imenu", "ia_plus"]} compact />
            <div className={`${styles.section} ${styles.chartGrid} ${styles.analyticsCharts}`}>
                <MetricChart embedded title="Usuários ativados / dia" series={data.series.activatedUsersPerDay} color="#d93d00" decimal />
                <MetricChart embedded title="Assinaturas iMenu Plus" series={data.acquisitions.subscriptions} color="#d93d00" />
                <MetricChart embedded title="Registros" series={data.acquisitions.registrations} color="#2563eb" />
                <MetricChart embedded title="Usuários ativos" series={data.series.activeUsers} color="#16a34a" />
                <MetricChart embedded title="Usuários com clientes ativos" series={data.series.activeCustomerUsers} color="#9333ea" />
                <MetricChart embedded title="Dinheiro movimentado" series={data.series.moneyHandledCents} color="#1d1d1d" currency />
                <MetricChart embedded title="Dinheiro movimentado online" series={data.series.onlineMoneyHandledCents} color="#0891b2" currency />
            </div>
        </>}
    </>;
}
