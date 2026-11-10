"use client";

import styles from "./dashboard.module.css";
import DataTable from "@/components/ui/DataTable";
import { CHART_CATEGORY_AXIS, CHART_VALUE_AXIS, STANDARD_CHART_TOOLTIP, createBrandAreaGradient } from "@/components/restaurant-owner/exibicoes/chartStyles";
import { Chart as ChartJS, Filler } from "chart.js";
import { Line } from "react-chartjs-2";
import type { ReactNode } from "react";
import type { ProductOverview } from "@/lib/analytics/productOverview";
import { formatAverage, formatCount, formatCurrency, formatRatio, conversion } from "@/lib/dev/dashboardFormat";
import InfoTooltip from "@/components/ui/Tooltip";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";

type SeriesPoint = { label: string; value: number };
ChartJS.register(Filler);

export function lineOptions(
    currency = false,
    percentage = false,
    decimal = false,
    showLegend = false
) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        animation: false as const,
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
            legend: { display: showLegend },
            tooltip: { ...STANDARD_CHART_TOOLTIP,
                callbacks: {
                    label: (context: any) => {
                        const value = Number(context.parsed.y) || 0;
                        if (percentage) return formatRatio(value);
                        if (decimal) return formatAverage(value);
                        return currency ? formatCurrency(value) : formatCount(value);
                    },
                },
            },
        },
        scales: {
            x: {
                ...CHART_CATEGORY_AXIS,
                ticks: { ...CHART_CATEGORY_AXIS.ticks, maxTicksLimit: 4 },
            },
            y: {
                ...CHART_VALUE_AXIS,
                ...(percentage ? { max: 100 } : {}),
                ticks: {
                    ...CHART_VALUE_AXIS.ticks,
                    maxTicksLimit: 4,
                    precision: percentage || decimal ? 1 : 0,
                    callback: (value: string | number) => {
                        const numericValue = Number(value) || 0;
                        if (percentage) return formatRatio(numericValue);
                        if (decimal) return formatAverage(numericValue);
                        return currency
                            ? formatCurrency(numericValue)
                            : formatCount(numericValue);
                    },
                },
            },
        },
    };
}

export function SectionHeading({
    title,
    description,
}: {
    title: string;
    description?: string;
}) {
    return (
        <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            {description && <p className="mt-1 text-sm text-gray-500">{description}</p>}
        </div>
    );
}

export function QrTableFunnelCard({
    title,
    description,
    steps,
}: {
    title: string;
    description?: string;
    steps: Array<{
        label: string;
        value: number | null;
        info?: string;
        conversionBase?: number | null;
        conversionLabel?: string;
    }>;
}) {
    return (
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="font-semibold text-gray-900">{title}</h3>
            {description && <p className="mt-1 text-xs leading-5 text-gray-500">{description}</p>}
            <div className="mt-4 grid gap-3">
                {steps.map((step, index) => {
                    const previous =
                        step.conversionBase !== undefined
                            ? step.conversionBase
                            : index > 0
                              ? steps[index - 1].value
                              : null;
                    const stepConversion = index > 0
                        ? conversion(step.value, previous)
                        : null;
                    const conversionText = step.conversionLabel || "do passo anterior";

                    return (
                        <div
                            key={step.label}
                            className="flex items-center justify-between gap-4 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3"
                        >
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-sm font-medium text-gray-700">{step.label}</p>
                                    {step.info && <InfoTooltip text={step.info} showOnClick>
                                        <button type="button" aria-label={"Sobre " + step.label} className="text-gray-400 hover:text-gray-600">
                                            <PanelIcon icon={faCircleInfo} className="text-xs" />
                                        </button>
                                    </InfoTooltip>}
                                </div>
                                {index > 0 && (
                                    <p className="mt-0.5 text-xs text-gray-500">
                                        {stepConversion === null
                                            ? "Conversão indisponível"
                                            : `${formatRatio(stepConversion)} ${conversionText}`}
                                    </p>
                                )}
                            </div>
                            <span className="text-2xl font-bold tabular-nums text-gray-950">
                                {step.value === null ? "—" : formatCount(step.value)}
                            </span>
                        </div>
                    );
                })}
            </div>
        </article>
    );
}

export function qrTableSourceLabel(source: string | null): string {
    if (source === "onboarding") return "Onboarding";
    if (source === "mesas") return "Mesas";
    if (source === "settings") return "Configurações";
    return "—";
}

export function qrTableStatusLabel(status: string): string {
    if (status === "active") return "Ativo";
    if (status === "canceled") return "Cancelado (com acesso)";
    if (status === "past_due") return "Pendente (com acesso)";
    return status;
}

