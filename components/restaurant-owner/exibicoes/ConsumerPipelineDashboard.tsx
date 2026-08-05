"use client";

import { useEffect, useMemo, useState } from "react";

import ConsumerPipelineCard from "@/components/analytics/ConsumerPipelineCard";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import { supabase } from "@/lib/database/supabaseClient";
import type { ConsumerPipelineStep } from "@/lib/analytics/consumerPipeline";

type Period = "today" | "7d" | "30d";

type ConsumerTrafficSource = {
    source: string;
    clicks: number;
    uniqueConsumers: number;
};

type Payload = {
    pipeline: ConsumerPipelineStep[];
    sources: ConsumerTrafficSource[];
    tracking: {
        postHogAvailable: boolean;
    };
};

const PERIODS: { value: Period; label: string; days: number }[] = [
    { value: "today", label: "Hoje", days: 1 },
    { value: "7d", label: "7 dias", days: 7 },
    { value: "30d", label: "1 mês", days: 30 },
];

function formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatCount(value: number): string {
    return value.toLocaleString("pt-BR");
}

export default function ConsumerPipelineDashboard({
    restaurantId,
}: {
    restaurantId: string;
}) {
    const [period, setPeriod] = useState<Period>("7d");
    const [data, setData] = useState<Payload | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    const range = useMemo(() => {
        const selected = PERIODS.find((item) => item.value === period);
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - ((selected?.days || 7) - 1));

        return {
            startDate: formatDate(start),
            endDate: formatDate(end),
        };
    }, [period]);

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

        const requestPipeline = (accessToken: string) =>
            fetch(
                `/api/restaurants/${restaurantId}/consumer-pipeline?from=${encodeURIComponent(
                    range.startDate
                )}&to=${encodeURIComponent(range.endDate)}`,
                {
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                    cache: "no-store",
                    signal: controller.signal,
                }
            );

        const load = async () => {
            setLoading(true);
            setError("");

            try {
                let accessToken = await getAccessToken();

                if (!accessToken) {
                    throw new Error("Faça login novamente para carregar o funil.");
                }

                let response = await requestPipeline(accessToken);

                if (response.status === 401) {
                    accessToken = await getAccessToken(true);

                    if (!accessToken) {
                        throw new Error("Sua sessão expirou. Entre novamente.");
                    }

                    response = await requestPipeline(accessToken);
                }

                const payload = (await response.json()) as Payload & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(
                        response.status === 401
                            ? "Sua sessão expirou. Entre novamente."
                            : payload.error || "Não foi possível carregar o funil."
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
                        : "Não foi possível carregar o funil."
                );
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        };

        void load();
        return () => controller.abort();
    }, [restaurantId, range.startDate, range.endDate]);

    const totalClicks =
        data?.sources.reduce((total, source) => total + source.clicks, 0) || 0;

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
                {PERIODS.map((item) => (
                    <button
                        key={item.value}
                        type="button"
                        onClick={() => setPeriod(item.value)}
                        className={`rounded-lg cursor-pointer px-4 py-2 text-sm font-medium transition ${
                            period === item.value
                                ? "bg-brand text-white"
                                : "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
                        }`}
                    >
                        {item.label}
                    </button>
                ))}
            </div>

            {loading && !data ? (
                <Card>
                    <ListLoader lines={4} />
                    <p className="mt-4 text-center text-gray-500">
                        Carregando funil do consumidor...
                    </p>
                </Card>
            ) : error && !data ? (
                <Card className="border-red-200 bg-red-50">
                    <p className="text-center text-red-600">{error}</p>
                </Card>
            ) : data ? (
                <>
                    <div className={loading ? "opacity-60" : "opacity-100"}>
                        <ConsumerPipelineCard
                            steps={data.pipeline}
                            postHogAvailable={data.tracking.postHogAvailable}
                            showTrackingNotice={false}
                        />
                    </div>

                    <Card className={loading ? "opacity-60" : "opacity-100"}>
                        <div className="mb-4">
                            <h3 className="text-lg font-semibold text-gray-900">
                                Cliques por origem
                            </h3>
                            <p className="mt-1 text-sm text-gray-500">
                                Usa utm_source; sem UTM, usa o domínio de referência.
                            </p>
                        </div>

                        {data.sources.length === 0 ? (
                            <p className="rounded-xl bg-gray-50 p-4 text-center text-sm text-gray-500">
                                Nenhum clique identificado no período.
                            </p>
                        ) : (
                            <div className="overflow-hidden rounded-xl border border-gray-200">
                                <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] gap-4 bg-gray-50 px-4 py-3 text-xs font-medium text-gray-500">
                                    <span>Origem</span>
                                    <span className="text-right">Cliques</span>
                                    <span className="text-right">%</span>
                                </div>

                                <div className="divide-y divide-gray-100">
                                    {data.sources.map((source) => (
                                        <div
                                            key={source.source}
                                            className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-4 px-4 py-3 text-sm"
                                        >
                                            <div className="min-w-0">
                                                <p className="truncate font-medium text-gray-800">
                                                    {source.source}
                                                </p>
                                                <p className="text-xs text-gray-500">
                                                    {formatCount(source.uniqueConsumers)} consumidores únicos
                                                </p>
                                            </div>
                                            <span className="text-right font-semibold text-gray-900">
                                                {formatCount(source.clicks)}
                                            </span>
                                            <span className="min-w-12 text-right text-gray-500">
                                                {totalClicks > 0
                                                    ? `${((source.clicks / totalClicks) * 100).toLocaleString(
                                                          "pt-BR",
                                                          {
                                                              maximumFractionDigits: 1,
                                                          }
                                                      )}%`
                                                    : "0%"}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>

                    {error && (
                        <p className="text-sm text-red-600">{error}</p>
                    )}
                </>
            ) : null}
        </div>
    );
}
