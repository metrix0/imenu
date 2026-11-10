"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import { formatCount } from "@/lib/dev/dashboardFormat";
import InfoTooltip from "@/components/ui/Tooltip";
import { PanelIcon } from "@/components/ui/PanelIcon";
import { faCircleInfo } from "@fortawesome/free-solid-svg-icons";
import { ChevronDown } from "lucide-react";
import DevLoading from "./DevLoading";
import styles from "./dashboard.module.css";

type TrafficSource = { channel: string; visitors: number; sources: Array<{ source: string; visitors: number }> };
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

function TrafficBar({ label, visitors, maxVisitors, info, nested = false, expanded = false, onToggle }: {
    label: string;
    visitors: number;
    maxVisitors: number;
    info?: string;
    nested?: boolean;
    expanded?: boolean;
    onToggle?: () => void;
}) {
    return <div className="contents">
        <div className={`flex min-w-0 items-center justify-start gap-1.5 ${nested ? "pl-3" : ""}`}>
            {nested && <span aria-hidden="true" className="shrink-0 text-gray-400">↳</span>}
            {onToggle ? <button type="button" aria-expanded={expanded}
                aria-label={`${expanded ? "Recolher" : "Expandir"} origens de ${label}`}
                onClick={onToggle}
                className="flex min-w-0 items-center gap-1 text-left text-xs text-gray-700 hover:text-brand">
                <span className="min-w-0 max-w-[175px] truncate sm:max-w-[205px]" title={label}>{label}</span>
                <ChevronDown size={14} className={`shrink-0 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`} />
            </button> : <span className={`min-w-0 max-w-[175px] truncate text-left text-xs sm:max-w-[205px] ${nested ? "text-gray-500" : "text-gray-700"}`} title={label}>{label}</span>}
            {info && <InfoTooltip text={info} size="medium" showOnClick>
                <button type="button" aria-label={`Informações sobre ${label}`} className="inline-flex h-6 w-6 shrink-0 items-center justify-center text-gray-400 hover:text-brand">
                    <PanelIcon icon={faCircleInfo} className="h-3.5 w-3.5" />
                </button>
            </InfoTooltip>}
        </div>
        <div className={`relative min-w-0 rounded bg-[#f1f3f5] ${nested ? "h-3" : "h-5"}`}>
            <div className="absolute inset-y-0 left-0 right-16 flex items-center">
                <div aria-hidden="true" className={`h-full shrink-0 rounded ${nested ? "bg-[#f7a17c]" : "bg-[#d93d00]"}`}
                    style={{ width: (visitors / maxVisitors * 100) + "%", minWidth: visitors > 0 ? 2 : 0 }} />
                <span className="ml-2 shrink-0 whitespace-nowrap text-xs font-semibold tabular-nums text-gray-800">
                    {formatCount(visitors)}
                </span>
            </div>
        </div>
    </div>;
}

export default function TrafficSourcesSection({ range }: { range: DateRange }) {
    const [data, setData] = useState<TrafficSources | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expandedChannels, setExpandedChannels] = useState<string[]>([]);

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
            <div className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-2 gap-y-2 p-5">
                {channels.map(item => {
                    const label = CHANNELS[item.channel]?.label || item.channel;
                    const info = CHANNELS[item.channel]?.info || "Origem classificada pelo PostHog.";
                    const expanded = expandedChannels.includes(item.channel);
                    return <div key={item.channel} className="contents">
                        <TrafficBar label={label} visitors={item.visitors} maxVisitors={maxVisitors} info={info}
                            expanded={expanded}
                            onToggle={item.sources?.length ? () => setExpandedChannels(current =>
                                current.includes(item.channel) ? current.filter(channel => channel !== item.channel) : [...current, item.channel]
                            ) : undefined} />
                        {expanded && item.sources?.map(source => (
                            <TrafficBar key={source.source} nested label={source.source}
                                visitors={source.visitors} maxVisitors={maxVisitors} />
                        ))}
                    </div>;
                })}
            </div>
        ) : <div className="p-5 text-sm text-gray-500">Nenhum dado no período.</div>)}
    </section>;
}
