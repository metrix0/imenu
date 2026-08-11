"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from "chart.js";
import { Bar, Line } from "react-chartjs-2";

import ConsumerPipelineCard from "@/components/analytics/ConsumerPipelineCard";
import type { ConsumerPipelineStep } from "@/lib/analytics/consumerPipeline";
import { supabase } from "@/lib/database/supabaseClient";

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    BarElement,
    Tooltip,
    Legend
);

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";

type RangeKey = "this_week" | "last_week" | "30d" | "90d";
type AccessState = "checking" | "allowed" | "forbidden" | "signed-out";
type SeriesPoint = { label: string; value: number };
type MetricKey =
    | "activatedUsers"
    | "activeUsers"
    | "realActiveUsers"
    | "activeCustomerUsers"
    | "moneyHandledCents"
    | "onlineMoneyHandledCents"
    | "abandonedActiveUsers"
    | "abandonedActiveCustomerUsers";

type DashboardPayload = {
    range: {
        key: RangeKey;
        startAt: string;
        endAt: string;
        bucket: "day" | "week";
    };
    cards: Record<MetricKey, number>;
    series: Record<MetricKey, SeriesPoint[]>;
    paymentMethods: {
        labels: string[];
        datasets: Array<{
            key: string;
            label: string;
            values: number[];
        }>;
    };
    pipeline: Array<{
        key: string;
        label: string;
        value: number | null;
        conversion: number | null;
        available: boolean;
        note: string | null;
    }>;
    consumerPipeline: ConsumerPipelineStep[];
    consumerTimeline: {
        menuViews: SeriesPoint[];
        cartAdds: SeriesPoint[];
        averageCartCents: SeriesPoint[];
        orders: SeriesPoint[];
    };
    tracking: {
        postHogAvailable: boolean;
        blogViews: number | null;
    };
    generatedAt: string;
};

const RANGE_OPTIONS: Array<{ key: RangeKey; label: string }> = [
    { key: "this_week", label: "Esta semana" },
    { key: "last_week", label: "Semana passada" },
    { key: "30d", label: "Últimos 30 dias" },
    { key: "90d", label: "Últimos 90 dias" },
];

const PAYMENT_COLORS = [
    "#f14400",
    "#1d1d1d",
    "#16a34a",
    "#2563eb",
    "#9333ea",
    "#0891b2",
    "#ca8a04",
];

function formatCount(value: number): string {
    return value.toLocaleString("pt-BR");
}

function formatCurrencyFromCents(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    }).format(value / 100);
}

function formatCurrency(value: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
        maximumFractionDigits: 2,
    }).format(value);
}

function formatDateRange(startAt: string, endAt: string): string {
    const formatter = new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "short",
        year: "numeric",
    });

    return `${formatter.format(new Date(startAt))} – ${formatter.format(
        new Date(Math.max(0, new Date(endAt).getTime() - 1))
    )}`;
}

function lineOptions(currency = false) {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
            legend: { display: false },
            tooltip: {
                callbacks: {
                    label: (context: any) =>
                        currency
                            ? formatCurrency(Number(context.parsed.y) || 0)
                            : formatCount(Number(context.parsed.y) || 0),
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
                ticks: {
                    precision: 0,
                    callback: (value: string | number) =>
                        currency
                            ? formatCurrency(Number(value) || 0)
                            : formatCount(Number(value) || 0),
                },
            },
        },
    };
}

function paymentOptions() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: {
            legend: { position: "bottom" as const },
            tooltip: {
                callbacks: {
                    label: (context: any) =>
                        `${context.dataset.label}: ${formatCurrency(
                            Number(context.parsed.y) || 0
                        )}`,
                },
            },
        },
        scales: {
            x: { stacked: true, grid: { display: false } },
            y: {
                stacked: true,
                beginAtZero: true,
                ticks: {
                    callback: (value: string | number) =>
                        formatCurrency(Number(value) || 0),
                },
            },
        },
    };
}

