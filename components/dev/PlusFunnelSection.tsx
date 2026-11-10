"use client";
import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import DevLoading from "./DevLoading";
import { MetricCard } from "./DashboardPresentation";
import { conversion, formatCount, formatRatio } from "@/lib/dev/dashboardFormat";

type FunnelCounts = {
    panelUsers: number | null;
    exposures: number | null;
    traffic: number | null;
    checkout: number | null;
    bought: number | null;
    sources: Record<string, number> | null;
};
type PlusFunnel = FunnelCounts & { previous: FunnelCounts };
const SOURCES = [
    { key: "sales_modal", label: "Modal de venda" },
    { key: "plus_page", label: "Planos" },
    { key: "assistant_limit", label: "Limite Assistente IA" },
    { key: "sales_section", label: "Vendas IA" },
    { key: "marketing_page", label: "Marketing" },
    { key: "legacy_pages", label: "Páginas (histórico)" },
] as const;

function percentage(value: number | null | undefined, base: number | null | undefined): number | null {
    return conversion(value ?? null, base ?? null);
}
function periodChange(current: number | null, previous: number | null) {
    if (current == null || previous == null) return {};
    if (previous === 0) return current === 0 ? { change: 0 } : { changeLabel: "Novo" };
    return { change: (current - previous) / previous * 100 };
}

export default function PlusFunnelSection({ range }: { range: DateRange }) {
    const [data, setData] = useState<PlusFunnel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
        void devJson<PlusFunnel>("/api/dev/plus-funnel?" + params, { signal: controller.signal })
            .then(result => { setData(result); setError(""); })
            .catch(err => { if (!controller.signal.aborted) { setError(err.message); setData(null); } })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [range.startDate, range.endDate]);

    const prior = data?.previous;
    const exposureRate = percentage(data?.exposures, data?.panelUsers);
    const trafficRate = percentage(data?.traffic, data?.exposures);
    const checkoutRate = percentage(data?.checkout, data?.traffic);
    const purchaseRate = percentage(data?.bought, data?.checkout);

    return <section aria-label="Funil iMenu Plus" className="min-w-0">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Funil iMenu Plus</h2>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {loading ? <DevLoading /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
            <MetricCard inlineChange truncateTitle title="Usuários no painel"
                value={data?.panelUsers == null ? "—" : formatCount(data.panelUsers)}
                {...periodChange(data?.panelUsers ?? null, prior?.panelUsers ?? null)}
                info="Contas distintas que acessaram ou navegaram no painel no período, medidas por eventos PostHog. Antes da instrumentação, visitas diretas podem estar subcontadas." />
            <MetricCard inlineChange truncateTitle title="Exposições ao Plus"
                value={exposureRate === null ? "—" : formatRatio(exposureRate)}
                {...periodChange(exposureRate, percentage(prior?.exposures, prior?.panelUsers))}
                info="Contas expostas ao Plus ÷ usuários no painel. Considera modal, Planos, limite IA, Vendas IA e Marketing; deduplicação por 7 dias. Páginas antigas são uma estimativa, sem origem detalhada. Origens não são exclusivas: percentuais podem somar mais de 100%."
            >
                <div className="mt-4 space-y-2.5 border-t border-gray-100 pt-3">
                    {SOURCES.filter(source => source.key !== "legacy_pages" || (data?.sources?.legacy_pages ?? 0) > 0).map(source => {
                        const rate = percentage(data?.sources?.[source.key], data?.exposures);
                        return <div key={source.key} className="flex items-center justify-between gap-2 text-xs">
                            <span className="min-w-0 text-gray-500">{source.label}</span>
                            <span className="shrink-0 font-semibold tabular-nums text-gray-800">
                                {rate === null ? "—" : formatRatio(rate)}
                            </span>
                        </div>;
                    })}
                </div>
            </MetricCard>
            <MetricCard inlineChange truncateTitle title="Tráfego (sem modal)"
                value={trafficRate === null ? "—" : formatRatio(trafficRate)}
                {...periodChange(trafficRate, percentage(prior?.traffic, prior?.exposures))}
                info="Exposições sem o modal de venda ÷ todas as exposições ao Plus. Inclui Planos, limite IA, Vendas IA, Marketing e páginas históricas estimadas. Deduplicação de 7 dias." />
            <MetricCard inlineChange truncateTitle title="Checkout"
                value={checkoutRate === null ? "—" : formatRatio(checkoutRate)}
                {...periodChange(checkoutRate, percentage(prior?.checkout, prior?.traffic))}
                info="Contas que abriram o checkout ÷ tráfego sem modal. Compradores que vieram diretamente pelo modal podem não aparecer na etapa anterior. Comparação indicativa; checkout só é medido desde a implantação." />
            <MetricCard inlineChange truncateTitle title="Compraram"
                value={purchaseRate === null ? "—" : formatRatio(purchaseRate)}
                {...periodChange(purchaseRate, percentage(prior?.bought, prior?.checkout))}
                info="Primeiras compras confirmadas ÷ contas que abriram o checkout. Dados de pagamentos, sem renovações nem compras antigas do IA Plus. Compras anteriores à instrumentação podem não ter checkout registrado." />
        </div>}
    </section>;
}
