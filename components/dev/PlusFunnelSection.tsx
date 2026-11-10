"use client";
import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import DevLoading from "./DevLoading";
import { MetricCard } from "./DashboardPresentation";
import { conversion, formatCount, formatRatio } from "@/lib/dev/dashboardFormat";

type PlusFunnel = { panelUsers: number | null; traffic: number | null; checkout: number | null; bought: number | null };

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

    const percentage = (value: number | null | undefined, base: number | null | undefined) => {
        const rate = conversion(value ?? null, base ?? null);
        return rate === null ? "—" : formatRatio(rate);
    };

    return <section aria-label="Funil iMenu Plus" className="min-w-0">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Funil iMenu Plus</h2>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {loading ? <DevLoading /> : <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard title="Usuários no painel"
                value={data?.panelUsers == null ? "—" : formatCount(data.panelUsers)}
                info="Contas distintas que abriram ou navegaram no painel no período. A medição completa começou após a instrumentação; períodos anteriores podem subcontar visitas diretas." />
            <MetricCard title="Tráfego (sem modal)"
                value={percentage(data?.traffic, data?.panelUsers)}
                info="Exposições em Planos, limite gratuito do Assistente IA, Vendas IA e Marketing, excluindo o modal de venda. Deduplicação a cada 7 dias, igual ao indicador Exposições ao Plus. Percentual sobre usuários no painel (medida indicativa; as bases de contagem são diferentes)." />
            <MetricCard title="Checkout"
                value={percentage(data?.checkout, data?.traffic)}
                info="Contas distintas que abriram o checkout do iMenu Plus, sem renovações. Percentual sobre Tráfego (sem modal). Quem chegou diretamente pelo modal pode não ter sido contabilizado no tráfego; dado disponível após instrumentação." />
            <MetricCard title="Compraram"
                value={percentage(data?.bought, data?.checkout)}
                info="Primeiras compras confirmadas de iMenu Plus no período ÷ contas que abriram checkout. Pagamentos confirmados no banco; exclui renovações e vendas anteriores ao lançamento de 28/10/2026. Compras anteriores à instrumentação podem aparecer sem checkout registrado." />
        </div>}
    </section>;
}