export function ProductOverviewSections({ metrics, previousMetrics, productsOnly, compact = false }: { metrics: ProductOverview; previousMetrics?: ProductOverview; productsOnly?: (keyof ProductOverview)[]; compact?: boolean }) {
    const products = [
        { key: "imenu", name: "iMenu", paths: "/", price: "-", priceInfo: "Referência do dashboard: sem mensalidade.", },
        { key: "ia_plus", name: "iMenu Plus", paths: "Modal de venda + Planos + Limite IA + Vendas IA + Marketing", price: "R$ 49,99/m", priceInfo: "Marketing, Assistente IA e Vendas IA.", },
        { key: "qr_code_mesa", name: "iMenu QR", paths: "/painel/mesas", price: "Grátis", priceInfo: "QR Code Mesa gratuito; pagamentos antigos são apenas históricos.", },
    ] as const;
    const difference = (current: number | null | undefined, previous: number | null | undefined, rate = false) => {
        if (current == null || previous == null) return {};
        if (previous === 0) return current === 0
            ? { change: 0 }
            : { change: current, changeLabel: rate ? `+${formatRatio(current)} pp` : `+${formatCount(current)}` };
        return { change: (current - previous) / previous * 100 };
    };
    if (compact) return (
        <div className="grid gap-5">
            {products.filter(p => !productsOnly || productsOnly.includes(p.key)).map(product => {
                const metric = metrics[product.key];
                const previous = previousMetrics?.[product.key];
                const sameTrafficSource = previous?.trafficSource === metric.trafficSource;
                const trafficUnit = metric.trafficSource === "plus_exposures" ? "Usuários únicos (7 dias)" : metric.trafficSource === "pageviews" ? "Views (Unique)" : "Aberturas da aba";
                const trafficInfo = metric.trafficSource === "plus_exposures"
                    ? "PostHog · Exposição visível em: modal de venda do iMenu Plus, cartão do Plus em Planos, aviso de limite gratuito do Assistente IA, seção Vendas IA e página Marketing. Cada usuário autenticado conta uma vez entre os cinco pontos a cada 7 dias; após 7 dias, pode contar novamente. Histórico disponível a partir da implantação."
                    : metric.trafficSource === "pageviews"
                        ? `PostHog · ${product.key === "imenu" ? "Página inicial" : "Página Mesas"}. Uma visita por pessoa a cada 7 dias; após 7 dias, conta novamente.`
                        : "PostHog · Aberturas de abas; não são visitantes únicos.";
                const buyerLabel = product.key === "imenu" ? "Usuários ativados" : "Compradores";
                return <section key={product.key} aria-label={product.name} className="space-y-3">
                    <h2 className="text-base font-semibold text-gray-900">{product.name}</h2>
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                        <MetricCard inlineChange truncateTitle title={product.key === "ia_plus" ? "Exposições ao Plus" : "Tráfego"}
                            value={metric.pageViews === null ? "—" : formatCount(metric.pageViews)}
                            description={product.key === "ia_plus" ? "Modal · Planos · Limite IA · Vendas IA · Marketing" : trafficUnit}
                            info={trafficInfo}
                            {...(sameTrafficSource ? difference(metric.pageViews, previous?.pageViews) : {})} />
                        <MetricCard inlineChange truncateTitle title="Conversão"
                            value={metric.conversion === null ? "—" : formatRatio(metric.conversion)}
                            description={`${formatCount(metric.buyers)} ${buyerLabel.toLowerCase()} · ${trafficUnit}`}
                            {...(sameTrafficSource
                                ? previous?.conversion == null
                                    ? difference(metric.buyers, previous?.buyers)
                                    : difference(metric.conversion, previous.conversion, true)
                                : {})}
                            info={product.key === "imenu"
                                ? "Contas com primeiro pedido ÷ tráfego do período."
                                : "Primeiras compras confirmadas do Plus ÷ tráfego do período."} />
                        <MetricCard inlineChange truncateTitle title="Mensalidade"
                            value={product.price === "-" ? "Gratuito" : product.price}
                            info={product.priceInfo} />
                        <MetricCard inlineChange truncateTitle title="Churn"
                            value={metric.churn === null ? "—" : formatRatio(metric.churn)}
                            description={`${formatCount(Math.max(0, metric.churnBase - metric.churnedUsers))} ativos · ${formatCount(metric.churnedUsers)} abandonados`}
                            {...(previous?.churn == null
                                ? difference(metric.churnedUsers, previous?.churnedUsers)
                                : difference(metric.churn, previous.churn, true))}
                            reverseChangeColors
                            info={product.key === "imenu"
                                ? "Contas com pedidos em 2 dias do último mês, mas sem pedidos há 14 dias."
                                : "Pagantes no início que perderam acesso ao Plus até o fim do período."} />
                    </div>
                </section>;
            })}
        </div>
    );
    return (
        <>
            {(productsOnly ? productsOnly.map(key => products.find(product => product.key === key)!) : products).map((product) => {
                const metric = metrics[product.key];
                const views = metric.pageViews === null ? "—" : formatCount(metric.pageViews);
                const trafficUnit = metric.trafficSource === "plus_exposures" ? "exposições únicas" : metric.trafficSource === "tab_opens" ? "aberturas da aba" : "visitas únicas";
                const buyers = formatCount(metric.buyers);
                const churned = formatCount(metric.churnedUsers);
                const base = formatCount(metric.churnBase);
                return (
                    <section key={product.key}>
                        <SectionHeading title={product.name} />
                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                            <MetricCard
                                title={`Traffic (${trafficUnit})`}
                                value={views}
                                info={metric.trafficSource === "tab_opens"
                                    ? `PostHog · panel_tab_opened · ${views} aberturas no período; sem visitas de página registradas.`
                                    : metric.trafficSource === "plus_exposures"
                                        ? `PostHog · ${product.paths} · ${views} usuários expostos; deduplicação de 7 dias.`
                                        : `PostHog · ${product.paths} · ${views} visitantes únicos (distinct_id) no período.`}
                            />
                            <MetricCard
                                title={product.key === "imenu" ? "Conversion (usuários ativados)" : "Conversion (compradores)"}
                                value={metric.conversion === null ? "—" : formatRatio(metric.conversion)}
                                info={product.key === "imenu"
                                    ? `${buyers} ativados ÷ ${views} visitas × 100. Pedidos + PostHog · primeiro pedido no período.`
                                    : `${buyers} novos compradores ÷ ${views} ${trafficUnit} × 100. Pagamentos confirmados + PostHog · primeira compra no período.`}
                            />
                            <MetricCard title="Pricing (mensalidade)" value={product.price} info={product.priceInfo} />
                            <MetricCard
                                title={product.key === "imenu" ? "Churn (ativos abandonados)" : "Churn (pagantes perdidos)"}
                                value={metric.churn === null ? "—" : formatRatio(metric.churn)}
                                info={product.key === "imenu"
                                    ? `Pedidos · ${churned} ÷ ${base} × 100. Base: pelo menos 2 dias com pedidos concluídos nos últimos 30 dias; abandono: nenhum dia com pedido concluído nos últimos 14 dias.`
                                    : `Pagamentos/add-ons · ${churned} ÷ ${base} × 100. Base: pagantes no início. Cartão: cancelamento/vencimento; Pix pré-pago: fim da validade.`}
                            />
                        </div>
                    </section>
                );
            })}
        </>
    );
}

