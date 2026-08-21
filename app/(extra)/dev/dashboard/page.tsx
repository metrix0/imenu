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
import SalesRankingSection from "@/components/analytics/SalesRankingSection";
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
    abandonedUsers: Array<{
        accountId: string;
        restaurantName: string;
        activeCustomerAbandoned: boolean;
    }>;
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
    traffic: {
        available: boolean;
        pages: Array<{
            path: string;
            label: string;
            kind: string;
            visitors: number;
            homeVisitors: number;
            ratio: number;
        }>;
    };
    generatedAt: string;
};

type DashboardDetailsPayload = {
    abandonedUsers: Array<{
        accountId: string;
        restaurantName: string;
        phone: string | null;
        storeWhatsapp: string | null;
        activeCustomerAbandoned: boolean;
        previousWeekOrders: number;
        previousWeekCustomers: number;
        previousWeekGmvCents: number;
        lastOrderAt: string | null;
    }>;
    trafficSummary: {
        appViews: number | null;
        landingViews: number | null;
    };
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

function formatRatio(value: number): string {
    return `${value.toLocaleString("pt-BR", {
        minimumFractionDigits: value % 1 === 0 ? 0 : 1,
        maximumFractionDigits: 1,
    })}%`;
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

function formatDateTime(value: string | null): string {
    if (!value) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value));
}

function firstPhone(value: string | null): string {
    return value?.split(",")[0]?.trim() || "";
}

function formatPhone(value: string | null): string {
    const original = firstPhone(value);
    let digits = original.replace(/\D/g, "");

    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        digits = digits.slice(2);
    }

    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return original || "—";
}

