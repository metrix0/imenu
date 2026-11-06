"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import DevDialog from "./DevDialog";
import styles from "./dashboard.module.css";
import InitialsAvatar from "@/components/ui/InitialsAvatar";
import Badge from "@/components/ui/Badge";
import { Search } from "lucide-react";
import { formatPhone, getWhatsappUrl } from "@/lib/dev/supportView";
import Tabs from "@/components/ui/Tabs";
import Tooltip from "@/components/ui/Tooltip";
import Loader from "@/components/ui/Loader";
import PagedTable, { type PageData } from "./PagedTable";
import IaAssistantConversationsSection from "./IaAssistantConversationsSection";
import { calculateOnePercentPayout } from "@/lib/services/payoutSafety";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents, formatDateTime } from "@/lib/dev/dashboardFormat";

type Restaurant = { id: string; name: string; email: string | null; phone: string | null; created_at: string; has_paid: boolean; plus: boolean; payment_info?: string | null };
type Payment = { id: string; amount_cents: number; status: string; created_at: string; product_key?: string; failure_reason?: string | null };
type Details = { restaurant: Restaurant; metrics: { gmv_cents: number; orders: number; online_cents: number; pending_payout_cents: number }; analysis: { potential: { cents?: number; assumptions?: string; reason?: string; available?: boolean }; summary: string } | null };
const empty = <T,>(): PageData<T> => ({ rows: [], page: 0, total: 0, pageCount: 1 });

