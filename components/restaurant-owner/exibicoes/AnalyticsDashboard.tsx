"use client";

import { useEffect, useMemo, useState } from "react";
import {
    ArcElement,
    BarElement,
    CategoryScale,
    Chart as ChartJS,
    Legend,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
} from "chart.js";
import { Bar, Doughnut, Line } from "react-chartjs-2";

import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import { supabase } from "@/lib/database/supabaseClient";

ChartJS.register(
    ArcElement,
    BarElement,
    CategoryScale,
    LinearScale,
    LineElement,
    PointElement,
    Tooltip,
    Legend
);

type Summary = {
    revenueCents: number;
    createdOrders: number;
    completedOrders: number;
    averageTicketCents: number;
    deliveryRate: number;
    averageDeliveryFeeCents: number;
    cancellationRate: number;
    averageItemsPerOrder: number;
    couponRate: number;
};

type SeriesPoint = {
    date: string;
    orders: number;
};

type RevenuePoint = SeriesPoint & {
    revenueCents: number;
};

type Distribution = {
    key: string;
    orders: number;
    percentage: number;
};

type ItemMetric = {
    name: string;
    quantity: number;
    revenueCents: number;
};

type CategoryMetric = {
    name: string;
    orders: number;
    quantity: number;
};

type CategoryPairMetric = {
    firstCategory: string;
    secondCategory: string;
    orders: number;
    rate: number;
};

type Payload = {
    summary: Summary;
    revenueSeries: RevenuePoint[];
    orderSeries: SeriesPoint[];
    paymentTypes: Distribution[];
    fulfillment: Distribution[];
    hourlyOrders: { hour: number; orders: number }[];
    items: ItemMetric[];
    categories: CategoryMetric[];
    categoryPairs: CategoryPairMetric[];
    consumer: {
        postHogAvailable: boolean;
        series: {
            date: string;
            menuViews: number;
            averageCartCents: number;
        }[];
    };
};

const ITEMS_PER_PAGE = 6;
const BRAND = "#f14400";
const DARK = "#1d1d1d";
const CHART_COLORS = [
    "#f14400",
    "#1d1d1d",
    "#6b7280",
    "#9ca3af",
    "#d1d5db",
    "#fb923c",
];

function formatCurrency(cents: number): string {
    return (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });
}

function formatDate(date: string): string {
    const [year, month, day] = date.split("-").map(Number);
    return new Date(year, month - 1, day).toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
    });
}

function paymentLabel(value: string): string {
    const labels: Record<string, string> = {
        pix: "Pix online",
        "pix-entrega": "Pix na entrega",
        dinheiro: "Dinheiro",
        "trazer-maquininha": "Cartão na entrega",
        cartao: "Cartão",
        unknown: "Não informado",
    };
    return labels[value] || value;
}

function fulfillmentLabel(value: string): string {
    if (value === "delivery") return "Entrega";
    if (value === "pickup") return "Retirada";
    return "Não informado";
}

function getDateKeys(startDate: string, endDate: string): string[] {
    const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
    const [endYear, endMonth, endDay] = endDate.split("-").map(Number);
    const current = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);
    const dates: string[] = [];

    while (current <= end) {
        const year = current.getFullYear();
        const month = String(current.getMonth() + 1).padStart(2, "0");
        const day = String(current.getDate()).padStart(2, "0");
        dates.push(`${year}-${month}-${day}`);
        current.setDate(current.getDate() + 1);
    }

    return dates;
}

function MetricCard({
    label,
    value,
    helper,
}: {
    label: string;
    value: string;
    helper?: string;
}) {
    return (
        <Card className="p-5">
            <p className="text-sm font-medium text-gray-500">{label}</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
            {helper && <p className="mt-1 text-xs text-gray-400">{helper}</p>}
        </Card>
    );
}

function EmptyChart({ text = "Nenhum dado no período." }: { text?: string }) {
    return (
        <div className="flex h-full items-center justify-center text-center text-sm text-gray-400">
            {text}
        </div>
    );
}

