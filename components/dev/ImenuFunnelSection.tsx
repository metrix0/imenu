"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import { conversion, formatCount, formatRatio } from "@/lib/dev/dashboardFormat";
import { MetricCard } from "./DashboardPresentation";
import DevLoading from "./DevLoading";

type Counts = {
    visitors: number | null;
    signupPage: number | null;
    registered: number;
    restaurants: number;
    cardapio: number;
    horarios: number;
    loja: number;
    finished: number;
    items: number;
    firstOrder: number;
    active: number;
};
type Funnel = Counts & { previous: Counts };
type Step = { key: keyof Counts; base?: keyof Counts; title: string; unit?: string; info: string };

const STEPS: Step[] = [
    {
        key: "visitors", title: "Visitantes iMenu",
        info: "Visitantes únicos de páginas próprias do iMenu, no PostHog. Exclui cardápios de restaurantes e o painel. A contagem pode ser menor que a real por bloqueios de rastreamento.",
    },
    {
        key: "signupPage", base: "visitors", title: "Página de cadastro", unit: "visitantes",
        info: "Pessoas que abriram /restaurante/registrar ÷ visitantes iMenu. Origem: PostHog; não representa necessariamente o início do formulário.",
    },
    {
        key: "registered", title: "Registros",
        info: "Novos usuários não anônimos em auth.users, criados no período. Esta contagem não é dividida pelas visitas ao cadastro: PostHog e banco não possuem identidade vinculada e nem todos os cadastros geram pageview.",
    },
    {
        key: "restaurants", base: "registered", title: "Restaurante criado", unit: "contas",
        info: "Contas cadastradas no período que já possuem um restaurante. Esta e as demais etapas de configuração são avaliadas pelo estado atual da coorte.",
    },
    {
        key: "cardapio", base: "restaurants", title: "Etapa Cardápio", unit: "contas",
        info: "Contas da coorte que avançaram da etapa Cardápio (etapa 1/4): creation_step >= 2 ou primeiro acesso já concluído.",
    },
    {
        key: "horarios", base: "cardapio", title: "Etapa Horários", unit: "contas",
        info: "Contas da coorte que avançaram da etapa Horários (etapa 2/4): creation_step >= 3 ou primeiro acesso já concluído. Pular horários também avança a etapa.",
    },
    {
        key: "loja", base: "horarios", title: "Etapa Loja", unit: "contas",
        info: "Contas da coorte que avançaram da etapa Loja (etapa 3/4): creation_step >= 4 ou primeiro acesso já concluído.",
    },
    {
        key: "finished", base: "loja", title: "Cadastro finalizado", unit: "contas",
        info: "Contas da coorte com first_time = false, após a etapa Localização (4/4).",
    },
    {
        key: "items", base: "finished", title: "Com produtos", unit: "contas",
        info: "Contas da coorte com ao menos um produto em items. Podem cadastrar produtos antes de finalizar a configuração, portanto a passagem desde a etapa anterior é indicativa.",
    },
    {
        key: "firstOrder", base: "items", title: "Receberam pedido", unit: "contas",
        info: "Contas da coorte que já receberam pelo menos um pedido não cancelado nem pendente de pagamento online. Não inclui pedidos apenas simulados pelo evento de visita.",
    },
    {
        key: "active", base: "firstOrder", title: "Usuários ativos", unit: "contas",
        info: "Contas da coorte com pedidos concluídos em ao menos 2 dias dos últimos 30 e 1 dia dos últimos 14, a mesma definição de usuários ativos do dashboard. Coortes antigas tiveram mais tempo para amadurecer.",
    },
];

function periodChange(current: number | null, previous: number | null) {
    if (current === null || previous === null) return {};
    if (previous === 0) return current === 0 ? { change: 0 } : { change: 0, changeLabel: "Novo" };
    return { change: (current - previous) / previous * 100 };
}

export default function ImenuFunnelSection({ range }: { range: DateRange }) {
    const [data, setData] = useState<Funnel | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
        void devJson<Funnel>("/api/dev/imenu-funnel?" + params, { signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) setData(result); })
            .catch(err => { if (!controller.signal.aborted) { setError(err.message); setData(null); } })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [range.startDate, range.endDate]);

    const raw = (value: number | null | undefined) => value == null ? "—" : formatCount(value);
    return <section aria-label="Funil iMenu" className="min-w-0">
        <h2 className="mb-4 text-base font-semibold text-gray-900">Funil iMenu</h2>
        {error && <p role="alert" className="mb-3 text-sm text-red-700">{error}</p>}
        {loading ? <DevLoading /> : !error && <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {STEPS.map(step => {
                const current = data?.[step.key] ?? null;
                const prior = data?.previous?.[step.key] ?? null;
                const currentRate = step.base ? conversion(current, data?.[step.base] ?? null) : current;
                const priorRate = step.base ? conversion(prior, data?.previous?.[step.base] ?? null) : prior;
                return <MetricCard key={step.key} inlineChange truncateTitle
                    title={step.title}
                    value={step.base ? currentRate === null ? "—" : formatRatio(currentRate) : raw(current)}
                    description={step.base && current !== null ? raw(current) + " " + step.unit : undefined}
                    {...periodChange(currentRate, priorRate)}
                    info={step.info} />;
            })}
        </div>}
    </section>;
}
