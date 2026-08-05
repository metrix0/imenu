"use client";

import { useEffect, useState } from "react";

import ConsumerPipelineCard from "@/components/analytics/ConsumerPipelineCard";
import Card from "@/components/ui/Card";
import ListLoader from "@/components/ui/ListLoader";
import { supabase } from "@/lib/database/supabaseClient";
import type { ConsumerPipelineStep } from "@/lib/analytics/consumerPipeline";

type Payload = {
    pipeline: ConsumerPipelineStep[];
    tracking: {
        postHogAvailable: boolean;
    };
};

export default function ConsumerPipelineDashboard({
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

    useEffect(() => {
        const controller = new AbortController();

        const load = async () => {
            setLoading(true);
            setError("");

            try {
                const {
                    data: { session },
                } = await supabase.auth.getSession();

                if (!session?.access_token) {
                    throw new Error("Faça login novamente para carregar o funil.");
                }

                const response = await fetch(
                    `/api/restaurants/${restaurantId}/consumer-pipeline?from=${encodeURIComponent(
                        startDate
                    )}&to=${encodeURIComponent(endDate)}`,
                    {
                        headers: {
                            Authorization: `Bearer ${session.access_token}`,
                        },
                        cache: "no-store",
                        signal: controller.signal,
                    }
                );
                const payload = (await response.json()) as Payload & {
                    error?: string;
                };

                if (!response.ok) {
                    throw new Error(
                        payload.error || "Não foi possível carregar o funil."
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
    }, [restaurantId, startDate, endDate]);

    if (loading && !data) {
        return (
            <Card>
                <ListLoader lines={4} />
                <p className="mt-4 text-center text-gray-500">
                    Carregando funil do consumidor...
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

    return data ? (
        <ConsumerPipelineCard
            steps={data.pipeline}
            postHogAvailable={data.tracking.postHogAvailable}
            showTrackingNotice={false}
        />
    ) : null;
}