export default function AnalyticsDashboard({
    restaurantId,
    startDate,
    endDate,
}: {
    restaurantId: string;
    startDate: string;
    endDate: string;
}) {
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [itemPage, setItemPage] = useState(0);

    useEffect(() => {
        const controller = new AbortController();

        const getAccessToken = async (forceRefresh = false) => {
            if (forceRefresh) {
                const {
                    data: { session },
                    error: refreshError,
                } = await supabase.auth.refreshSession();

                if (refreshError || !session?.access_token) return null;
                return session.access_token;
            }

            const {
                data: { session },
                error: sessionError,
            } = await supabase.auth.getSession();

            if (sessionError || !session?.access_token) return null;

            const expiresAt = session.expires_at
                ? session.expires_at * 1000
                : null;

            if (expiresAt && expiresAt <= Date.now() + 30_000) {
                return getAccessToken(true);
            }

            return session.access_token;
        };

        const requestAnalytics = (accessToken: string) =>
            fetch(
                `/api/restaurants/${restaurantId}/analytics?from=${encodeURIComponent(
                    startDate
                )}&to=${encodeURIComponent(endDate)}`,
                {
                    headers: { Authorization: `Bearer ${accessToken}` },
                    cache: "no-store",
                    signal: controller.signal,
                }
            );

        const load = async () => {
            setLoading(true);
            setError("");
            setItemPage(0);

            try {
                let accessToken = await getAccessToken();
                if (!accessToken) {
                    throw new Error("Faça login novamente para carregar o Analytics.");
                }

                let response = await requestAnalytics(accessToken);
                if (response.status === 401) {
                    accessToken = await getAccessToken(true);
                    if (!accessToken) {
                        throw new Error("Sua sessão expirou. Entre novamente.");
                    }
                    response = await requestAnalytics(accessToken);
                }

                const payload = (await response.json()) as Payload & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(
                        payload.error || "Não foi possível carregar o Analytics."
                    );
                }

                setData(payload);
            } catch (caught) {
                if (caught instanceof DOMException && caught.name === "AbortError") {
                    return;
                }
                setError(
                    caught instanceof Error
                        ? caught.message
                        : "Não foi possível carregar o Analytics."
                );
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void load();
        return () => controller.abort();
    }, [restaurantId, startDate, endDate]);

    const itemPages = data
        ? Math.max(1, Math.ceil(data.items.length / ITEMS_PER_PAGE))
        : 1;
    const visibleItems = data?.items.slice(
        itemPage * ITEMS_PER_PAGE,
        itemPage * ITEMS_PER_PAGE + ITEMS_PER_PAGE
    );

    const hourlyOrders = useMemo(() => {
        const byHour = new Map(
            (data?.hourlyOrders || []).map((item) => [item.hour, item.orders])
        );
        return Array.from({ length: 24 }, (_, hour) => ({
            hour,
            orders: byHour.get(hour) || 0,
        }));
    }, [data?.hourlyOrders]);

    const dateKeys = useMemo(
        () => getDateKeys(startDate, endDate),
        [startDate, endDate]
    );

    const normalizedRevenueSeries = useMemo(() => {
        const byDate = new Map(
            (data?.revenueSeries || []).map((point) => [point.date, point])
        );
        return dateKeys.map((date) => ({
            date,
            revenueCents: byDate.get(date)?.revenueCents || 0,
            orders: byDate.get(date)?.orders || 0,
        }));
    }, [data?.revenueSeries, dateKeys]);

    const normalizedOrderSeries = useMemo(() => {
        const byDate = new Map(
            (data?.orderSeries || []).map((point) => [point.date, point.orders])
        );
        return dateKeys.map((date) => ({
            date,
            orders: byDate.get(date) || 0,
        }));
    }, [data?.orderSeries, dateKeys]);

    const normalizedConsumerSeries = useMemo(() => {
        const byDate = new Map(
            (data?.consumer.series || []).map((point) => [point.date, point])
        );
        return dateKeys.map((date) => ({
            date,
            menuViews: byDate.get(date)?.menuViews || 0,
            averageCartCents: byDate.has(date)
                ? byDate.get(date)?.averageCartCents || 0
                : null,
        }));
    }, [data?.consumer.series, dateKeys]);

    if (loading && !data) {
        return (
            <Card>
                <ListLoader lines={7} />
                <p className="mt-4 text-center text-gray-500">
                    Carregando Analytics...
                </p>
            </Card>
        );
    }

    if (error && !data) {
        return (
            <Card className="border-red-200 bg-red-50">
                <p className="text-center text-red-600">{error}</p>
            </Card>
        );
    }

    if (!data) return null;

    const revenueChart = {
        labels: normalizedRevenueSeries.map((point) => formatDate(point.date)),
        datasets: [
            {
                label: "Faturamento",
                data: normalizedRevenueSeries.map((point) => point.revenueCents / 100),
                borderColor: BRAND,
                backgroundColor: BRAND,
                tension: 0.3,
            },
        ],
    };

    const consumerAccessChart = {
        labels: normalizedConsumerSeries.map((point) => formatDate(point.date)),
        datasets: [
            {
                label: "Acessos",
                data: normalizedConsumerSeries.map((point) => point.menuViews),
                borderColor: BRAND,
                backgroundColor: BRAND,
                tension: 0.3,
            },
        ],
    };

    const averageCartChart = {
        labels: normalizedConsumerSeries.map((point) => formatDate(point.date)),
        datasets: [
            {
                label: "Carrinho médio",
                data: normalizedConsumerSeries.map((point) =>
                    point.averageCartCents === null
                        ? null
                        : point.averageCartCents / 100
                ),
                borderColor: DARK,
                backgroundColor: DARK,
                tension: 0.3,
            },
        ],
    };

    const orderChart = {
        labels: normalizedOrderSeries.map((point) => formatDate(point.date)),
        datasets: [
            {
                label: "Pedidos criados",
                data: normalizedOrderSeries.map((point) => point.orders),
                borderColor: BRAND,
                backgroundColor: BRAND,
                tension: 0.3,
            },
        ],
    };

    const paymentChart = {
        labels: data.paymentTypes.map(
            (item) => `${paymentLabel(item.key)} · ${item.percentage.toLocaleString("pt-BR")}%`
        ),
        datasets: [
            {
                data: data.paymentTypes.map((item) => item.orders),
                backgroundColor: data.paymentTypes.map(
                    (_, index) => CHART_COLORS[index % CHART_COLORS.length]
                ),
            },
        ],
    };

    const fulfillmentChart = {
        labels: data.fulfillment.map(
            (item) => `${fulfillmentLabel(item.key)} · ${item.percentage.toLocaleString("pt-BR")}%`
        ),
        datasets: [
            {
                data: data.fulfillment.map((item) => item.orders),
                backgroundColor: data.fulfillment.map(
                    (_, index) => CHART_COLORS[index % CHART_COLORS.length]
                ),
            },
        ],
    };

    const hourlyChart = {
        labels: hourlyOrders.map((item) => `${String(item.hour).padStart(2, "0")}h`),
        datasets: [
            {
                label: "Pedidos",
                data: hourlyOrders.map((item) => item.orders),
                backgroundColor: BRAND,
            },
        ],
    };

    const categoryChart = {
        labels: data.categories.slice(0, 12).map((item) => item.name),
        datasets: [
            {
                label: "Pedidos",
                data: data.categories.slice(0, 12).map((item) => item.orders),
                backgroundColor: BRAND,
            },
        ],
    };

    const categoryPairChart = {
        labels: data.categoryPairs.map(
            (item) => `${item.firstCategory} + ${item.secondCategory}`
        ),
        datasets: [
            {
                label: "% dos pedidos",
                data: data.categoryPairs.map((item) => item.rate),
                backgroundColor: DARK,
            },
        ],
    };

    const lineOptions = {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: "index" as const, intersect: false },
        plugins: { legend: { display: false } },
        scales: {
            y: { beginAtZero: true },
        },
    };

    const moneyLineOptions = {
        ...lineOptions,
        scales: {
            y: {
                beginAtZero: true,
                ticks: {
                    callback: (value: string | number) => `R$ ${Number(value)}`,
                },
            },
        },
    };

    const horizontalBarOptions = {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: "y" as const,
        plugins: { legend: { display: false } },
        scales: { x: { beginAtZero: true } },
    };

    const doughnutOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: "bottom" as const } },
    };

    return (
        <div className={`space-y-8 ${loading ? "opacity-60" : "opacity-100"}`}>
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <MetricCard
                    label="Faturamento"
                    value={formatCurrency(data.summary.revenueCents)}
                    helper="Pedidos concluídos"
                />
                <MetricCard
                    label="Pedidos concluídos"
                    value={data.summary.completedOrders.toLocaleString("pt-BR")}
                />
                <MetricCard
                    label="Ticket médio"
                    value={formatCurrency(data.summary.averageTicketCents)}
                />
                <MetricCard
                    label="Pedidos com entrega"
                    value={`${data.summary.deliveryRate.toLocaleString("pt-BR")}%`}
                    helper="Entre pedidos com modalidade identificada"
                />
                <MetricCard
                    label="Taxa média de entrega"
                    value={formatCurrency(data.summary.averageDeliveryFeeCents)}
                />
                <MetricCard
                    label="Itens por pedido"
                    value={data.summary.averageItemsPerOrder.toLocaleString("pt-BR")}
                />
                <MetricCard
                    label="Uso de cupom"
                    value={`${data.summary.couponRate.toLocaleString("pt-BR")}%`}
                />
                <MetricCard
                    label="Cancelamento"
                    value={`${data.summary.cancellationRate.toLocaleString("pt-BR")}%`}
                    helper={`${data.summary.createdOrders.toLocaleString("pt-BR")} pedidos criados`}
                />
            </section>

            <Card>
                <div className="mb-5">
                    <h2 className="text-xl font-bold text-gray-900">Faturamento</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Receita de pedidos concluídos no período selecionado.
                    </p>
                </div>
                <div className="h-[320px]">
                    {data.revenueSeries.length > 0 ? (
                        <Line data={revenueChart} options={moneyLineOptions} />
                    ) : (
                        <EmptyChart />
                    )}
                </div>
            </Card>

            <section>
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                        Comportamento do consumidor
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Evolução diária de acesso, carrinho e criação de pedidos.
                    </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-3">
                    <Card>
                        <h3 className="mb-4 font-semibold text-gray-900">
                            Acessos ao cardápio
                        </h3>
                        <div className="h-[240px]">
                            {data.consumer.postHogAvailable &&
                            data.consumer.series.length > 0 ? (
                                <Line data={consumerAccessChart} options={lineOptions} />
                            ) : (
                                <EmptyChart text="Dados de acesso indisponíveis no período." />
                            )}
                        </div>
                    </Card>
                    <Card>
                        <h3 className="mb-4 font-semibold text-gray-900">
                            Carrinho médio
                        </h3>
                        <div className="h-[240px]">
                            {data.consumer.postHogAvailable &&
                            data.consumer.series.length > 0 ? (
                                <Line data={averageCartChart} options={moneyLineOptions} />
                            ) : (
                                <EmptyChart text="Dados de carrinho indisponíveis no período." />
                            )}
                        </div>
                    </Card>
                    <Card>
                        <h3 className="mb-4 font-semibold text-gray-900">
                            Pedidos criados
                        </h3>
                        <div className="h-[240px]">
                            {data.orderSeries.length > 0 ? (
                                <Line data={orderChart} options={lineOptions} />
                            ) : (
                                <EmptyChart />
                            )}
                        </div>
                    </Card>
                </div>
            </section>

            <Card>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-bold text-gray-900">
                            Itens mais pedidos
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Ranking por quantidade vendida em pedidos concluídos.
                        </p>
                    </div>
                    {data.items.length > ITEMS_PER_PAGE && (
                        <div className="flex items-center gap-2 text-sm text-gray-500">
                            <button
                                type="button"
                                aria-label="Página anterior"
                                disabled={itemPage === 0}
                                onClick={() => setItemPage((page) => Math.max(0, page - 1))}
                                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-lg disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                ‹
                            </button>
                            <span>
                                {itemPage + 1}/{itemPages}
                            </span>
                            <button
                                type="button"
                                aria-label="Próxima página"
                                disabled={itemPage >= itemPages - 1}
                                onClick={() =>
                                    setItemPage((page) =>
                                        Math.min(itemPages - 1, page + 1)
                                    )
                                }
                                className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-lg border border-gray-200 bg-white text-lg disabled:cursor-not-allowed disabled:opacity-40"
                            >
                                ›
                            </button>
                        </div>
                    )}
                </div>

                {visibleItems && visibleItems.length > 0 ? (
                    <div className="overflow-hidden rounded-xl border border-gray-200">
                        <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500">
                            <span>Item</span>
                            <span className="text-right">Qtd.</span>
                            <span className="text-right">Receita</span>
                        </div>
                        <div className="divide-y divide-gray-100">
                            {visibleItems.map((item, index) => (
                                <div
                                    key={`${item.name}-${itemPage}-${index}`}
                                    className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-3 text-sm"
                                >
                                    <span className="truncate font-medium text-gray-800">
                                        {item.name}
                                    </span>
                                    <span className="text-right font-semibold text-gray-900">
                                        {item.quantity.toLocaleString("pt-BR")}
                                    </span>
                                    <span className="text-right text-gray-500">
                                        {formatCurrency(item.revenueCents)}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">
                        Nenhum item vendido no período.
                    </p>
                )}
            </Card>

            <section className="grid gap-4 lg:grid-cols-3">
                <Card>
                    <h2 className="mb-4 text-lg font-bold text-gray-900">
                        Formas de pagamento
                    </h2>
                    <div className="h-[280px]">
                        {data.paymentTypes.length > 0 ? (
                            <Doughnut data={paymentChart} options={doughnutOptions} />
                        ) : (
                            <EmptyChart />
                        )}
                    </div>
                </Card>
                <Card>
                    <h2 className="mb-4 text-lg font-bold text-gray-900">
                        Entrega x retirada
                    </h2>
                    <div className="h-[280px]">
                        {data.fulfillment.length > 0 ? (
                            <Doughnut data={fulfillmentChart} options={doughnutOptions} />
                        ) : (
                            <EmptyChart />
                        )}
                    </div>
                </Card>
                <Card>
                    <h2 className="mb-4 text-lg font-bold text-gray-900">
                        Horários dos pedidos
                    </h2>
                    <div className="h-[280px]">
                        <Bar
                            data={hourlyChart}
                            options={{
                                responsive: true,
                                maintainAspectRatio: false,
                                plugins: { legend: { display: false } },
                                scales: { y: { beginAtZero: true } },
                            }}
                        />
                    </div>
                </Card>
            </section>

            <section>
                <div className="mb-4">
                    <h2 className="text-xl font-bold text-gray-900">
                        Categorias
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Quais categorias aparecem mais nos pedidos e quais são compradas juntas.
                    </p>
                </div>
                <div className="grid gap-4 lg:grid-cols-2">
                    <Card>
                        <h3 className="mb-4 font-semibold text-gray-900">
                            Pedidos por categoria
                        </h3>
                        <div className="h-[360px]">
                            {data.categories.length > 0 ? (
                                <Bar
                                    data={categoryChart}
                                    options={horizontalBarOptions}
                                />
                            ) : (
                                <EmptyChart />
                            )}
                        </div>
                    </Card>
                    <Card>
                        <h3 className="mb-1 font-semibold text-gray-900">
                            Categorias mais combinadas
                        </h3>
                        <p className="mb-4 text-xs text-gray-500">
                            Percentual dos pedidos concluídos que continham as duas categorias.
                        </p>
                        <div className="h-[360px]">
                            {data.categoryPairs.length > 0 ? (
                                <Bar
                                    data={categoryPairChart}
                                    options={horizontalBarOptions}
                                />
                            ) : (
                                <EmptyChart text="Ainda não há combinações suficientes no período." />
                            )}
                        </div>
                    </Card>
                </div>
            </section>

            {error && <p className="text-sm text-red-600">{error}</p>}
        </div>
    );
}
