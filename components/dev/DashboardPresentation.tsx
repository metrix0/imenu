"use client";

import { Line } from "react-chartjs-2";
import type { ReactNode } from "react";
import type { ProductOverview } from "@/lib/analytics/productOverview";
import { formatAverage, formatCount, formatCurrency, formatRatio, conversion } from "@/lib/dev/dashboardFormat";
import InfoTooltip from "@/components/ui/Tooltip";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";

type SeriesPoint = { label: string; value: number };

export function lineOptions(
    currency = false,
    percentage = false,
    decimal = false,
    showLegend = false
) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
            legend: { display: showLegend },
            tooltip: {
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
                grid: { display: false },
                ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 10 },
            },
            y: {
                beginAtZero: true,
                ...(percentage ? { max: 100 } : {}),
                ticks: {
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
    steps,
}: {
    title: string;
    steps: Array<{
        label: string;
        value: number | null;
        conversionBase?: number | null;
        conversionLabel?: string;
    }>;
}) {
    return (
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="font-semibold text-gray-900">{title}</h3>
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
                                <p className="text-sm font-medium text-gray-700">
                                    {step.label}
                                </p>
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

export function ProductOverviewSections({ metrics }: { metrics: ProductOverview }) {
    const products = [
        { key: "imenu", name: "iMenu", paths: "/", price: "-", priceInfo: "Referência do dashboard: sem mensalidade.", },
        { key: "ia_plus", name: "iMenu Plus", paths: "/painel/marketing + /painel/vendas-ia + /painel/assistente-ia + /painel/mesas", price: "R$ 49,99/m", priceInfo: "Inclui iMenu QR Code.", },
        { key: "qr_code_mesa", name: "iMenu QR", paths: "/painel/mesas", price: "R$ 5/m", priceInfo: "Preço de referência: 500 centavos/mês.", },
    ] as const;
    return (
        <>
            {products.map((product) => {
                const metric = metrics[product.key];
                const views = metric.pageViews === null ? "—" : formatCount(metric.pageViews);
                const trafficUnit = metric.trafficSource === "tab_opens" ? "aberturas da aba" : "page views";
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
                                    ? `PostHog · panel_tab_opened · ${views} aberturas no período; sem page views registradas.`
                                    : `PostHog · ${product.paths} · ${views} pageviews no período.`}
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
    description,
    info,
    children,
    danger = false,
}: {
    title: string;
    value: string;
    change?: number | null;
    description?: string;
    info?: string;
    children?: ReactNode;
    danger?: boolean;
}) {
    return (
        <article
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
                danger ? "border-red-200" : "border-gray-200"
            }`}
        >
            {info ? (
                <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-medium text-gray-600">{title}</p>
                    <InfoTooltip text={info} size="medium" showOnClick>
                        <button type="button" aria-label={`Informações sobre ${title}`} className="inline-flex h-6 w-6 items-center justify-center text-gray-400 hover:text-brand">
                            <PanelIcon icon={faCircleInfo} className="h-3.5 w-3.5" />
                        </button>
                    </InfoTooltip>
                </div>
            ) : (
                <p className="text-sm font-medium text-gray-600">{title}</p>
            )}
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
                            : change >= 0
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
    onAction,
}: {
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
                backgroundColor: color,
                pointRadius: 2,
                pointHoverRadius: 5,
                tension: 0.3,
                fill: false,
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
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-semibold text-gray-900">{title}</h3>
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
            <div className="mt-4 h-[280px]">
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
