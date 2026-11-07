"use client";

import { useEffect, useState } from "react";
import Badge from "@/components/ui/Badge";
import PagedTable, { type PageData } from "./PagedTable";
import DevLoading from "./DevLoading";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents, formatDateTime, formatCount } from "@/lib/dev/dashboardFormat";
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
    const [data, setData] = useState<QualityAssurance | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
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

    const openRestaurant = (restaurantId: string, restaurantName: string) =>
        openProfile({ id: restaurantId, name: restaurantName });

    if (!data && loading) return <DevLoading />;

    return <div className="space-y-6">
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        {data && <>
            <dl className={styles.metricStrip}>
                <div>
                    <dt>Potencial médio (não zero)</dt>
                    <dd>{data.summary.averagePotentialCents === null ? "—" : formatCurrencyFromCents(data.summary.averagePotentialCents)}</dd>
                    <p>Último relatório de {formatCount(data.summary.restaurantsWithPotential)} restaurantes · 90 dias</p>
                </div>
                <div>
                    <dt>Tempo médio até a primeira análise após o Plus</dt>
                    <dd>{duration(data.summary.averageFirstAnalysisMinutes)}</dd>
                    <p>{formatCount(data.summary.measuredActivations)} ativações com análise concluída</p>
                </div>
            </dl>
            <section className={styles.tableSection}>
                <h2>Análises Vendas IA <span className="font-normal text-gray-500">({data.analyses.total})</span></h2>
                <p className="mb-4 text-xs text-gray-500">Últimos 90 dias · GMV registrado no relatório, sem frete. Uma linha por análise concluída.</p>
                <div className={styles.section}>
                    <PagedTable data={data.analyses} loading={loading} onPage={setPage}
                        rowKey={row => row.id}
                        onRowClick={row => openRestaurant(row.restaurantId, row.restaurantName)}
                        columns={[
                            { key: "restaurant", label: "Restaurante", render: row => <span title={row.restaurantName} className="block min-w-44 max-w-64 truncate whitespace-nowrap font-medium">{row.restaurantName}</span> },
                            { key: "saved", label: "Salvo em", className: "whitespace-nowrap", render: row => formatDateTime(row.finishedAt) },
                            { key: "potential", label: "Potencial estimado", className: "whitespace-nowrap", render: row => row.potentialCents === null ? "—" : formatCurrencyFromCents(row.potentialCents) },
                            { key: "gmv", label: "GMV no relatório", className: "whitespace-nowrap", render: row => row.snapshotGmvCents === null ? "—" : formatCurrencyFromCents(row.snapshotGmvCents) },
                            { key: "window", label: "Período GMV", className: "whitespace-nowrap", render: row => row.snapshotDays === null ? "—" : String(row.snapshotDays) + " dias" },
                            { key: "activated", label: "Plus ativado em", className: "whitespace-nowrap", render: row => formatDateTime(row.activatedAt) },
                            { key: "elapsed", label: "Tempo após Plus", className: "whitespace-nowrap", render: row => row.activatedAt ? duration((new Date(row.finishedAt).getTime() - new Date(row.activatedAt).getTime()) / 60000) : "—" },
                        ]} />
                </div>
            </section>
            <section className={styles.tableSection}>
                <h2>Restaurantes sem análise <span className="font-normal text-gray-500">({data.missing.length})</span></h2>
                <p className="mb-4 text-xs text-gray-500">Plus ativo sem análise concluída desde a ativação. Alarmes registrados por assinatura.</p>
                <div className={styles.section}>
                    <PagedTable data={{ rows: data.missing.slice(missingPage * 25, (missingPage + 1) * 25), total: data.missing.length, page: missingPage, pageCount: Math.max(1, Math.ceil(data.missing.length / 25)) }}
                        rowKey={row => row.addonId}
                        onPage={setMissingPage}
                        onRowClick={row => openRestaurant(row.restaurantId, row.restaurantName)}
                        columns={[
                            { key: "restaurant", label: "Restaurante", render: row => <span title={row.restaurantName} className="block min-w-44 max-w-64 truncate whitespace-nowrap font-medium">{row.restaurantName}</span> },
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
        </>}
    </div>;
}
