"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import { formatCount } from "@/lib/dev/dashboardFormat";
import InfoTooltip from "@/components/ui/Tooltip";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import DevLoading from "./DevLoading";
import styles from "./dashboard.module.css";

type TrafficSource = { channel: string; visitors: number };
type TrafficSources = { channels: TrafficSource[] };

const CHANNELS: Record<string, { label: string; info: string }> = {
    "Organic Search": { label: "Busca orgânica", info: "Visitas não pagas do Google, Bing e outros buscadores." },
    "Direct": { label: "Direto", info: "Acessos sem referência identificada, como favoritos ou links diretos." },
    "AI": { label: "Inteligência artificial", info: "Links vindos de assistentes de IA, como ChatGPT ou Gemini." },
    "Referral": { label: "Referências", info: "Links de outros sites, fora de buscas e redes sociais." },
    "Organic Social": { label: "Redes sociais (orgânico)", info: "Links compartilhados em redes sociais, sem anúncios." },
    "Paid Social": { label: "Redes sociais (pago)", info: "Visitas de anúncios pagos em redes sociais." },
    "Paid Search": { label: "Busca paga", info: "Visitas de anúncios pagos em buscadores." },
    "Paid Unknown": { label: "Anúncios (outros)", info: "Tráfego pago sem canal mais específico." },
    "Email": { label: "E-mail", info: "Links acessados por campanhas de e-mail." },
    "Unknown": { label: "Não identificado", info: "O PostHog não conseguiu classificar a origem." },
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
    const maxVisitors = Math.max(1, ...channels.map(item => item.visitors));
    return <section aria-label="Origens do tráfego iMenu" className={styles.section}>
        <header className={styles.sectionHeader}>
            <h3 className="text-sm font-semibold text-gray-900">Origem dos visitantes</h3>
        </header>
        {error && <p role="alert" className="p-5 text-sm text-red-700">{error}</p>}
        {loading ? <DevLoading /> : !error && (channels.length ? (
            <div className="space-y-3 p-5">
                {channels.map(item => {
                    const label = CHANNELS[item.channel]?.label || item.channel;
                    const info = CHANNELS[item.channel]?.info || "Origem classificada pelo PostHog.";
                    return <div key={item.channel} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 sm:grid-cols-[minmax(160px,230px)_minmax(0,1fr)_auto]">
                        <div className="flex min-w-0 items-center gap-1.5">
                            <span className="min-w-0 truncate text-xs text-gray-700" title={label}>{label}</span>
                            <InfoTooltip text={info} size="medium" showOnClick>
                                <button type="button" aria-label={`Informações sobre ${label}`} className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-gray-400 hover:text-brand">
                                    <PanelIcon icon={faCircleInfo} className="h-3.5 w-3.5" />
                                </button>
                            </InfoTooltip>
                        </div>
                        <div aria-hidden="true" className="col-span-2 h-5 overflow-hidden rounded bg-[#f1f3f5] sm:col-span-1 sm:col-start-2 sm:row-start-1">
                            <div className="h-full rounded bg-[#d93d00]" style={{ width: (item.visitors / maxVisitors * 100) + "%" }} />
                        </div>
                        <span className="col-start-2 row-start-1 whitespace-nowrap text-right text-xs font-semibold tabular-nums text-gray-800 sm:col-start-3">
                            {formatCount(item.visitors)}
                        </span>
                    </div>;
                })}
            </div>
        ) : <div className="p-5 text-sm text-gray-500">Nenhum dado no período.</div>)}
    </section>;
}
