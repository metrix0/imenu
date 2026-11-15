"use client";

import { useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip } from "chart.js";
import { Line } from "react-chartjs-2";
import DataTable from "@/components/ui/DataTable";
import Dropdown from "@/components/ui/Dropdown";
import { CHART_BRAND, CHART_CATEGORY_AXIS, CHART_VALUE_AXIS, STANDARD_CHART_TOOLTIP, createBrandAreaGradient } from "@/components/restaurant-owner/exibicoes/chartStyles";
import Badge from "@/components/ui/Badge";
import PagedTable, { type PageData } from "./PagedTable";
import DevLoading from "./DevLoading";
import DevDialog from "./DevDialog";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents, formatDateTime, formatCount, formatRatio } from "@/lib/dev/dashboardFormat";
import { useDevProfile } from "./DevProfileProvider";
import styles from "./dashboard.module.css";

type Analysis = {
    id: string;
    restaurantId: string;
    restaurantName: string;
    finishedAt: string;
    activatedAt: string | null;
    potentialCents: number | null;
    snapshotGmvCents: number | null;
    snapshotDays: number | null;
};
type Missing = {
    addonId: string;
    restaurantId: string;
    restaurantName: string;
    activatedAt: string;
    waitingSeconds: number;
    latestAttemptAt: string | null;
    latestAttemptStatus: string | null;
    alertCount: number;
    latestAlarmAt: string | null;
};
type MenuScans = {
    restaurantsTried: number;
    restaurantsCompleted: number;
    fallbackAttempts: number;
    history: PageData<{
        id: string;
        restaurant_id: string;
        restaurant_name: string;
        created_at: string;
        input_type: "link" | "files";
        outcome: "success" | "empty" | "failed";
        items: number | null;
        provider: "Gemini" | "OpenAI" | null;
    }>;
};

type MenuScanRow = MenuScans["history"]["rows"][number];
type MenuScanDetails = {
    sourceUrl: string | null;
    linkDomain: string | null;
    files: { name: string; url: string | null }[];
    elapsedMs: number;
    geminiError: string | null;
    openAiError: string | null;
    excerpt: string | null;
};

const scanOutcomes = {
    success: { label: "Concluído", variant: "success" },
    empty: { label: "Sem produtos", variant: "warning" },
    failed: { label: "Falhou", variant: "danger" },
} as const;

type OpenAiCosts =
    | { status: "unconfigured" | "unavailable" }
    | {
        status: "ok";
        period: { start: string; end: string; days: number };
        averageDaily7dUsd: number;
        usdBrlRate: number;
        totalUsd: number;
        daily: { date: string; usd: number }[];
        models?: { id: string; dailyUsd: number[] }[];
        breakdown: { label: string; usd: number; share: number; usage: string }[];
    };

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip);

const brlFormatter = new Intl.NumberFormat("pt-BR", {
    style: "currency", currency: "BRL",
    minimumFractionDigits: 2, maximumFractionDigits: 2,
});
function formatBrl(value: number) {
    return Number.isFinite(value) ? brlFormatter.format(value) : "—";
}
const percentageFormatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
const dayLabel = (day: string) =>
    new Date(day + "T12:00:00Z").toLocaleDateString("pt-BR", { timeZone: "UTC", day: "2-digit", month: "2-digit" });

type QualityAssurance = {
    summary: {
        averagePotentialCents: number | null;
        restaurantsWithPotential: number;
        averageFirstAnalysisMinutes: number | null;
        measuredActivations: number;
    };
    analyses: PageData<Analysis>;
    missing: Missing[];
};

function duration(minutes: number | null) {
    if (minutes === null || !Number.isFinite(minutes) || minutes < 0) return "—";
    const rounded = Math.round(minutes);
    if (rounded < 60) return String(rounded) + " min";
    const hours = Math.floor(rounded / 60);
    const rest = rounded % 60;
    if (hours < 24) return String(hours) + "h " + String(rest) + "min";
    return String(Math.floor(hours / 24)) + "d " + String(hours % 24) + "h";
}
const attemptLabel: Record<string, string> = {
    completed: "Sem relatório válido", running: "Em andamento", failed: "Falhou", pending: "Pendente",
};

