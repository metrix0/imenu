"use client";
import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import DevLoading from "./DevLoading";
import { QrTableFunnelCard } from "./DashboardPresentation";

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
    if (loading) return <DevLoading />;
    return <section aria-label="Funil iMenu Plus" className="min-w-0">
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        <QrTableFunnelCard
            title="Funil iMenu Plus"
            description="Totais do período. As taxas entre etapas são indicativas, não uma sequência individual comprovada."
            steps={[
                {
                    label: "Usuários no painel", value: data?.panelUsers ?? null,
                    info: "Contas distintas que abriram ou navegaram no painel. A medição completa começa após a implantação; períodos anteriores podem subcontar acessos diretos.",
                },
                {
                    label: "Tráfego (sem modal)", value: data?.traffic ?? null,
                    info: "Exposições visíveis em Planos, limite do Assistente IA, Vendas IA e Marketing. Exclui o modal de venda. Mesma deduplicação de 7 dias de Exposições ao Plus; a conta pode contar novamente após 7 dias.",
                    conversionLabel: "sobre os usuários do painel · indicativo",
                },
                {
                    label: "Checkout", value: data?.checkout ?? null,
                    info: "Contas distintas que abriram o formulário de pagamento do Plus, sem renovações. Histórico após implantação.",
                    conversionLabel: "sobre o tráfego · indicativo",
                },
                {
                    label: "Compraram", value: data?.bought ?? null,
                    info: "Contas com primeira compra confirmada desde o lançamento em 28/10/2026, usando pagamentos registrados. Não inclui renovações nem pagamentos antigos do IA Plus.",
                    conversionLabel: "sobre os checkouts · indicativo",
                },
            ]}
        />
    </section>;
}
