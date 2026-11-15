"use client";

import { useEffect, useState } from "react";
import Input from "@/components/ui/Input";
import Badge from "@/components/ui/Badge";
import styles from "./dashboard.module.css";
import { Search, Eye } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import Tooltip from "@/components/ui/Tooltip";
import type { DateRange } from "@/lib/utils/dateRange";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";

import {useDevProfile,PhoneLink,CustomerBadge,type Restaurant} from "./DevProfileProvider";
import {accountAge, formatCurrencyFromCents, formatDateTime} from "@/lib/dev/dashboardFormat";
const empty = <T,>(): PageData<T> => ({ rows: [], page: 0, total: 0, pageCount: 1 });

const blastStatus = {
    sent: { label: "Enviado", variant: "success" },
    scheduled: { label: "Agendado", variant: "info" },
    paused: { label: "Agendado", variant: "info", detail: "A campanha está pausada e o contato segue na fila." },
    processing: { label: "Agendado", variant: "info", detail: "Envio em andamento." },
    failed: { label: "Falha", variant: "danger" },
    cancelled: { label: "Ignorado", variant: "neutral", detail: "O envio foi cancelado." },
    skipped_60d: { label: "Ignorado", variant: "neutral", detail: "Bloqueio para evitar novo contato em até 60 dias." },
    skipped_recent: { label: "Ignorado", variant: "neutral", detail: "O contato recebeu um disparo recente." },
    skipped_reactivated: { label: "Ignorado", variant: "neutral", detail: "O contato deixou de atender aos critérios do disparo." },
} as const;
type CrmRow = Restaurant & {
    blast_status?: keyof typeof blastStatus | null;
    blast_at?: string | null;
    blast_error?: string | null;
};

export function CrmList({ search = "", plan = "all", activity, title, range, showBlast = false, onTotalChange }: {
    search?: string;
    plan?: string;
    activity: string;
    title?: string;
    range?: DateRange;
    showBlast?: boolean;
    onTotalChange?: (activity: string, total: number) => void;
}) {
    const { openProfile } = useDevProfile();
    const [page, setPage] = useState(0);
    const [sort, setSort] = useState<{ key: string; direction: "asc" | "desc" } | null>(null);
    const [data, setData] = useState(empty<CrmRow>);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => { setPage(0); }, [search, plan, activity]);
    const onSort = (key: string) => {
        setSort(current => ({
            key,
            direction: current?.key === key
                ? current.direction === "asc" ? "desc" : "asc"
                : key === "gmv" || key === "created" ? "desc" : "asc",
        }));
        setPage(0);
    };
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        const params = new URLSearchParams({ mode: "crm", q: search, plan, activity, page: String(page) });
        if (showBlast) params.set("includeBlast", "1");
        if (range) {
            params.set("startDate", range.startDate);
            params.set("endDate", range.endDate);
        }
        if (sort) {
            params.set("sort", sort.key);
            params.set("direction", sort.direction);
        }
        void devJson<PageData<CrmRow>>(`/api/dev/restaurants?${params}`, { signal: controller.signal })
            .then(result => {
                if (controller.signal.aborted) return;
                setData(result);
                setError("");
                onTotalChange?.(activity, result.total);
            })
            .catch(e => { if (!controller.signal.aborted) setError(e.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [search, plan, activity, page, sort, range, showBlast, onTotalChange]);
    return <section className={styles.tableSection} aria-label={title}>
        {title && <h2>{title}</h2>}
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className={showBlast ? `${styles.crmTable} ${styles.churnBlastTable}` : styles.crmTable}>
            <PagedTable pageSize={10} data={data} loading={loading} rowKey={r => r.id} onPage={setPage}
                onRowClick={openProfile} sortKey={sort?.key} sortDirection={sort?.direction} onSort={onSort} columns={[
                { key: "name", label: "Restaurante", sortable: true, render: r => <span className="block min-w-0 truncate whitespace-nowrap font-medium" title={r.name}>{r.name}</span> },
                { key: "status", label: "Cliente", sortable: true, render: r => <CustomerBadge restaurant={r} /> },
                { key: "store", label: "Celular loja", sortable: true, render: r => <PhoneLink phone={r.store_phone} /> },
                { key: "owner", label: "Celular dono", sortable: true, render: r => <PhoneLink phone={r.owner_phone || r.phone} /> },
                { key: "created", label: "Conta há", sortable: true, className: styles.crmAgeColumn, render: r => <span className="whitespace-nowrap">{accountAge(r.created_at)}</span> },
                { key: "gmv", label: "GMV", sortable: true, className: styles.numericCell, render: r => {
                    const value = formatCurrencyFromCents(Number(r.gmv_cents) || 0);
                    return showBlast ? <span className="block truncate" title={value}>{value}</span> : value;
                } },
                {
                    key: "last_message", label: "Última mensagem", sortable: true,
                    render: r => r.last_message ? (
                        <Tooltip text={r.last_message_at ? formatDateTime(r.last_message_at) : ""} parentClassName="max-w-full" role="tooltip">
                            <span className="block truncate text-gray-600">{r.last_message}</span>
                        </Tooltip>
                    ) : "—",
                },
                ...(showBlast ? [{
                    key: "blast", label: "Blast",
                    render: (row: CrmRow) => {
                        const status = row.blast_status && blastStatus[row.blast_status];
                        if (!status) return <Badge variant="neutral" title="Sem registro deste Blast para esta conta.">Ignorado</Badge>;
                        const detail = row.blast_error || ("detail" in status ? status.detail : null);
                        const date = row.blast_at && row.blast_status !== "paused" ? formatDateTime(row.blast_at) : null;
                        return <Badge variant={status.variant}
                            title={[detail, date].filter(Boolean).join("\n") || undefined}>
                            {status.label}
                        </Badge>;
                    },
                }] : []),
                { key: "open", label: "", render: r => <button type="button" title="Ver detalhes" aria-label={`Ver detalhes de ${r.name}`} onClick={e => { e.stopPropagation(); openProfile(r); }} className="cursor-pointer rounded-md p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-brand"><Eye size={16} aria-hidden="true" /></button> },
            ]} />
        </div>
    </section>;
}

export default function CrmSection() {
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [plan, setPlan] = useState("all");
    const [activity, setActivity] = useState("all");
    useEffect(() => { const timer = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timer); }, [search]);
    return <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-[2] max-w-[480px]"><Input label="Buscar restaurantes" icon={<Search size={17}/>} type="search" placeholder="Nome, e-mail ou celular" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div className="min-w-40 flex-1 max-w-56"><Dropdown label="Cliente" value={plan} onChange={e => setPlan(e.target.value)} options={[
                { value: "all", label: "Todos" }, { value: "plus", label: "iMenu Plus" }, { value: "historical", label: "Pagantes históricos" }, { value: "free", label: "Gratuitos" },
            ]} /></div>
            <div className="min-w-40 flex-1 max-w-56"><Dropdown label="Atividade" value={activity} onChange={e => setActivity(e.target.value)} options={[
                { value: "all", label: "Todas" },
                { value: "active", label: "Cliente Ativo" },
                { value: "active_customers", label: "Usuários com clientes ativos" },
                { value: "abandoned_plus", label: "Abandonados Plus" },
                { value: "abandoned_imenu", label: "Abandonados iMenu" },
                { value: "single_day", label: "Um único dia de pedidos" },
                { value: "no_first_order", label: "Não ativados" },
            ]} /></div>
        </div>
        <CrmList search={query} plan={plan} activity={activity} />
    </div>;
}