export default function DevDashboardPage() {
    const router = useRouter();
    const [range, setRange] = useState<RangeKey>("this_week");
    const [accessState, setAccessState] = useState<AccessState>("checking");
    const [data, setData] = useState<DashboardPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        const loadDashboard = async () => {
            setLoading(true);
            setError("");

            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    setAccessState("signed-out");
                    setData(null);
                    return;
                }

                const response = await fetch(`/api/dev/dashboard?range=${range}`, {
                    headers: {
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    cache: "no-store",
                    signal: controller.signal,
                });

                const payload = (await response.json()) as DashboardPayload & {
                    error?: string;
                };

                if (response.status === 401) {
                    setAccessState("signed-out");
                    setData(null);
                    return;
                }

                if (response.status === 403) {
                    setAccessState("forbidden");
                    setData(null);
                    return;
                }

                if (!response.ok) {
                    throw new Error(payload.error || "Erro ao carregar o dashboard.");
                }

                setAccessState("allowed");
                setData(payload);
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === "AbortError") {
                    return;
                }

                setAccessState("allowed");
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Erro ao carregar o dashboard."
                );
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void loadDashboard();
        return () => controller.abort();
    }, [range]);

    const paymentChartData = useMemo(() => {
        if (!data) return { labels: [], datasets: [] };

        return {
            labels: data.paymentMethods.labels,
            datasets: data.paymentMethods.datasets.map((dataset, index) => ({
                label: dataset.label,
                data: dataset.values.map((value) => value / 100),
                backgroundColor: PAYMENT_COLORS[index % PAYMENT_COLORS.length],
                borderWidth: 0,
                borderRadius: 4,
            })),
        };
    }, [data]);

    if (accessState === "checking") {
        return <CenteredMessage title="Carregando dashboard…" />;
    }

    if (accessState === "signed-out") {
        return (
            <CenteredMessage
                title="Faça login primeiro"
                description={`Entre com ${ALLOWED_DEV_EMAIL} para acessar este dashboard.`}
                actionLabel="Ir para o login"
                onAction={() => router.push("/restaurante/login")}
            />
        );
    }

    if (accessState === "forbidden") {
        return (
            <CenteredMessage
                title="Acesso negado"
                description={`Este dashboard está disponível somente para ${ALLOWED_DEV_EMAIL}.`}
            />
        );
    }

    return (
        <main className="min-h-screen bg-gray-50 px-4 py-8 text-gray-900 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1500px] space-y-8">
                <header className="flex flex-col justify-between gap-5 lg:flex-row lg:items-end">
                    <div>
                        <p className="text-sm font-medium text-brand">/dev/dashboard</p>
                        <h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">
                            Dashboard do iMenu
                        </h1>
                        <p className="mt-2 text-sm text-gray-600">
                            Métricas de ativação, uso, volume financeiro e abandono.
                        </p>
                        {data && (
                            <p className="mt-1 text-xs text-gray-500">
                                {formatDateRange(data.range.startAt, data.range.endAt)}
                            </p>
                        )}
                    </div>

                    <div className="flex flex-wrap gap-2 rounded-xl border border-gray-200 bg-white p-2 shadow-sm">
                        {RANGE_OPTIONS.map((option) => (
                            <button
                                key={option.key}
                                type="button"
                                onClick={() => setRange(option.key)}
                                disabled={loading}
                                className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
                                    range === option.key
                                        ? "bg-brand text-white"
                                        : "text-gray-600 hover:bg-gray-100"
                                } disabled:cursor-wait disabled:opacity-60`}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </header>

                {error && (
                    <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                        {error}
                    </div>
                )}

                {loading && !data ? (
                    <DashboardLoading />
                ) : data ? (
                    <>
                        <section>
                            <SectionHeading
                                title="Indicadores principais"
                                description="Cada conta é identificada pelo usuário proprietário do restaurante."
                            />
                            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <MetricCard
                                    title="Usuários ativados"
                                    value={formatCount(data.cards.activatedUsers)}
                                    description="Fizeram o primeiro pedido no período e não tinham nenhum pedido anterior."
                                />
                                <MetricCard
                                    title="Usuários ativos"
                                    value={formatCount(data.cards.activeUsers)}
                                    description="Tiveram pelo menos um pedido concluído nos sete dias anteriores ao fim do período."
                                />
                                <MetricCard
                                    title="Usuários realmente ativos"
                                    value={formatCount(data.cards.realActiveUsers)}
                                    description="Tiveram pedidos concluídos de pelo menos dois clientes diferentes nos últimos sete dias."
                                />
                                <MetricCard
                                    title="Usuários com clientes ativos"
                                    value={formatCount(data.cards.activeCustomerUsers)}
                                    description="Atingiram quatro pedidos válidos de quatro clientes diferentes nos últimos 30 dias."
                                />
                                <MetricCard
                                    title="Dinheiro movimentado"
                                    value={formatCurrencyFromCents(
                                        data.cards.moneyHandledCents
                                    )}
                                    description="Valor dos pedidos válidos, sem cancelados ou Pix online ainda não pagos."
                                />
                                <MetricCard
                                    title="Dinheiro movimentado online"
                                    value={formatCurrencyFromCents(
                                        data.cards.onlineMoneyHandledCents
                                    )}
                                    description="Valor dos pedidos pagos com Pix online."
                                />
                            </div>
                        </section>

                        <section>
                            <SectionHeading
                                title="Evolução dos indicadores"
                                description={`Ativação e valores são agrupados por ${
                                    data.range.bucket === "week" ? "semana" : "dia"
                                }; atividade usa janelas móveis de 7 e 30 dias.`}
                            />
                            <div className="grid gap-5 xl:grid-cols-2">
                                <MetricChart
                                    title="Usuários ativados"
                                    series={data.series.activatedUsers}
                                    color="#f14400"
                                />
                                <MetricChart
                                    title="Usuários ativos"
                                    series={data.series.activeUsers}
                                    color="#16a34a"
                                />
                                <MetricChart
                                    title="Usuários realmente ativos"
                                    series={data.series.realActiveUsers}
                                    color="#2563eb"
                                />
                                <MetricChart
                                    title="Usuários com clientes ativos"
                                    series={data.series.activeCustomerUsers}
                                    color="#9333ea"
                                />
                                <MetricChart
                                    title="Dinheiro movimentado"
                                    series={data.series.moneyHandledCents}
                                    color="#1d1d1d"
                                    currency
                                />
                                <MetricChart
                                    title="Dinheiro movimentado online"
                                    series={data.series.onlineMoneyHandledCents}
                                    color="#0891b2"
                                    currency
                                />
                            </div>
                        </section>

                        <section>
                            <SectionHeading
                                title="Formas de pagamento"
                                description="Valor movimentado por forma de pagamento ao longo do período."
                            />
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                                <div className="h-[360px]">
                                    {data.paymentMethods.datasets.length ? (
                                        <Bar
                                            data={paymentChartData}
                                            options={paymentOptions()}
                                        />
                                    ) : (
                                        <EmptyChart />
                                    )}
                                </div>
                            </div>
                        </section>

                        <section>
                            <SectionHeading
                                title="Pipeline de aquisição e ativação"
                                description="Os valores e as conversões seguem o período selecionado."
                            />
                            <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
                                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                                    {data.pipeline.map((step, index) => (
                                        <div
                                            key={step.key}
                                            className={`rounded-xl border p-4 ${
                                                step.available
                                                    ? "border-gray-200 bg-white"
                                                    : "border-dashed border-gray-300 bg-gray-50"
                                            }`}
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-gray-900 text-xs font-semibold text-white">
                                                    {index + 1}
                                                </span>
                                                <p className="text-sm font-medium text-gray-800">
                                                    {step.label}
                                                </p>
                                            </div>
                                            <p className="mt-4 text-2xl font-bold">
                                                {step.value === null
                                                    ? "—"
                                                    : formatCount(step.value)}
                                            </p>
                                            <p className="mt-1 text-xs text-gray-500">
                                                {step.conversion !== null
                                                    ? `${step.conversion.toLocaleString(
                                                          "pt-BR"
                                                      )}% do passo anterior`
                                                    : step.note ||
                                                      (step.available
                                                          ? "Conversão indisponível"
                                                          : "Evento ainda não conectado")}
                                            </p>
                                        </div>
                                    ))}
                                </div>

                                <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
                                    Registro completo vem do Supabase Auth. Os passos 1–4 usam a mesma
                                    coorte de contas criadas no período e o estágio atual salvo em
                                    restaurants.creation_step. O banco guarda o estágio atual, não o horário
                                    individual em que cada passo foi concluído.
                                </div>

                                {!data.tracking.postHogAvailable && (
                                    <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                        Landing page, acesso ao cadastro e Blog precisam das variáveis
                                        do PostHog no cliente e de POSTHOG_PERSONAL_API_KEY e
                                        POSTHOG_PROJECT_ID no servidor.
                                    </div>
                                )}
                            </div>
                        </section>

                        <section>
                            <SectionHeading
                                title="Blog"
                                description="Soma das visualizações de /blog e de todas as páginas abaixo de /blog no período selecionado."
                            />
                            <div className="max-w-md">
                                <MetricCard
                                    title="Visualizações nas páginas do blog"
                                    value={
                                        data.tracking.blogViews === null
                                            ? "—"
                                            : formatCount(data.tracking.blogViews)
                                    }
                                    description={
                                        data.tracking.postHogAvailable
                                            ? "Pageviews registrados pelo PostHog."
                                            : "Aguardando a conexão de leitura com o PostHog."
                                    }
                                />
                            </div>
                        </section>

                        <section>
                            <SectionHeading
                                title="Abandono"
                                description="Situação calculada em relação ao fim do período selecionado e ao fim de cada intervalo do gráfico."
                            />
                            <div className="grid gap-4 sm:grid-cols-2">
                                <MetricCard
                                    title="Usuários ativos abandonados"
                                    value={formatCount(
                                        data.cards.abandonedActiveUsers
                                    )}
                                    description="Tiveram pedido concluído na semana anterior e nenhum pedido nos sete dias seguintes."
                                    danger
                                />
                                <MetricCard
                                    title="Usuários com clientes ativos abandonados"
                                    value={formatCount(
                                        data.cards.abandonedActiveCustomerUsers
                                    )}
                                    description="Atingiram quatro pedidos de clientes diferentes nos 30 dias anteriores e ficaram sete dias sem novos pedidos."
                                    danger
                                />
                            </div>

                            <div className="mt-5 grid gap-5 xl:grid-cols-2">
                                <MetricChart
                                    title="Usuários ativos abandonados"
                                    series={data.series.abandonedActiveUsers}
                                    color="#dc2626"
                                />
                                <MetricChart
                                    title="Usuários com clientes ativos abandonados"
                                    series={
                                        data.series.abandonedActiveCustomerUsers
                                    }
                                    color="#ea580c"
                                />
                            </div>
                        </section>

                        <section>
                            <SectionHeading
                                title="Consumidor"
                                description="Funil do consumidor no período selecionado, do cardápio até a criação do pedido."
                            />
                            <ConsumerPipelineCard
                                steps={data.consumerPipeline}
                                postHogAvailable={
                                    data.tracking.postHogAvailable
                                }
                            />
                        </section>

                        <section>
                            <SectionHeading
                                title="Uso do cardápio ao longo do tempo"
                                description={`Métricas agrupadas por ${
                                    data.range.bucket === "week" ? "semana" : "dia"
                                } no período selecionado.`}
                            />
                            <div className="grid gap-5 xl:grid-cols-2">
                                <MetricChart
                                    title="Visualizações do cardápio"
                                    series={data.consumerTimeline.menuViews}
                                    color="#f14400"
                                />
                                <MetricChart
                                    title="Adições ao carrinho"
                                    series={data.consumerTimeline.cartAdds}
                                    color="#2563eb"
                                />
                                <MetricChart
                                    title="Preço médio do carrinho"
                                    series={data.consumerTimeline.averageCartCents}
                                    color="#16a34a"
                                    currency
                                />
                                <MetricChart
                                    title="Pedidos"
                                    series={data.consumerTimeline.orders}
                                    color="#1d1d1d"
                                />
                            </div>
                        </section>
                    </>
                ) : null}
            </div>
        </main>
    );
}

function SectionHeading({
    title,
    description,
}: {
    title: string;
    description: string;
}) {
    return (
        <div className="mb-4">
            <h2 className="text-xl font-bold text-gray-900">{title}</h2>
            <p className="mt-1 text-sm text-gray-500">{description}</p>
        </div>
    );
}

function MetricCard({
    title,
    value,
    description,
    danger = false,
}: {
    title: string;
    value: string;
    description: string;
    danger?: boolean;
}) {
    return (
        <article
            className={`rounded-2xl border bg-white p-5 shadow-sm ${
                danger ? "border-red-200" : "border-gray-200"
            }`}
        >
            <p className="text-sm font-medium text-gray-600">{title}</p>
            <p
                className={`mt-2 text-3xl font-bold tracking-tight ${
                    danger ? "text-red-700" : "text-gray-950"
                }`}
            >
                {value}
            </p>
            <p className="mt-3 text-xs leading-5 text-gray-500">{description}</p>
        </article>
    );
}

function MetricChart({
    title,
    series,
    color,
    currency = false,
}: {
    title: string;
    series: SeriesPoint[];
    color: string;
    currency?: boolean;
}) {
    const chartData = {
        labels: series.map((point) => point.label),
        datasets: [
            {
                label: title,
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
        ],
    };

    return (
        <article className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6">
            <h3 className="text-base font-semibold text-gray-900">{title}</h3>
            <div className="mt-4 h-[280px]">
                {series.length ? (
                    <Line data={chartData} options={lineOptions(currency)} />
                ) : (
                    <EmptyChart />
                )}
            </div>
        </article>
    );
}

function EmptyChart() {
    return (
        <div className="flex h-full items-center justify-center text-sm text-gray-400">
            Nenhum dado no período.
        </div>
    );
}

function DashboardLoading() {
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

function CenteredMessage({
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