function CrmList({ paid, search, onOpen }: { paid: boolean; search: string; onOpen: (row: Restaurant) => void }) {
    const [page, setPage] = useState(0);
    const [data, setData] = useState(empty<Restaurant>);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => { setPage(0); }, [search]);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        void devJson<PageData<Restaurant>>(`/api/dev/restaurants?mode=crm&paid=${paid ? 1 : 0}&q=${encodeURIComponent(search)}&page=${page}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [paid, search, page]);
    return <section className={`${styles.section} ${styles.scrollTable} ${paid ? styles.paidCustomers : ""}`}><div className={styles.sectionHeader}><h2>{paid ? "Clientes pagantes e históricos" : "Todos os restaurantes"} <span className="text-sm font-normal text-gray-500">({data.total})</span></h2></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <PagedTable data={data} loading={loading} rowKey={r => r.id} onPage={setPage} onRowClick={onOpen} columns={[
            { key: "name", label: "Restaurante", render: r => <div className="flex min-w-48 items-center gap-3"><InitialsAvatar name={r.name}/><span className="font-medium">{r.name}</span></div> },
            { key: "status", label: "Cliente", render: r => <CustomerBadge restaurant={r} /> },
            { key: "email", label: "Contato", render: r => <div><p className="text-xs text-gray-500">{r.email || "—"}</p>{r.phone && <a className="mt-1 block text-[#c43700]" href={getWhatsappUrl(r.phone) || undefined} target="_blank" rel="noopener noreferrer" onClick={event=>event.stopPropagation()}>{formatPhone(r.phone)}</a>}</div> },
            { key: "since", label: "Desde", className: styles.dateCell, render: r => new Date(r.created_at).toLocaleDateString("pt-BR") },
            { key: "open", label: "", render: r => <Button variant="secondary" onClick={event => { event.stopPropagation(); onOpen(r); }}>Ver detalhes</Button> },
        ]} />
    </section>;
}

function CustomerBadge({ restaurant: r }: { restaurant: Restaurant }) {
    return <Badge variant={r.plus ? "brand" : "neutral"}>{r.plus ? "iMenu Plus" : r.has_paid ? "Pagante histórico" : "Gratuito"}</Badge>;
}

function PaymentHistory({ id, kind }: { id: string; kind: "payments" | "payouts" }) {
    const [page, setPage] = useState(0);
    const [data, setData] = useState(empty<Payment>);
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(true);
    useEffect(() => {
        const controller = new AbortController(); setLoading(true);
        void devJson<PageData<Payment>>(`/api/dev/restaurants?mode=crm&restaurant_id=${id}&section=${kind}&page=${page}`, { signal: controller.signal })
            .then(setData).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [id, kind, page]);
    return <div>{error && <p role="alert">{error}</p>}<PagedTable data={data} onPage={setPage} loading={loading} rowKey={r => r.id} columns={[
        { key: "date", label: "Data", render: r => formatDateTime(r.created_at) },
        { key: "amount", label: "Valor", render: r => formatCurrencyFromCents(r.amount_cents) },
        { key: "status", label: "Status", render: r => <Tooltip text={r.failure_reason || ""} showOnClick><span>{r.status}</span></Tooltip> },
    ]} /></div>;
}

function RestaurantDetails({ restaurant }: { restaurant: Restaurant }) {
    const [tab, setTab] = useState("Visão geral");
    const [data, setData] = useState<Details | null>(null);
    const [due, setDue] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [entering, setEntering] = useState(false);
    useEffect(() => {
        let active = true;
        void devJson<Details>(`/api/dev/restaurants?mode=crm&restaurant_id=${restaurant.id}`).then(result => { if (active) setData(result); }).catch(e => { if (active) setError(e.message); });
        // The existing payout route is loaded only when payout information is requested.
        return () => { active = false; };
    }, [restaurant.id]);
    useEffect(() => {
        if (tab !== "Repasses" || due !== null) return;
        let active = true;
        void devJson<{ payables: { restaurantId: string; grossCents: number; waitingGrossCents: number }[] }>("/api/dev/payout")
            .then(result => { const row = result.payables.find(r => r.restaurantId === restaurant.id); if (active) setDue(calculateOnePercentPayout(row?.grossCents || 0, 0).netCents + calculateOnePercentPayout(row?.waitingGrossCents || 0, 0).netCents); })
            .catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [tab, due, restaurant.id]);
    async function enter() {
        const target = window.open("", "_blank");
        if (!target) { setError("Permita pop-ups para abrir o restaurante."); return; }
        target.opener = null; setEntering(true);
        try {
            const origin = window.location.origin;
            const targetOrigin = origin === "https://preview.imenuapp.com.br" ? "https://imenuapp.com.br" : origin.startsWith("https://imenuapp.com.br") || origin === "https://www.imenuapp.com.br" ? "https://preview.imenuapp.com.br" : origin;
            const result = await devJson<{ action_link: string }>("/api/dev/restaurants", { method: "POST", body: JSON.stringify({ restaurantId: restaurant.id, targetOrigin }) });
            target.location.replace(result.action_link);
        } catch (e) { target.close(); setError((e as Error).message); } finally { setEntering(false); }
    }
    return <div className="space-y-5 p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-4 pr-8"><div><p className="text-sm text-gray-500">{restaurant.email || "Sem e-mail"}</p>{restaurant.phone && <a className="mt-1 block text-sm text-[#c43700]" href={getWhatsappUrl(restaurant.phone)||undefined} target="_blank" rel="noopener noreferrer">{formatPhone(restaurant.phone)}</a>}<div className="mt-2"><CustomerBadge restaurant={restaurant} /></div></div><Button loading={entering} onClick={() => void enter()}>Entrar no restaurante</Button></div>
        <Tabs tabs={["Visão geral", "Pagamentos", "Repasses", "Assistente IA"]} active={tab} onChange={setTab} />
        {error && <p role="alert" className="text-red-700">{error}</p>}
        {tab === "Visão geral" && (!data ? <Loader /> : <>
            <dl className={styles.detailMetrics}>
                {[["GMV", formatCurrencyFromCents(data.metrics.gmv_cents)], ["GMV online", formatCurrencyFromCents(data.metrics.online_cents)], ["Pedidos", data.metrics.orders], ["Cliente desde", new Date(restaurant.created_at).toLocaleDateString("pt-BR")]].map(([label, value]) => <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-2 font-semibold tabular-nums">{value}</dd></div>)}
            </dl>
            <section className={styles.analysisSummary}><h3 className="text-sm font-medium">Potencial Vendas IA</h3><div className="mt-2"><Tooltip size="medium" showOnClick text={data.analysis?.potential?.assumptions || data.analysis?.potential?.reason || data.analysis?.summary || ""}>
                <span className="text-xl font-semibold">{data.analysis?.potential?.available && data.analysis.potential.cents != null ? formatCurrencyFromCents(data.analysis.potential.cents) : "Sem estimativa disponível"}</span>
            </Tooltip></div></section>
        </>)}
        {tab === "Pagamentos" && <PaymentHistory id={restaurant.id} kind="payments" />}
        {tab === "Repasses" && <><p className="text-sm">A repassar: {due === null ? "—" : formatCurrencyFromCents(due + Number(data?.metrics.pending_payout_cents || 0))}</p><PaymentHistory id={restaurant.id} kind="payouts" /></>}
        {tab === "Assistente IA" && <IaAssistantConversationsSection restaurant={{ restaurantId: restaurant.id, restaurantName: restaurant.name }} />}
    </div>;
}

export default function CrmSection() {
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [selected, setSelected] = useState<Restaurant | null>(null);
    useEffect(() => { const timer = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timer); }, [search]);
    return <><div className={styles.searchToolbar}><Input icon={<Search size={17}/>} type="search" aria-label="Buscar restaurantes" placeholder="Nome, e-mail ou telefone" value={search} onChange={e => setSearch(e.target.value)} /></div>
        <CrmList paid search={query} onOpen={setSelected} /><CrmList paid={false} search={query} onOpen={setSelected} />
        <DevDialog title={selected?.name || "Restaurante"} description="Histórico e relacionamento" open={Boolean(selected)} onClose={() => setSelected(null)}>{selected && <RestaurantDetails key={selected.id} restaurant={selected} />}</DevDialog>
    </>;
}
