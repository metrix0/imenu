"use client";

import { useEffect, useState } from "react";
import { Bar } from "react-chartjs-2";
import { BarElement, CategoryScale, Chart as ChartJS, LinearScale, Tooltip, type ChartOptions } from "chart.js";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import { formatCount } from "@/lib/dev/dashboardFormat";
import DevLoading from "./DevLoading";
import styles from "./dashboard.module.css";

ChartJS.register(BarElement, CategoryScale, LinearScale, Tooltip);

type TrafficSource = { channel: string; visitors: number };
type TrafficSources = { channels: TrafficSource[] };

const CHANNEL_LABELS: Record<string, string> = {
    "Organic Search": "Busca orgânica",
    "Direct": "Direto",
    "AI": "Inteligência artificial",
    "Referral": "Referências",
    "Organic Social": "Redes sociais (orgânico)",
    "Paid Social": "Redes sociais (pago)",
    "Paid Search": "Busca paga",
    "Paid Unknown": "Anúncios (outros)",
    "Email": "E-mail",
    "Unknown": "Não identificado",
};

const options: ChartOptions<"bar"> = {
    indexAxis: "y",
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            callbacks: { label: context => formatCount(context.parsed.x) + " visitantes" },
        },
    },
    scales: {
        x: {
            beginAtZero: true,
            ticks: { precision: 0, color: "#626973" },
            grid: { color: "#f1f3f5" },
            border: { display: false },
        },
        y: {
            ticks: { autoSkip: false, color: "#626973" },
            grid: { display: false },
            border: { display: false },
        },
    },
};

export default function TrafficSourcesSection({ range }: { range: DateRange }) {
    const [data, setData] = useState<TrafficSources | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
        void devJson<TrafficSources>("/api/dev/traffic-sources?" + params, { signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) setData(result); })
            .catch(err => { if (!controller.signal.aborted) { setError(err.message); setData(null); } })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [range.startDate, range.endDate]);

    const channels = data?.channels ?? [];
    return <section aria-label="Origens do tráfego iMenu" className={styles.section}>
        <header className={styles.sectionHeader}>
            <div>
                <h3 className="text-sm font-semibold text-gray-900">Origem dos visitantes</h3>
                <p>Visitantes por canal · apenas páginas do iMenu em imenuapp.com.br, sem cardápios de restaurantes.</p>
            </div>
        </header>
        {error && <p role="alert" className="p-5 text-sm text-red-700">{error}</p>}
        {loading ? <DevLoading /> : !error && (channels.length ? (
            <div className="p-5">
                <div className="relative w-full" style={{ height: Math.max(220, channels.length * 38 + 36) }}>
                    <Bar
                        role="img"
                        aria-label="Visitantes por origem do tráfego"
                        data={{
                            labels: channels.map(item => CHANNEL_LABELS[item.channel] || item.channel),
                            datasets: [{
                                data: channels.map(item => item.visitors),
                                backgroundColor: "#d93d00",
                                hoverBackgroundColor: "#c43700",
                                borderRadius: 5,
                                barThickness: 20,
                            }],
                        }}
                        options={options}
                    />
                </div>
                <p className="mt-3 text-xs text-gray-500">
                    PostHog · Visitantes distintos por canal no período selecionado. Uma pessoa pode aparecer em mais de um canal.
                </p>
            </div>
        ) : <div className="p-5 text-sm text-gray-500">Nenhum dado no período.</div>)}
    </section>;
}
