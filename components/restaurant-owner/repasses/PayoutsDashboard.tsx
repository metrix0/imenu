"use client";

import { useEffect, useState } from "react";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";

import { supabase } from "@/lib/database/supabaseClient";
import { calculateOnePercentPayout, PAYOUT_MARGIN_MINUTES } from "@/lib/services/payoutSafety";
import cronSchedule from "@/deployment/vps/cron-schedule.json";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import Pagination from "@/components/ui/Pagination";
import Tooltip from "@/components/ui/Tooltip";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";

const PAGE_SIZE = 5;
const ORDER_BATCH_SIZE = 1000;
const BUSINESS_TIME_ZONE = "America/Sao_Paulo";
const DAY_MS = 24 * 60 * 60 * 1000;
const MARGIN_MS = PAYOUT_MARGIN_MINUTES * 60 * 1000;
const PAYOUT_COLUMNS = "id, restaurant_id, amount_cents, status, created_at, paid_at, order_count, gross_cents, payzu_fee_cents, discount_cents";
// The deploy manifest defines a fixed UTC time for the daily payout.
const [PAYOUT_HOUR_UTC, PAYOUT_MINUTE_UTC] = cronSchedule["daily-payout"].split(" ")[1].split(":").map(Number);

interface Payout {
    id: string;
    restaurant_id: string;
    amount_cents: number;
    status: string;
    created_at: string | null;
    paid_at: string | null;
    order_count: number;
    gross_cents: number | null;
    payzu_fee_cents: number | null;
    discount_cents: number | null;
}

type PendingPixOrder = {
    total_cents: number;
    created_at: string;
    payment_paid_at: string | null;
};

function payoutTimeOnUtcDay(date: Date) {
    return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), PAYOUT_HOUR_UTC, PAYOUT_MINUTE_UTC);
}

function forecastPayouts(orders: PendingPixOrder[], restaurantId: string, now: Date): Payout[] {
    const todaysRun = payoutTimeOnUtcDay(now);
    const nextRun = todaysRun < now.getTime() ? todaysRun + DAY_MS : todaysRun;
    const batches = new Map<number, { grossCents: number; orderCount: number }>();

    for (const order of orders) {
        const createdAt = Date.parse(order.created_at);
        const paidAt = order.payment_paid_at ? Date.parse(order.payment_paid_at) : createdAt;
        const eligibleAt = Math.max(createdAt, paidAt) + MARGIN_MS;
        const eligibleRun = payoutTimeOnUtcDay(new Date(eligibleAt));
        const runAt = Math.max(nextRun, eligibleRun < eligibleAt ? eligibleRun + DAY_MS : eligibleRun);
        const batch = batches.get(runAt) ?? { grossCents: 0, orderCount: 0 };
        batch.grossCents += order.total_cents;
        batch.orderCount++;
        batches.set(runAt, batch);
    }

    return [...batches.entries()].sort(([a], [b]) => a - b).map(([time, batch]) => {
        const { netCents, discountCents } = calculateOnePercentPayout(batch.grossCents, 0);
        return {
            id: `forecast-${time}`,
            restaurant_id: restaurantId,
            amount_cents: netCents,
            status: "forecast",
            created_at: new Date(time).toISOString(),
            paid_at: null,
            order_count: batch.orderCount,
            gross_cents: batch.grossCents,
            payzu_fee_cents: null,
            discount_cents: discountCents,
        };
    });
}

interface PayoutsDashboardProps {
    menuId: string;
    startDate?: string;
    endDate?: string;
}

const formatPrice = (priceInCents: number) =>
    (priceInCents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

const formatDateTime = (value: string | null) => {
    if (!value) return "—";

    return new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
        timeZone: BUSINESS_TIME_ZONE,
    }).format(new Date(value));
};

const getStatusPresentation = (status: string) => {
    if (status === "paid") {
        return {
            label: "Pago",
            dotClass: "bg-green-500",
            textClass: "text-green-700",
        };
    }

    if (status === "pending" || status === "forecast") {
        return {
            label: status === "forecast" ? "Previsto" : "A receber",
            dotClass: "bg-yellow-500",
            textClass: "text-yellow-700",
        };
    }

    if (status === "processing") {
        return {
            label: "Processando",
            dotClass: "bg-yellow-500",
            textClass: "text-yellow-700",
        };
    }

    if (status === "cancelled" || status === "failed") {
        return {
            label: status === "cancelled" ? "Cancelado" : "Falhou",
            dotClass: "bg-red-500",
            textClass: "text-red-700",
        };
    }

    return {
        label: status,
        dotClass: "bg-gray-400",
        textClass: "text-gray-600",
    };
};