export default function QualityAssuranceSection() {
    const [page, setPage] = useState(0);
    const [missingPage, setMissingPage] = useState(0);
    const [scanPage, setScanPage] = useState(0);
    const [scans, setScans] = useState<MenuScans | null>(null);
    const [scanLoading, setScanLoading] = useState(true);
    const [scanError, setScanError] = useState(false);
    const [selectedScan, setSelectedScan] = useState<MenuScanRow | null>(null);
    const [data, setData] = useState<QualityAssurance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [costs, setCosts] = useState<OpenAiCosts | null>(null);
    const [selectedModel, setSelectedModel] = useState("");
    const { openProfile } = useDevProfile();

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        void devJson<QualityAssurance>("/api/dev/quality-assurance?page=" + page, { signal: controller.signal })
            .then(result => { setData(result); setError(""); })
            .catch(caught => { if (!controller.signal.aborted) setError(caught.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page]);

    useEffect(() => {
        const controller = new AbortController();
        setScanLoading(true);
        setScanError(false);
        void devJson<MenuScans>("/api/dev/quality-assurance/menu-scans?page=" + scanPage, { signal: controller.signal })
            .then(result => { if (!controller.signal.aborted) setScans(result); })
            .catch(() => { if (!controller.signal.aborted) setScanError(true); })
            .finally(() => { if (!controller.signal.aborted) setScanLoading(false); });
        return () => controller.abort();
    }, [scanPage]);

    useEffect(() => {
        const controller = new AbortController();
        void devJson<OpenAiCosts>("/api/dev/quality-assurance/costs", { signal: controller.signal })
            .then(result => {
                // A partial/stale API response must not display R$ NaN.
                if (result.status === "ok" &&
                    (!Number.isFinite(result.usdBrlRate) || result.usdBrlRate <= 0 ||
                     !Number.isFinite(result.averageDaily7dUsd) || !Number.isFinite(result.totalUsd))) {
                    setCosts({ status: "unavailable" });
                    return;
                }
                setCosts(result);
            })
            .catch(() => {
                if (!controller.signal.aborted) setCosts({ status: "unavailable" });
            });
        return () => controller.abort();
    }, []);

    const openRestaurant = (restaurantId: string, restaurantName: string) =>
        openProfile({ id: restaurantId, name: restaurantName });

    const models = costs?.status === "ok" ? costs.models ?? [] : [];
    const modelDailyUsd = models.find(model => model.id === selectedModel)?.dailyUsd;
    const modelTotalUsd = modelDailyUsd?.reduce((sum, usd) => sum + usd, 0);

    if (!data && loading) return <DevLoading />;

    return <div className="space-y-6">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {data && <>
            <dl className={styles.metricStrip}>
                <div>
                    <dt>Potencial médio (não zero)</dt>
                    <dd>{data.summary.averagePotentialCents === null ? "—" : formatCurrencyFromCents(data.summary.averagePotentialCents)}</dd>
                    <p>Último relatório de {formatCount(data.summary.restaurantsWithPotential)} restaurantes · 30 dias</p>
                </div>
                <div>
                    <dt>Tempo médio até a primeira análise após o Plus</dt>
                    <dd>{duration(data.summary.averageFirstAnalysisMinutes)}</dd>
                    <p>{formatCount(data.summary.measuredActivations)} ativações com análise concluída</p>
                </div>
                <div>
                    <dt>Gasto médio diário OpenAI</dt>
                    <dd>{costs?.status === "ok" ? formatBrl(costs.averageDaily7dUsd * costs.usdBrlRate) : "—"}</dd>
                    <p>
                        7 dias completos ({costs?.status === "ok" ? formatBrl(costs.averageDaily7dUsd * 7 * costs.usdBrlRate) : "—"}) · 1 USD = {costs?.status === "ok" ? formatBrl(costs.usdBrlRate) : "—"}
                    </p>
                </div>
            </dl>
            <section className={`${styles.tableSection} ${styles.fitTable}`}>
                <h2>Análises Vendas IA <span className="font-normal text-gray-500">({data.analyses.total})</span></h2>
                <p className="mb-4 text-xs text-gray-500">Últimos 90 dias · GMV registrado no relatório, sem frete. Uma linha por análise concluída.</p>
                <div>
                    <PagedTable data={data.analyses} loading={loading} onPage={setPage}
                        rowKey={row => row.id}
                        onRowClick={row => openRestaurant(row.restaurantId, row.restaurantName)}
                        columns={[
                            { key: "restaurant", label: "Restaurante", render: row => <span title={row.restaurantName} className="block max-w-64 truncate whitespace-nowrap font-medium">{row.restaurantName}</span> },
                            { key: "saved", label: "Salvo em", className: "whitespace-nowrap", render: row => formatDateTime(row.finishedAt) },
                            { key: "potential", label: "Potencial estimado", className: "whitespace-nowrap", render: row => row.potentialCents === null ? "—" : formatCurrencyFromCents(row.potentialCents) },
                            { key: "gmv", label: "GMV no relatório", className: "whitespace-nowrap", render: row => row.snapshotGmvCents === null ? "—" : formatCurrencyFromCents(row.snapshotGmvCents) },
                            { key: "window", label: "Período GMV", className: "whitespace-nowrap", render: row => row.snapshotDays === null ? "—" : String(row.snapshotDays) + " dias" },
                            { key: "activated", label: "Plus ativado em", className: "whitespace-nowrap", render: row => formatDateTime(row.activatedAt) },
                            { key: "elapsed", label: "Tempo após Plus", className: "whitespace-nowrap", render: row => row.activatedAt ? duration((new Date(row.finishedAt).getTime() - new Date(row.activatedAt).getTime()) / 60000) : "—" },
                        ]} />
                </div>
            </section>
            <section className={`${styles.tableSection} ${styles.fitTable}`}>
                <h2>Restaurantes Plus sem análise <span className="font-normal text-gray-500">({data.missing.length})</span></h2>
                <div>
                    <PagedTable data={{ rows: data.missing.slice(missingPage * 10, (missingPage + 1) * 10), total: data.missing.length, page: missingPage, pageCount: Math.max(1, Math.ceil(data.missing.length / 10)) }}
                        rowKey={row => row.addonId}
                        onPage={setMissingPage}
                        onRowClick={row => openRestaurant(row.restaurantId, row.restaurantName)}
                        columns={[
                            { key: "restaurant", label: "Restaurante", render: row => <span title={row.restaurantName} className="block max-w-64 truncate whitespace-nowrap font-medium">{row.restaurantName}</span> },
                            { key: "activated", label: "Plus ativado em", className: "whitespace-nowrap", render: row => formatDateTime(row.activatedAt) },
                            { key: "waiting", label: "Aguardando há", className: "whitespace-nowrap", render: row => duration(row.waitingSeconds / 60) },
                            { key: "lastAttempt", label: "Última tentativa", className: "whitespace-nowrap", render: row => formatDateTime(row.latestAttemptAt) },
                            { key: "status", label: "Status", className: "whitespace-nowrap", render: row => row.latestAttemptStatus ? (attemptLabel[row.latestAttemptStatus] || row.latestAttemptStatus) : "Sem tentativa" },
                            { key: "alarm", label: "Alarme disparado", className: "whitespace-nowrap", render: row => <Badge variant={row.alertCount > 0 ? "danger" : "neutral"}>{row.alertCount > 0 ? "Sim" : "Não"}</Badge> },
                            { key: "alarmCount", label: "Disparos", className: "whitespace-nowrap", render: row => formatCount(row.alertCount) },
                            { key: "lastAlarm", label: "Último alarme", className: "whitespace-nowrap", render: row => formatDateTime(row.latestAlarmAt) },
                        ]} />
                </div>
            </section>
            <section className={`${styles.tableSection} ${styles.fitTable}`}>
                <h2>Scans de cardápio</h2>
                {scanError ? <p role="alert" className="my-4 text-sm text-red-700">Não foi possível carregar os scans.</p>
                    : scans === null ? <DevLoading /> : <>
                        <dl className={styles.metricStrip}>
                            <div>
                                <dt>Restaurantes que tentaram</dt>
                                <dd>{formatCount(scans.restaurantsTried)}</dd>
                            </div>
                            <div>
                                <dt>Taxa de sucesso por restaurante</dt>
                                <dd>{scans.restaurantsTried ? formatRatio(100 * scans.restaurantsCompleted / scans.restaurantsTried) : "—"}</dd>
                            </div>
                            <div>
                                <dt>Taxa de fallback</dt>
                                <dd>{scans.history.total ? formatRatio(100 * scans.fallbackAttempts / scans.history.total) : "—"}</dd>
                            </div>
                        </dl>
                        <PagedTable data={scans.history} loading={scanLoading} onPage={setScanPage}
                            rowKey={row => row.id}
                            onRowClick={setSelectedScan}
                            columns={[
                                { key: "date", label: "Data", render: row => formatDateTime(row.created_at) },
                                { key: "restaurant", label: "Restaurante", render: row => <button type="button"
                                    title={row.restaurant_name} className="block max-w-full cursor-pointer truncate text-left font-medium hover:underline"
                                    onClick={event => { event.stopPropagation(); openRestaurant(row.restaurant_id, row.restaurant_name); }}>
                                    {row.restaurant_name}
                                </button> },
                                { key: "input", label: "Origem", render: row => row.input_type === "link" ? "Link" : "Foto / PDF" },
                                { key: "outcome", label: "Resultado", render: row => <Badge variant={scanOutcomes[row.outcome].variant}>{scanOutcomes[row.outcome].label}</Badge> },
                                { key: "items", label: "Produtos", render: row => row.items == null ? "—" : formatCount(row.items) },
                                { key: "provider", label: "IA", render: row => row.provider ?? "—" },
                            ]} />
                    </>}
            </section>
            {selectedScan && <MenuScanDialog key={selectedScan.id} scan={selectedScan} onClose={() => setSelectedScan(null)} />}
            <section className={`${styles.tableSection} ${styles.fitTable}`}>
                <h2>Gastos OpenAI</h2>
                {costs === null ? <div className={styles.section}><div className="p-6"><DevLoading /></div></div>
                    : costs.status !== "ok" ? <div className={styles.section}>
                        <p className="p-6 text-sm text-gray-500">{costs.status === "unconfigured"
                            ? "Consulta de custos OpenAI não configurada."
                            : "Não foi possível consultar os gastos OpenAI."}</p>
                    </div> : <>
                        <div className={styles.chart}>
                            <div className="flex flex-wrap items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold text-[#1d1d1d]">Gasto por dia</h3>
                                <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
                                    <span className="text-sm font-medium tabular-nums">
                                        {formatBrl((modelTotalUsd ?? costs.totalUsd) * costs.usdBrlRate)} no período
                                    </span>
                                    <div className="w-56 max-w-full">
                                        <Dropdown aria-label="Modelo OpenAI" value={selectedModel}
                                            onChange={event => setSelectedModel(event.target.value)}
                                            options={[{ value: "", label: "Todos" }, ...models.map(model => ({ value: model.id, label: model.id }))]}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div className="mt-5 h-[240px] min-w-0 sm:h-[300px]">
                                <Line
                                    data={{
                                        labels: costs.daily.map(point => dayLabel(point.date)),
                                        datasets: [{
                                            label: "Gasto (R$)",
                                            data: costs.daily.map((point, index) => (modelDailyUsd?.[index] ?? point.usd) * costs.usdBrlRate),
                                            borderColor: CHART_BRAND,
                                            backgroundColor: createBrandAreaGradient,
                                            fill: true, tension: 0.25, pointRadius: 2, pointHoverRadius: 5,
                                        }],
                                    }}
                                    options={{
                                        responsive: true, maintainAspectRatio: false, animation: false,
                                        interaction: { mode: "index", intersect: false },
                                        plugins: {
                                            legend: { display: false },
                                            tooltip: {
                                                ...STANDARD_CHART_TOOLTIP,
                                                callbacks: {
                                                    label: context => formatBrl(Number(context.parsed.y) || 0),
                                                },
                                            },
                                        },
                                        scales: {
                                            x: { ...CHART_CATEGORY_AXIS, ticks: { ...CHART_CATEGORY_AXIS.ticks, maxTicksLimit: 8 } },
                                            y: {
                                                ...CHART_VALUE_AXIS,
                                                ticks: {
                                                    ...CHART_VALUE_AXIS.ticks, maxTicksLimit: 5,
                                                    callback: value => formatBrl(Number(value) || 0),
                                                },
                                            },
                                        },
                                    }}
                                />
                            </div>
                        </div>
                        <div className="mt-5">
                            <h3 className="mb-3 text-sm font-semibold">Fontes de custo</h3>
                            <div className={styles.section}>
                                <DataTable
                                    rows={costs.breakdown}
                                    rowKey={row => row.label}
                                    emptyMessage="Nenhum gasto registrado no período."
                                    columns={[
                                        { key: "item", label: "Item cobrado pela OpenAI", render: row => <span className="break-words">{row.label}</span> },
                                        { key: "usage", label: "Uso no iMenu", render: row => <span title={row.usage}>{row.usage}</span> },
                                        { key: "cost", label: "Gasto (R$)", className: "whitespace-nowrap", render: row => formatBrl(row.usd * costs.usdBrlRate) },
                                        { key: "daily", label: "Média diária (R$)", className: "whitespace-nowrap", render: row => formatBrl(row.usd * costs.usdBrlRate / costs.period.days) },
                                        { key: "share", label: "% do total", className: "whitespace-nowrap", render: row => percentageFormatter.format(row.share) + "%" },
                                    ]}
                                />
                            </div>
                        </div>
                    </>}
            </section>
        </>}
    </div>;
}

function MenuScanDialog({ scan, onClose }: { scan: MenuScanRow; onClose: () => void }) {
    const [details, setDetails] = useState<MenuScanDetails | null>(null);
    const [failed, setFailed] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        void devJson<MenuScanDetails>("/api/dev/quality-assurance/menu-scans?scanId=" + encodeURIComponent(scan.id), {
            signal: controller.signal,
        }).then(result => {
            if (!controller.signal.aborted) setDetails(result);
        }).catch(() => {
            if (!controller.signal.aborted) setFailed(true);
        });
        return () => controller.abort();
    }, [scan.id]);

    return <DevDialog open onClose={onClose} title="Detalhes do scan"
        description={scan.restaurant_name + " · " + formatDateTime(scan.created_at)}>
        <div className="space-y-4 text-sm">
            <div className="flex flex-wrap items-center gap-2">
                <Badge variant={scanOutcomes[scan.outcome].variant}>{scanOutcomes[scan.outcome].label}</Badge>
                <span>{scan.input_type === "link" ? "Link" : "Foto / PDF"}</span>
                {scan.items != null && <span>· {formatCount(scan.items)} produtos</span>}
                {scan.provider && <span>· {scan.provider}</span>}
                {details && <span>· {(details.elapsedMs / 1000).toLocaleString("pt-BR", { maximumFractionDigits: 1 })} s</span>}
            </div>
            {failed ? <p role="alert" className="text-red-700">Não foi possível carregar os detalhes do scan.</p>
                : !details ? <DevLoading /> : <>
                    <section className="space-y-2">
                        <h3 className="font-semibold">Fonte do scan</h3>
                        {details.sourceUrl ? <a href={details.sourceUrl} target="_blank" rel="noopener noreferrer"
                            className="break-all text-brand underline">{details.sourceUrl}</a>
                            : details.files.length > 0 ? <ul className="space-y-2">{details.files.map((file, index) =>
                                <li key={index} className="break-all">
                                    {file.url ? <a href={file.url} target="_blank" rel="noopener noreferrer"
                                        className="text-brand underline">{file.name}</a>
                                        : <span className="text-gray-500">{file.name} · Arquivo indisponível</span>}
                                </li>)}</ul>
                                : <p className="text-gray-500">Fonte original indisponível{details.linkDomain ? " · " + details.linkDomain : ""}.</p>}
                    </section>
                    {details.geminiError && <p className="break-words"><strong>Gemini</strong> · {details.geminiError}</p>}
                    {details.openAiError && <p className="break-words"><strong>OpenAI</strong> · {details.openAiError}</p>}
                    {details.excerpt && <section className="space-y-2">
                        <h3 className="font-semibold">Trecho extraído</h3>
                        <p className="break-words text-gray-600">{details.excerpt}</p>
                    </section>}
                </>}
        </div>
    </DevDialog>;
}