export function MetricCard({
    title,
    value,
    change,
    changeLabel,
    description,
    info,
    children,
    danger = false,
    reverseChangeColors = false,
    inlineChange = false,
    truncateTitle = false,
}: {
    title: string;
    value: string;
    change?: number | null;
    changeLabel?: string;
    description?: string;
    info?: string;
    children?: ReactNode;
    danger?: boolean;
    reverseChangeColors?: boolean;
    inlineChange?: boolean;
    truncateTitle?: boolean;
}) {
    const changeColor = change === null
        ? "text-gray-500"
        : (reverseChangeColors ? (change ?? 0) <= 0 : (change ?? 0) >= 0)
            ? "text-green-600"
            : "text-red-600";
    return (
        <article
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
                danger ? "border-red-200" : "border-gray-200"
            }`}
        >
            {info ? (
                <div className="flex min-w-0 items-center justify-between gap-2">
                    <p className={`text-sm font-medium text-gray-600 ${truncateTitle ? "min-w-0 flex-1 truncate whitespace-nowrap" : ""}`} title={truncateTitle ? title : undefined}>{title}</p>
                    <InfoTooltip text={info} size="medium" showOnClick>
                        <button type="button" aria-label={`Informações sobre ${title}`} className="inline-flex h-6 w-6 items-center justify-center text-gray-400 hover:text-brand">
                            <PanelIcon icon={faCircleInfo} className="h-3.5 w-3.5" />
                        </button>
                    </InfoTooltip>
                </div>
            ) : (
                <p className={`text-sm font-medium text-gray-600 ${truncateTitle ? "truncate whitespace-nowrap" : ""}`} title={truncateTitle ? title : undefined}>{title}</p>
            )}
            {inlineChange ? <div className="mt-2 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-1">
                <p className={`min-w-0 text-3xl font-bold tracking-tight tabular-nums ${danger ? "text-red-700" : "text-gray-950"}`}>{value}</p>
                {change != null && <span className={`shrink-0 whitespace-nowrap text-sm font-semibold tabular-nums ${changeColor}`}>
                    {changeLabel ?? `${change >= 0 ? "+" : ""}${formatRatio(change)}`}
                </span>}
            </div> : <>
            <p
                className={`mt-2 text-3xl font-bold tracking-tight ${
                    danger ? "text-red-700" : "text-gray-950"
                }`}
            >
                {value}
            </p>
            {change !== undefined && (
                <p
                    className={`mt-1 text-sm font-semibold ${
                        change === null
                            ? "text-gray-500"
                            : (reverseChangeColors ? change <= 0 : change >= 0)
                              ? "text-green-600"
                              : "text-red-600"
                    }`}
                >
                    {change === null
                        ? "—"
                        : `${change >= 0 ? "+" : ""}${formatRatio(change)}`} {" "}
                    <span className="font-normal text-gray-500">vs. período anterior</span>
                </p>
            )}
            </>}
            {description && <p className="mt-3 text-xs leading-5 text-gray-500">{description}</p>}
            {children}
        </article>
    );
}

export function MetricChart({
    title,
    series,
    color,
    currency = false,
    percentage = false,
    decimal = false,
    seriesLabel,
    secondarySeries,
    secondaryLabel,
    secondaryColor,
    actionLabel,
    onAction, embedded = false, value, change,
}: { embedded?: boolean; value?: string; change?: number | null;
    title: string;
    series: SeriesPoint[];
    color: string;
    currency?: boolean;
    percentage?: boolean;
    decimal?: boolean;
    seriesLabel?: string;
    secondarySeries?: SeriesPoint[];
    secondaryLabel?: string;
    secondaryColor?: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    const chartData = {
        labels: (series.length ? series : secondarySeries || []).map(
            (point) => point.label
        ),
        datasets: [
            {
                label: seriesLabel || title,
                data: series.map((point) =>
                    currency ? point.value / 100 : point.value
                ),
                borderColor: color,
                backgroundColor: secondarySeries?.length ? color : color === "#d93d00" ? createBrandAreaGradient : `${color}12`,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 5,
                tension: 0.25,
                fill: !secondarySeries?.length,
            },
            ...(secondarySeries && secondaryLabel && secondaryColor
                ? [
                      {
                          label: secondaryLabel,
                          data: secondarySeries.map((point) => point.value),
                          borderColor: secondaryColor,
                          backgroundColor: secondaryColor,
                          pointRadius: 2,
                          pointHoverRadius: 5,
                          tension: 0.3,
                          fill: false,
                      },
                  ]
                : []),
        ],
    };

    return (
        <article className={embedded ? styles.chartEmbedded : styles.chart}>
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-sm font-medium text-gray-600">{title}</h3>
                {actionLabel && onAction && (
                    <button
                        type="button"
                        onClick={onAction}
                        className="shrink-0 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
                    >
                        {actionLabel}
                    </button>
                )}
            </div>
            {value !== undefined && <div className="mt-3 flex items-baseline gap-3"><p className="text-2xl font-semibold tabular-nums">{value}</p>{change !== undefined && <InfoTooltip text="Variação em relação ao período anterior." showOnClick><span className={`text-xs font-medium ${change == null ? "text-gray-500" : change>=0 ? "text-green-700" : "text-red-700"}`}>{change == null ? "Sem base" : `${change>=0?"+":""}${formatRatio(change)}`}</span></InfoTooltip>}</div>}
            <div className={styles.chartCanvas}>
                {series.length || secondarySeries?.length ? (
                    <Line
                        data={chartData}
                        options={lineOptions(
                            currency,
                            percentage,
                            decimal,
                            Boolean(secondarySeries?.length)
                        )}
                    />
                ) : (
                    <EmptyChart />
                )}
            </div>
        </article>
    );
}

export function EmptyChart() {
    return (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Nenhum dado no período.
        </div>
    );
}

export function DashboardLoading() {
    return (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: 6 }, (_, index) => (
                <div
                    key={index}
                    className="h-40 animate-pulse rounded-2xl border border-gray-200 bg-white"
                />
            ))}
        </div>
    );
}

export function CenteredMessage({
    title,
    description,
    actionLabel,
    onAction,
}: {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <main className="flex min-h-screen items-center justify-center bg-gray-50 p-6">
            <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
                <h1 className="text-xl font-semibold text-gray-900">{title}</h1>
                {description && (
                    <p className="mt-2 text-sm text-gray-500">{description}</p>
                )}
                {actionLabel && onAction && (
                    <button
                        type="button"
                        onClick={onAction}
                        className="mt-6 rounded-lg bg-brand px-5 py-2.5 text-sm font-medium text-white"
                    >
                        {actionLabel}
                    </button>
                )}
            </div>
        </main>
    );
}