const getFeesAndDiscounts = (payout: Payout) => {
    if (payout.gross_cents != null) {
        return Math.max(0, payout.gross_cents - payout.amount_cents);
    }

    if (payout.payzu_fee_cents != null || payout.discount_cents != null) {
        return Math.max(
            0,
            (payout.payzu_fee_cents || 0) + (payout.discount_cents || 0)
        );
    }

    return null;
};

export default function PayoutsDashboard({
    menuId,
    startDate,
    endDate,
}: PayoutsDashboardProps) {
    const [payouts, setPayouts] = useState<Payout[]>([]);
    const [lastPaidPayout, setLastPaidPayout] = useState<Payout | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);

    useEffect(() => {
        setPage(0);
    }, [startDate, endDate]);

    useEffect(() => {
        if (!menuId) return;

        const controller = new AbortController();
        const fetchPayouts = async () => {
            setIsLoading(true);
            setError(null);

            try {
                const { signal } = controller;
                const [latestPayoutResult, lastPaidResult] = await Promise.all([
                    supabase
                        .from("payouts")
                        .select("created_at")
                        .eq("restaurant_id", menuId)
                        .order("created_at", { ascending: false, nullsFirst: false })
                        .limit(1)
                        .abortSignal(signal)
                        .maybeSingle(),
                    supabase
                        .from("payouts")
                        .select(PAYOUT_COLUMNS)
                        .eq("restaurant_id", menuId)
                        .eq("status", "paid")
                        .order("created_at", { ascending: false, nullsFirst: false })
                        .limit(1)
                        .abortSignal(signal)
                        .maybeSingle(),
                ]);
                if (latestPayoutResult.error) throw latestPayoutResult.error;
                if (lastPaidResult.error) throw lastPaidResult.error;

                let ordersQuery = supabase
                    .from("orders")
                    .select("total_cents, created_at, payment_paid_at")
                    .eq("restaurant_id", menuId)
                    .eq("payment_method", "pix")
                    .not("payment_ref", "is", null)
                    .in("status", ["paid", "preparing", "delivering", "done"])
                    .order("id")
                    .abortSignal(signal);

                if (latestPayoutResult.data?.created_at) {
                    const cutoff = new Date(latestPayoutResult.data.created_at).toISOString();
                    ordersQuery = ordersQuery.or(`created_at.gt.${cutoff},payment_paid_at.gt.${cutoff}`);
                }

                const pendingOrders: PendingPixOrder[] = [];
                for (let offset = 0; ; offset += ORDER_BATCH_SIZE) {
                    const result = await ordersQuery.range(offset, offset + ORDER_BATCH_SIZE - 1);
                    if (result.error) throw result.error;
                    pendingOrders.push(...result.data);
                    if (result.data.length < ORDER_BATCH_SIZE) break;
                }

                const forecasts = forecastPayouts(pendingOrders, menuId, new Date());
                const offset = page * PAGE_SIZE;
                const forecastPage = forecasts.slice(offset, offset + PAGE_SIZE);
                const historySize = PAGE_SIZE - forecastPage.length;
                const historyOffset = Math.max(0, offset - forecasts.length);

                let historyQuery = supabase
                    .from("payouts")
                    .select(PAYOUT_COLUMNS, { count: "exact", head: historySize === 0 })
                    .eq("restaurant_id", menuId)
                    .order("created_at", { ascending: false })
                    .order("id")
                    .abortSignal(signal);

                if (startDate) historyQuery = historyQuery.gte("created_at", `${startDate}T00:00:00-03:00`);
                if (endDate) historyQuery = historyQuery.lte("created_at", `${endDate}T23:59:59.999-03:00`);
                if (historySize > 0) historyQuery = historyQuery.range(historyOffset, historyOffset + historySize - 1);

                const historyResult = await historyQuery;
                if (historyResult.error) throw historyResult.error;
                if (signal.aborted) return;

                const rowCount = forecasts.length + (historyResult.count ?? 0);
                const lastPage = Math.max(0, Math.ceil(rowCount / PAGE_SIZE) - 1);
                if (page > lastPage) {
                    setPage(lastPage);
                    return;
                }

                setPayouts([...forecastPage, ...(historyResult.data ?? [])]);
                setTotalCount(rowCount);
                setLastPaidPayout(lastPaidResult.data);
            } catch (caught) {
                if (controller.signal.aborted) return;
                console.error(caught);
                setError("Não foi possível carregar os repasses.");
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        void fetchPayouts();
        return () => controller.abort();
    }, [menuId, page, startDate, endDate]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Card>
                        <ListLoader lines={2} />
                    </Card>
                </div>
                <Card>
                    <ListLoader lines={4} />
                    <p className="mt-4 text-center text-gray-500">
                        Buscando repasses...
                    </p>
                </Card>
            </div>
        );
    }

    if (error) {
        return (
            <Card className="border-red-200 bg-red-50">
                <p className="text-sm text-red-600">{error}</p>
            </Card>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <Card>
                    <h2 className="!text-sm font-medium text-gray-500">
                        Último repasse
                    </h2>
                    <p className="mt-2 text-3xl font-medium tabular-nums tracking-tight text-gray-900">
                        {lastPaidPayout
                            ? formatPrice(lastPaidPayout.amount_cents)
                            : "—"}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        {lastPaidPayout
                            ? `Pago em ${formatDateTime(lastPaidPayout.paid_at || lastPaidPayout.created_at)}`
                            : "Nenhum repasse concluído ainda."}
                    </p>
                </Card>
            </div>

            <Card>
                <div className="mb-6">
                    <h2 className="text-lg font-bold text-gray-900 2xl:text-xl">
                        Repasses
                    </h2>
                    <p className="text-sm text-gray-500 2xl:text-base">
                        Pedidos confirmados após o horário de corte entram no repasse do dia seguinte. O filtro de datas se aplica ao histórico.
                    </p>
                </div>

                {payouts.length === 0 ? (
                    <div className="rounded-lg border-2 border-dashed border-gray-100 py-8 text-center text-gray-400 2xl:py-15 2xl:text-lg">
                        Nenhum repasse encontrado neste período.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[860px] text-left text-sm">
                            <thead>
                                <tr className="border-b border-gray-200 text-xs font-medium uppercase tracking-wide text-gray-500">
                                    <th className="px-3 py-3">Status</th>
                                    <th className="px-3 py-3">Data e hora</th>
                                    <th className="px-3 py-3 text-right">Pedidos</th>
                                    <th className="px-3 py-3 text-right">Valor bruto</th>
                                    <th className="px-3 py-3 text-right">
                                        <span className="inline-flex items-center justify-end gap-1.5">
                                            Taxa Pix (0,99%)
                                            <Tooltip
                                                text="A taxa de 0.99% é para processar pagamentos Pix, e é comum em outros sistemas de cardápios digitais."
                                                size="medium"
                                                showOnClick
                                                parentClassName="shrink-0 leading-none"
                                            >
                                                <button
                                                    type="button"
                                                    aria-label="Mais informações sobre a Taxa Pix"
                                                    className="inline-flex h-4 w-4 items-center justify-center text-gray-500 transition-colors hover:text-gray-700"
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faCircleInfo}
                                                        className="text-[13px]"
                                                    />
                                                </button>
                                            </Tooltip>
                                        </span>
                                    </th>
                                    <th className="px-3 py-3 text-right">Valor líquido</th>
                                </tr>
                            </thead>
                            <tbody>
                                {payouts.map((payout) => {
                                    const status =
                                        getStatusPresentation(payout.status);
                                    const feesAndDiscounts =
                                        getFeesAndDiscounts(payout);
                                    const eventDate =
                                        payout.status === "paid"
                                            ? payout.paid_at || payout.created_at
                                            : payout.created_at;

                                    return (
                                        <tr
                                            key={payout.id}
                                            className="border-b border-gray-100 last:border-b-0 hover:bg-gray-50"
                                        >
                                            <td className="px-3 py-4">
                                                <span
                                                    className={`inline-flex items-center gap-2 font-medium ${status.textClass}`}
                                                >
                                                    <span
                                                        className={`h-2.5 w-2.5 shrink-0 rounded-full ${status.dotClass}`}
                                                    />
                                                    {status.label}
                                                </span>
                                            </td>
                                            <td className="px-3 py-4 font-medium text-gray-700">
                                                {formatDateTime(eventDate)}
                                            </td>
                                            <td className="px-3 py-4 text-right tabular-nums text-gray-600">
                                                {payout.order_count}
                                            </td>
                                            <td className="px-3 py-4 text-right tabular-nums text-gray-600">
                                                {payout.gross_cents != null
                                                    ? formatPrice(
                                                          payout.gross_cents
                                                      )
                                                    : "—"}
                                            </td>
                                            <td className="px-3 py-4 text-right tabular-nums text-gray-600">
                                                {feesAndDiscounts != null
                                                    ? formatPrice(
                                                          feesAndDiscounts
                                                      )
                                                    : "—"}
                                            </td>
                                            <td className="px-3 py-4 text-right text-base font-semibold tabular-nums text-gray-900">
                                                {formatPrice(
                                                    payout.amount_cents
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}

                {(totalCount > PAGE_SIZE || page > 0) && (
                    <div className="mt-5">
                        <Pagination
                            page={page}
                            pageCount={Math.ceil(totalCount / PAGE_SIZE)}
                            onChange={setPage}
                            disabled={isLoading}
                        />
                    </div>
                )}
            </Card>
        </div>
    );
}
