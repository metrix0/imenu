"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import { formatCount } from "@/lib/dev/dashboardFormat";
import { TrafficBar } from "./TrafficSourcesSection";
import DevLoading from "./DevLoading";
import styles from "./dashboard.module.css";

type PathSource = "blog" | "menus" | "tools" | "content" | "other";
type PathRow = {
    source: PathSource;
    visitors: number;
    previousVisitors: number;
    sourceVisitors: number | null;
    homeClicks: number | null;
};
type PathData = { paths: PathRow[] };

const PATHS: { source: PathSource; label: string; info: string }[] = [
    { source: "blog", label: "Blog e artigos", info: "Chegadas à LP a partir do blog e de páginas classificadas como Conteúdo no painel antigo, incluindo /cardapio-digital. Abaixo: visitantes e cliques para a LP registrados no rastreamento de SEO." },
    { source: "menus", label: "Cardápios de restaurantes", info: "Pessoas que chegaram à página inicial vindas de URLs de cardápios, como o link no rodapé. Identificação pela estrutura da URL." },
    { source: "tools", label: "Ferramentas", info: "Pessoas vindas de páginas das ferramentas gratuitas do iMenu." },
    { source: "content", label: "Outras páginas SEO", info: "Chegadas à LP vindas de comparativos e demais páginas públicas fora dos artigos. Visitantes e cliques abaixo usam os eventos do painel anterior." },
    { source: "other", label: "Outras páginas iMenu", info: "Pessoas vindas de outras páginas internas identificadas pelo endereço de referência." },
];

export default function LandingPathsSection({ range }: { range: DateRange }) {
    const [data, setData] = useState<PathData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError("");
        const params = new URLSearchParams({ startDate: range.startDate, endDate: range.endDate });
        void devJson<PathData>("/api/dev/landing-paths?" + params, { signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) setData(result); })
            .catch(err => { if (!controller.signal.aborted) { setError(err.message); setData(null); } })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [range.startDate, range.endDate]);

    const rows = PATHS.map(path => ({
        ...path,
        visitors: data?.paths.find(row => row.source === path.source)?.visitors ?? 0,
        previousVisitors: data?.paths.find(row => row.source === path.source)?.previousVisitors ?? 0,
        sourceVisitors: data?.paths.find(row => row.source === path.source)?.sourceVisitors ?? null,
        homeClicks: data?.paths.find(row => row.source === path.source)?.homeClicks ?? null,
    }));
    const maxVisitors = Math.max(1, ...rows.map(row => row.visitors));

    return <section aria-label="Caminhos até a LP" className={styles.section}>
        <header className={styles.sectionHeader}>
            <h3 className="text-sm font-semibold text-gray-900">Caminhos até a LP</h3>
        </header>
        {error && <p role="alert" className="p-5 text-sm text-red-700">{error}</p>}
        {loading ? <DevLoading /> : !error && <div className="grid min-w-0 grid-cols-[max-content_minmax(0,1fr)] items-center gap-x-2 gap-y-2 p-5">
            {rows.map(row => <div key={row.source} className="contents">
                <TrafficBar label={row.label} info={row.info}
                    visitors={row.visitors} previousVisitors={row.previousVisitors} maxVisitors={maxVisitors} hideZeroChange />
                {row.sourceVisitors !== null && <p className="col-span-2 -mt-1 mb-1 text-[11px] text-gray-500">
                    {formatCount(row.sourceVisitors)} visitantes da origem · {formatCount(row.homeClicks ?? 0)} cliques para a LP
                </p>}
            </div>)}
        </div>}
    </section>;
}
