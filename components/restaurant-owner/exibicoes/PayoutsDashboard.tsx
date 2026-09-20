"use client";

import { useEffect, useState } from "react";

import { supabase } from "@/lib/database/supabaseClient";
import { calculateOnePercentPayout } from "@/lib/services/payoutSafety";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import Pagination from "@/components/ui/Pagination";

const PAGE_SIZE = 5;
const BUSINESS_TIME_ZONE = "America/Sao_Paulo";

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

    if (status === "pending") {
        return {
            label: "A receber",
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
    const [dueCents, setDueCents] = useState(0);
    const [dueOrderCount, setDueOrderCount] = useState(0);
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

        const fetchPayouts = async () => {
            setIsLoading(true);
            setError(null);

            try {
                let historyQuery = supabase
                    .from("payouts")
                    .select(
                        "id, restaurant_id, amount_cents, status, created_at, paid_at, order_count, gross_cents, payzu_fee_cents, discount_cents",
                        { count: "exact" }
                    )
                    .eq("restaurant_id", menuId)
                    .order("created_at", { ascending: false })
                    .range(
                        page * PAGE_SIZE,
                        (page + 1) * PAGE_SIZE - 1
                    );

                if (startDate) {
                    historyQuery = historyQuery.gte(
                        "created_at",
                        `${startDate}T00:00:00-03:00`
                    );
                }

                if (endDate) {
                    historyQuery = historyQuery.lte(
                        "created_at",
                        `${endDate}T23:59:59.999-03:00`
                    );
                }

                const [historyResult, latestPayoutResult, lastPaidResult] =
                    await Promise.all([
                        historyQuery,
                        supabase
                            .from("payouts")
                            .select("created_at")
                            .eq("restaurant_id", menuId)
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle(),
                        supabase
                            .from("payouts")
                            .select(
                                "id, restaurant_id, amount_cents, status, created_at, paid_at, order_count, gross_cents, payzu_fee_cents, discount_cents"
                            )
                            .eq("restaurant_id", menuId)
                            .eq("status", "paid")
                            .order("created_at", { ascending: false })
                            .limit(1)
                            .maybeSingle(),
                    ]);

                if (historyResult.error) throw historyResult.error;
                if (latestPayoutResult.error) throw latestPayoutResult.error;
                if (lastPaidResult.error) throw lastPaidResult.error;

                let dueOrdersQuery = supabase
                    .from("orders")
                    .select("total_cents")
                    .eq("restaurant_id", menuId)
                    .eq("payment_method", "pix")
                    .not("payment_ref", "is", null)
                    .in("status", ["paid", "preparing", "delivering", "done"]);

                if (latestPayoutResult.data?.created_at) {
                    dueOrdersQuery = dueOrdersQuery.gt(
                        "created_at",
                        latestPayoutResult.data.created_at
                    );
                }

                const dueOrdersResult = await dueOrdersQuery;
                if (dueOrdersResult.error) throw dueOrdersResult.error;

                const dueOrders = dueOrdersResult.data || [];
                const grossDueCents = dueOrders.reduce(
                    (sum, order) => sum + Number(order.total_cents || 0),
                    0
                );
                const { netCents } = calculateOnePercentPayout(
                    grossDueCents,
                    dueOrders.length
                );

                setPayouts((historyResult.data || []) as Payout[]);
                setTotalCount(
                    historyResult.count ?? historyResult.data?.length ?? 0
                );
                setDueCents(netCents);
                setDueOrderCount(dueOrders.length);
                setLastPaidPayout(
                    (lastPaidResult.data as Payout | null) || null
                );
            } catch (caught) {
                console.error(caught);
                setError("Não foi possível carregar os repasses.");
            } finally {
                setIsLoading(false);
            }
        };

        void fetchPayouts();
    }, [menuId, page, startDate, endDate]);

    if (isLoading) {
        return (
            <div className="space-y-4">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <Card>
                        <ListLoader lines={2} />
                    </Card>
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
                        Repasse a receber
                    </h2>
                    <p className="mt-2 text-3xl font-medium tabular-nums tracking-tight text-gray-900">
                        {formatPrice(dueCents)}
                    </p>
                    <p className="mt-2 text-sm text-gray-500">
                        {dueOrderCount > 0
                            ? `${dueOrderCount} ${dueOrderCount === 1 ? "pedido via Pix aguardando" : "pedidos via Pix aguardando"} o próximo repasse.`
                            : "Nenhum valor pendente para repasse."}
                    </p>
                </Card>

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
                        Histórico de Repasses
                    </h2>
                    <p className="text-sm text-gray-500 2xl:text-base">
                        Repasses diários às 12:00. Veja o horário, status e composição de cada repasse.
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
                                    <th className="px-3 py-3 text-right">Taxas/descontos</th>
                                    <th className="px-3 py-3 text-right">Valor repassado</th>
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
