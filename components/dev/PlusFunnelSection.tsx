"use client";
import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import DevLoading from "./DevLoading";
import { MetricCard, PlusExposureMetricCard, type PlusExposureBreakdown } from "./DashboardPresentation";
import { conversion, formatCount, formatRatio } from "@/lib/dev/dashboardFormat";

type FunnelCounts = {
    panelUsers: number | null;
    exposures: number | null;
    modalViews: number | null;
    checkout: number | null;
    bought: number | null;
    sources: Record<string, number> | null;
};
type PlusFunnel = FunnelCounts & { previous: FunnelCounts };
function percentage(value: number | null | undefined, base: number | null | undefined): number | null {
    return conversion(value ?? null, base ?? null);
}
function periodChange(current: number | null, previous: number | null) {
    if (current == null || previous == null) return {};
    if (previous === 0) return current === 0 ? { change: 0 } : { changeLabel: "Novo" };
    return { change: (current - previous) / previous * 100 };
}

export default function PlusFunnelSection({ range, onDataLoaded }: { range: DateRange; onDataLoaded?: (breakdown: PlusExposureBreakdown) => void }) {
    const [data, setData] = useState<PlusFunnel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
        void devJson<PlusFunnel>("/api/dev/plus-funnel?" + params, { signal: controller.signal })
            .then(result => {
                if (controller.signal.aborted) return;
                setData(result);
                setError("");
                onDataLoaded?.({ exposures: result.exposures, sources: result.sources });
            })
            .catch(err => { if (!controller.signal.aborted) { setError(err.message); setData(null); } })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [range.startDate, range.endDate, onDataLoaded]);

    const prior = data?.previous;
    const exposureRate = percentage(data?.exposures, data?.panelUsers);
    const modalRate = percentage(data?.modalViews, data?.exposures);
    const checkoutRate = percentage(data?.checkout, data?.modalViews);
    const purchaseRate = percentage(data?.bought, data?.checkout);
    const raw = (value: number | null | undefined) => value == null ? "—" : formatCount(value);

    return <section aria-label="Funil iMenu Plus" className="min-w-0">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Funil iMenu Plus</h2>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {loading ? <DevLoading /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard inlineChange truncateTitle title="Usuários no painel"
                value={raw(data?.panelUsers)}
                description={raw(data?.panelUsers) + " usuários no período"}
                {...periodChange(data?.panelUsers ?? null, prior?.panelUsers ?? null)}
                info="Contas distintas que acessaram ou navegaram no painel no período, medidas por eventos PostHog. Antes da instrumentação, visitas diretas podem estar subcontadas." />
            <PlusExposureMetricCard title="Exposições ao Plus"
                value={exposureRate === null ? "—" : formatRatio(exposureRate)}
                description={raw(data?.exposures) + " exposições · " + raw(data?.panelUsers) + " usuários no painel"}
                {...periodChange(exposureRate, percentage(prior?.exposures, prior?.panelUsers))}
                exposureData={data ? { exposures: data.exposures, sources: data.sources } : null}
                info="Exposições ao Plus ÷ usuários no painel. Inclui modal de venda, Planos, limite IA, Vendas IA e Marketing. Antes de 10/11, os dados usam pageviews históricos estimados, sem origem detalhada. Uma pessoa pode contar novamente após 7 dias." />
            <MetricCard inlineChange truncateTitle title="Visualizações do modal"
                value={modalRate === null ? "—" : formatRatio(modalRate)}
                description={raw(data?.modalViews) + " visualizações · " + raw(data?.exposures) + " exposições"}
                {...periodChange(modalRate, percentage(prior?.modalViews, prior?.exposures))}
                info="Usuários que viram o modal de venda do Plus ÷ exposições ao Plus. Medição disponível desde a instrumentação de 10/11; as exposições históricas não incluem visualizações antigas de modal. Deduplicação por pessoa a cada 7 dias." />
            <MetricCard inlineChange truncateTitle title="Checkout"
                value={checkoutRate === null ? "—" : formatRatio(checkoutRate)}
                description={raw(data?.checkout) + " checkouts · " + raw(data?.modalViews) + " visualizações do modal"}
                {...periodChange(checkoutRate, percentage(prior?.checkout, prior?.modalViews))}
                info="Contas que abriram checkout ÷ visualizações registradas do modal de venda. Checkouts que não passaram pelo modal ou anteriores à instrumentação podem fazer a conversão parecer maior que 100%." />
            <MetricCard inlineChange truncateTitle title="Compraram"
                value={purchaseRate === null ? "—" : formatRatio(purchaseRate)}
                description={raw(data?.bought) + " compradores · " + raw(data?.checkout) + " checkouts"}
                {...periodChange(purchaseRate, percentage(prior?.bought, prior?.checkout))}
                info="Primeiras compras confirmadas de Plus ÷ contas que abriram checkout. Exclui renovações e pagamentos antigos do IA Plus. Compras anteriores ao rastreamento do checkout podem aparecer sem abertura medida." />
        </div>}
    </section>;
}