function normalizeWhatsappNumber(value: string | null): string | null {
    const original = firstPhone(value);
    let digits = original.replace(/\D/g, "");
    if (!digits) return null;

    if (!digits.startsWith("55") && (digits.length === 10 || digits.length === 11)) {
        digits = `55${digits}`;
    }

    return digits.length >= 12 ? digits : null;
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
    const [details, setDetails] = useState<DashboardDetailsPayload | null>(null);
    const [showAllAbandoned, setShowAllAbandoned] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();

        const loadDashboard = async () => {
            setLoading(true);
            setError("");
            setShowAllAbandoned(false);

            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    setAccessState("signed-out");
                    setData(null);
                    setDetails(null);
                    return;
                }

                const headers = {
                    Authorization: `Bearer ${session.access_token}`,
                };
                const [response, detailsResponse] = await Promise.all([
                    fetch(`/api/dev/dashboard?range=${range}`, {
                        headers,
                        cache: "no-store",
                        signal: controller.signal,
                    }),
                    fetch(`/api/dev/dashboard/details?range=${range}`, {
                        headers,
                        cache: "no-store",
                        signal: controller.signal,
                    }),
                ]);

                const payload = (await response.json()) as DashboardPayload & {
                    error?: string;
                };
                const detailsPayload =
                    (await detailsResponse.json()) as DashboardDetailsPayload & {
                        error?: string;
                    };

                if (response.status === 401 || detailsResponse.status === 401) {
                    setAccessState("signed-out");
                    setData(null);
                    setDetails(null);
                    return;
                }

                if (response.status === 403 || detailsResponse.status === 403) {
                    setAccessState("forbidden");
                    setData(null);
                    setDetails(null);
                    return;
                }

                if (!response.ok) {
                    throw new Error(payload.error || "Erro ao carregar o dashboard.");
                }
                if (!detailsResponse.ok) {
                    throw new Error(
                        detailsPayload.error || "Erro ao carregar os detalhes do dashboard."
                    );
                }

                setAccessState("allowed");
                setData(payload);
                setDetails(detailsPayload);
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

                            <div className="mt-5 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <div className="border-b border-gray-200 px-5 py-4">
                                    <h3 className="font-semibold text-gray-900">
                                        Usuários ativos abandonados
                                    </h3>
                                </div>
                                {details?.abandonedUsers.length ? (
                                    <>
                                        <div className="overflow-x-auto">
                                            <table className="w-full min-w-[1180px] text-left text-sm">
                                                <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                                    <tr>
                                                        <th className="px-5 py-4 font-semibold">Restaurante</th>
                                                        <th className="px-5 py-4 font-semibold">Telefone</th>
                                                        <th className="px-5 py-4 font-semibold">Telefone loja</th>
                                                        <th className="px-5 py-4 text-right font-semibold">Pedidos</th>
                                                        <th className="px-5 py-4 text-right font-semibold">Clientes</th>
                                                        <th className="px-5 py-4 text-right font-semibold">GMV</th>
                                                        <th className="px-5 py-4 font-semibold">Último pedido</th>
                                                        <th className="px-5 py-4 text-right font-semibold">Contato</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-100">
                                                    {(showAllAbandoned
                                                        ? details.abandonedUsers
                                                        : details.abandonedUsers.slice(0, 10)
                                                    ).map((user) => {
                                                        const whatsappNumber =
                                                            normalizeWhatsappNumber(user.phone) ||
                                                            normalizeWhatsappNumber(user.storeWhatsapp);
                                                        return (
                                                            <tr
                                                                key={user.accountId}
                                                                className="hover:bg-gray-50/70"
                                                            >
                                                                <td className="px-5 py-4 font-medium text-gray-900">
                                                                    <span className="inline-flex items-center gap-2">
                                                                        {user.activeCustomerAbandoned && (
                                                                            <span className="text-base text-amber-500">★</span>
                                                                        )}
                                                                        {user.restaurantName}
                                                                    </span>
                                                                </td>
                                                                <td className="px-5 py-4 text-gray-600">
                                                                    {formatPhone(user.phone)}
                                                                </td>
                                                                <td className="px-5 py-4 text-gray-600">
                                                                    {formatPhone(user.storeWhatsapp)}
                                                                </td>
                                                                <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                                    {formatCount(user.previousWeekOrders)}
                                                                </td>
                                                                <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                                    {formatCount(user.previousWeekCustomers)}
                                                                </td>
                                                                <td className="px-5 py-4 text-right font-semibold tabular-nums text-gray-900">
                                                                    {formatCurrencyFromCents(user.previousWeekGmvCents)}
                                                                </td>
                                                                <td className="px-5 py-4 text-gray-600">
                                                                    {formatDateTime(user.lastOrderAt)}
                                                                </td>
                                                                <td className="px-5 py-4 text-right">
                                                                    <button
                                                                        type="button"
                                                                        disabled={!whatsappNumber}
                                                                        onClick={() => {
                                                                            if (!whatsappNumber) return;
                                                                            const message = `Olá, ${user.restaurantName}, percebemos que estava usando o iMenu, porém nos últimos 7 dias não houveram compras recentes no seu restaurante. Nossa equipe corrige erros em 1-2 dias úteis e adiciona novas funcionalidades em 1-2 semanas. Podemos auxiliar de alguma forma?`;
                                                                            window.open(
                                                                                `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
                                                                                "_blank",
                                                                                "noopener,noreferrer"
                                                                            );
                                                                        }}
                                                                        className="rounded-lg bg-green-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-green-700 disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-400"
                                                                    >
                                                                        WhatsApp
                                                                    </button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                        {details.abandonedUsers.length > 10 && (
                                            <div className="border-t border-gray-100 p-3 text-center">
                                                <button
                                                    type="button"
                                                    onClick={() => setShowAllAbandoned((value) => !value)}
                                                    className="rounded-lg px-4 py-2 text-sm font-semibold text-brand transition hover:bg-brand/5"
                                                >
                                                    {showAllAbandoned
                                                        ? "Mostrar menos"
                                                        : `Mostrar mais (${details.abandonedUsers.length - 10})`}
                                                </button>
                                            </div>
                                        )}
                                    </>
                                ) : (
                                    <div className="px-5 py-8 text-center text-sm text-gray-400">
                                        Nenhum usuário ativo abandonado.
                                    </div>
                                )}
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

                        <SalesRankingSection range={range} />

                        <section>
                            <SectionHeading
                                title="Traffic"
                                description="Visitantes únicos que saíram de cada página de conteúdo para a página inicial no período selecionado."
                            />
                            <div className="mb-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                                <MetricCard
                                    title="Visualizações nas páginas do blog"
                                    value={
                                        data.tracking.blogViews === null
                                            ? "—"
                                            : formatCount(data.tracking.blogViews)
                                    }
                                    description={
                                        data.tracking.postHogAvailable
                                            ? "Soma das visualizações de /blog e de todas as páginas abaixo de /blog no período selecionado. Pageviews registrados pelo PostHog."
                                            : "Soma das visualizações de /blog e de todas as páginas abaixo de /blog no período selecionado. Aguardando a conexão de leitura com o PostHog."
                                    }
                                />
                                <MetricCard
                                    title="Visualizações no app"
                                    value={
                                        details?.trafficSummary.appViews == null
                                            ? "—"
                                            : formatCount(details.trafficSummary.appViews)
                                    }
                                    description="Pageviews nas páginas públicas do iMenu no período selecionado, excluindo landing page, painel, cardápios de restaurantes e rotas internas."
                                />
                                <MetricCard
                                    title="Visualizações da landing page"
                                    value={
                                        details?.trafficSummary.landingViews == null
                                            ? "—"
                                            : formatCount(details.trafficSummary.landingViews)
                                    }
                                    description="Pageviews da página inicial no período selecionado, registrados pelo PostHog."
                                />
                            </div>
                            <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                                <div className="overflow-x-auto">
                                    <table className="w-full min-w-[760px] text-left text-sm">
                                        <thead className="border-b border-gray-200 bg-gray-50 text-xs uppercase tracking-wide text-gray-500">
                                            <tr>
                                                <th className="px-5 py-4 font-semibold">Página</th>
                                                <th className="px-5 py-4 font-semibold">Tipo</th>
                                                <th className="px-5 py-4 text-right font-semibold">Visitantes</th>
                                                <th className="px-5 py-4 text-right font-semibold">Foram ao index</th>
                                                <th className="px-5 py-4 text-right font-semibold">Taxa</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-100">
                                            {data.traffic.pages.map((page) => (
                                                <tr key={page.path} className="hover:bg-gray-50/70">
                                                    <td className="px-5 py-4">
                                                        <a
                                                            href={page.path}
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="font-medium text-gray-900 hover:text-brand hover:underline"
                                                        >
                                                            {page.path}
                                                        </a>
                                                        <p className="mt-1 text-xs text-gray-500">{page.label}</p>
                                                    </td>
                                                    <td className="px-5 py-4 text-gray-600">{page.kind}</td>
                                                    <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                        {data.traffic.available ? formatCount(page.visitors) : "—"}
                                                    </td>
                                                    <td className="px-5 py-4 text-right tabular-nums text-gray-700">
                                                        {data.traffic.available ? formatCount(page.homeVisitors) : "—"}
                                                    </td>
                                                    <td className="px-5 py-4 text-right">
                                                        <span className="inline-flex min-w-16 justify-center rounded-full bg-brand/10 px-3 py-1 font-semibold tabular-nums text-brand">
                                                            {data.traffic.available ? formatRatio(page.ratio) : "—"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                                {!data.traffic.available && (
                                    <div className="border-t border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                                        A leitura exige POSTHOG_PERSONAL_API_KEY e POSTHOG_PROJECT_ID no servidor.
                                    </div>
                                )}
                                {data.traffic.available && (
                                    <div className="border-t border-gray-200 bg-gray-50 p-4 text-xs leading-5 text-gray-500">
                                        Taxa = visitantes únicos que clicaram para ir ao index ÷ visitantes únicos da página. O histórico começa após a publicação deste rastreamento.
                                    </div>
                                )}
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
