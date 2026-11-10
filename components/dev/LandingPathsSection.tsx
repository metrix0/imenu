"use client";

import { useEffect, useState } from "react";
import type { DateRange } from "@/lib/utils/dateRange";
import { devJson } from "@/lib/dev/client";
import { TrafficBar } from "./TrafficSourcesSection";
import DevLoading from "./DevLoading";
import styles from "./dashboard.module.css";

type PathSource = "blog" | "menus" | "tools" | "content" | "other";
type PathDetail = { path: string; visitors: number; previousVisitors: number };
type PathRow = { source: PathSource; visitors: number; previousVisitors: number; pages: PathDetail[] };
type PathData = { paths: PathRow[] };

const PATHS: { source: PathSource; label: string; info: string }[] = [
    { source: "blog", label: "Blog e artigos", info: "Pessoas que clicaram para ir à LP a partir de artigos e páginas de conteúdo do iMenu." },
    { source: "menus", label: "Cardápios de restaurantes", info: "Pessoas que chegaram à página inicial vindas de URLs de cardápios, como o link no rodapé. Identificação pela estrutura da URL." },
    { source: "tools", label: "Ferramentas", info: "Pessoas que clicaram para ir à LP a partir das ferramentas gratuitas do iMenu." },
    { source: "content", label: "Outras páginas SEO", info: "Pessoas que clicaram para ir à LP a partir de comparativos e outras páginas SEO." },
    { source: "other", label: "Outras páginas iMenu", info: "Pessoas vindas de outras páginas internas identificadas pelo endereço de referência." },
];

export default function LandingPathsSection({ range }: { range: DateRange }) {
    const [data, setData] = useState<PathData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [expanded, setExpanded] = useState<PathSource[]>([]);

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
        pages: data?.paths.find(row => row.source === path.source)?.pages ?? [],
    }));
    const maxVisitors = Math.max(1, ...rows.map(row => row.visitors));

    return <section aria-label="Caminhos até a LP" className={styles.section}>
        <header className={styles.sectionHeader}>
            <h3 className="text-sm font-semibold text-gray-900">Caminhos até a LP</h3>
        </header>
        {error && <p role="alert" className="p-5 text-sm text-red-700">{error}</p>}
        {loading ? <DevLoading /> : !error && <div className="grid min-w-0 grid-cols-[minmax(0,155px)_minmax(0,1fr)] items-center gap-x-2 gap-y-2 p-5 sm:grid-cols-[minmax(0,215px)_minmax(0,1fr)]">
            {rows.map(row => {
                const isExpanded = expanded.includes(row.source);
                return <div key={row.source} className="contents">
                    <TrafficBar label={row.label} info={row.info}
                        visitors={row.visitors} previousVisitors={row.previousVisitors}
                        maxVisitors={maxVisitors} hideZeroChange
                        expanded={isExpanded}
                        onToggle={row.pages.length ? () => setExpanded(current =>
                            current.includes(row.source)
                                ? current.filter(source => source !== row.source)
                                : [...current, row.source]
                        ) : undefined} />
                    {isExpanded && row.pages.map(page => (
                        <TrafficBar key={page.path} nested label={page.path}
                            visitors={page.visitors} previousVisitors={page.previousVisitors}
                            maxVisitors={maxVisitors} hideZeroChange />
                    ))}
                </div>;
            })}
        </div>}
    </section>;
}
