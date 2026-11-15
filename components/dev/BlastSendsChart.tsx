"use client";

import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend } from "chart.js";
import { devJson } from "@/lib/dev/client";
import { MetricChart } from "./DashboardPresentation";
import DevLoading from "./DevLoading";

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip, Legend);

type DailySends = { label: string; support: number; blast: number };

export default function BlastSendsChart({ refreshKey }: { refreshKey: number }) {
    const [rows, setRows] = useState<DailySends[] | null>(null);
    const [error, setError] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        setError(false);
        void devJson<DailySends[]>("/api/dev/support?section=blast-sends", { signal: controller.signal })
            .then(data => { if (!controller.signal.aborted) setRows(data); })
            .catch(() => { if (!controller.signal.aborted) setError(true); });
        return () => controller.abort();
    }, [refreshKey]);

    if (error) return <p role="alert" className="text-sm text-red-700">Não foi possível carregar os envios por dia.</p>;
    if (!rows) return <DevLoading />;

    return <MetricChart
        title="Disparos enviados por dia · Últimos 30 dias"
        seriesLabel="Suporte"
        series={rows.map(({ label, support }) => ({ label, value: support }))}
        color="#2563eb"
        secondaryLabel="Blast"
        secondarySeries={rows.map(({ label, blast }) => ({ label, value: blast }))}
        secondaryColor="#d93d00"
        labelTooltip
    />;
}
