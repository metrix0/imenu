"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import DevDialog from "./DevDialog";
import styles from "./dashboard.module.css";
import Badge from "@/components/ui/Badge";
import { Search } from "lucide-react";
import { formatPhone, getWhatsappUrl } from "@/lib/dev/supportView";
import Dropdown from "@/components/ui/Dropdown";
import Tooltip from "@/components/ui/Tooltip";
import DevLoading from "./DevLoading";
import PagedTable, { type PageData } from "./PagedTable";
import IaAssistantConversationsSection from "./IaAssistantConversationsSection";
import { calculateOnePercentPayout } from "@/lib/services/payoutSafety";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents, formatDateTime } from "@/lib/dev/dashboardFormat";

type Restaurant = { id: string; name: string; email: string | null; phone: string | null; store_phone?: string | null; owner_phone?: string | null; created_at: string; plus_since?: string | null; has_paid: boolean; plus: boolean; payment_info?: string | null };
type Payment = { id: string; amount_cents: number; status: string; created_at: string; product_key?: string; failure_reason?: string | null };
type Details = { restaurant: Restaurant; metrics: { gmv_cents: number; orders: number; online_cents: number; pending_payout_cents: number }; analysis: { potential: { cents?: number; assumptions?: string; reason?: string; available?: boolean }; summary: string } | null };
const empty = <T,>(): PageData<T> => ({ rows: [], page: 0, total: 0, pageCount: 1 });

function monthsSince(value?: string | null): string {
    if (!value) return "—";
    const start = new Date(value);
    if (!Number.isFinite(start.getTime())) return "—";
    const today = new Date();
    let months = (today.getFullYear() - start.getFullYear()) * 12 + today.getMonth() - start.getMonth();
    if (today.getDate() < start.getDate()) months--;
    return months < 1 ? "menos de 1 mês" : `${months} ${months === 1 ? "mês" : "meses"}`;
}

function PhoneLink({ phone }: { phone?: string | null }) {
    const href = getWhatsappUrl(phone || "");
    return href
        ? <a href={href} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap text-[#c43700]" onClick={e => e.stopPropagation()}>{formatPhone(phone || "")}</a>
        : <span>—</span>;
}

function CrmList({ paid, search, plan, age, onOpen }: { paid: boolean; search: string; plan: string; age: string; onOpen: (row: Restaurant) => void }) {
    const [page, setPage] = useState(0);
    const [data, setData] = useState(empty<Restaurant>);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    useEffect(() => { setPage(0); }, [search, plan, age]);
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        void devJson<PageData<Restaurant>>(`/api/dev/restaurants?mode=crm&paid=${paid ? 1 : 0}&q=${encodeURIComponent(search)}&plan=${plan}&age=${age}&page=${page}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); })
            .catch(e => { if (!controller.signal.aborted) setError(e.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [paid, search, plan, age, page]);
    return <section className="min-w-0 space-y-3">
        <h2 className="text-base font-semibold">{paid ? "Clientes pagantes e históricos" : "Todos os restaurantes"} <span className="font-normal text-gray-500">({data.total})</span></h2>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className={styles.crmTable}>
            <PagedTable data={data} loading={loading} rowKey={r => r.id} onPage={setPage} onRowClick={onOpen} columns={[
                { key: "name", label: "Restaurante", render: r => <span className="block min-w-36 font-medium">{r.name}</span> },
                { key: "status", label: "Cliente", render: r => <CustomerBadge restaurant={r} /> },
                { key: "email", label: "E-mail", render: r => <span className="block max-w-48 truncate" title={r.email || undefined}>{r.email || "—"}</span> },
                { key: "store", label: "Celular loja", render: r => <PhoneLink phone={r.store_phone} /> },
                { key: "owner", label: "Celular dono", render: r => <PhoneLink phone={r.owner_phone || r.phone} /> },
                { key: "created", label: "Conta há", render: r => <span className="whitespace-nowrap">{monthsSince(r.created_at)}</span> },
                { key: "plus", label: "Plus há", render: r => <span className="whitespace-nowrap">{monthsSince(r.plus_since)}</span> },
                { key: "open", label: "", render: r => <Button variant="secondary" className="!min-h-8 !px-3 !py-1.5" onClick={e => { e.stopPropagation(); onOpen(r); }}>Ver detalhes</Button> },
            ]} />
        </div>
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
    const [data, setData] = useState<Details | null>(null);
    const [due, setDue] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [entering, setEntering] = useState(false);
    useEffect(() => {
        let active = true;
        void devJson<Details>(`/api/dev/restaurants?mode=crm&restaurant_id=${restaurant.id}`)
            .then(result => { if (active) setData(result); })
            .catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [restaurant.id]);
    useEffect(() => {
        let active = true;
        void devJson<{ payables: { restaurantId: string; grossCents: number; waitingGrossCents: number }[] }>("/api/dev/payout")
            .then(result => {
                const row = result.payables.find(r => r.restaurantId === restaurant.id);
                if (active) setDue(calculateOnePercentPayout(row?.grossCents || 0, 0).netCents + calculateOnePercentPayout(row?.waitingGrossCents || 0, 0).netCents);
            }).catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [restaurant.id]);
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
    return <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1 space-y-4">
                <CustomerBadge restaurant={restaurant} />
                <dl className={styles.crmDetails}>
                    <div><dt>E-mail</dt><dd>{restaurant.email || "—"}</dd></div>
                    <div><dt>Celular loja</dt><dd><PhoneLink phone={restaurant.store_phone} /></dd></div>
                    <div><dt>Celular dono</dt><dd><PhoneLink phone={restaurant.owner_phone || restaurant.phone} /></dd></div>
                    <div><dt>Conta há / Plus há</dt><dd>{monthsSince(restaurant.created_at)} / {monthsSince(restaurant.plus_since)}</dd></div>
                </dl>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <IaAssistantConversationsSection restaurant={{ restaurantId: restaurant.id, restaurantName: restaurant.name }} />
                <Button loading={entering} onClick={() => void enter()}>Entrar no restaurante</Button>
            </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <section className={styles.crmDetailBlock}>
            <h3>Visão geral</h3>
            {!data ? <div className="flex min-h-32 items-center justify-center"><DevLoading /></div> : <>
                <dl className={styles.detailMetrics}>
                    {([["GMV", formatCurrencyFromCents(data.metrics.gmv_cents)], ["GMV online", formatCurrencyFromCents(data.metrics.online_cents)], ["Pedidos", data.metrics.orders], ["A repassar", due === null ? "—" : formatCurrencyFromCents(due + Number(data.metrics.pending_payout_cents || 0))]] as const).map(([label, value]) => <div key={label}><dt className="text-xs text-gray-500">{label}</dt><dd className="mt-2 font-semibold tabular-nums">{value}</dd></div>)}
                </dl>
                <div className="mt-5"><h3>Potencial Vendas IA</h3>
                    <Tooltip size="medium" showOnClick text={data.analysis?.potential?.assumptions || data.analysis?.potential?.reason || data.analysis?.summary || ""}>
                        <span className="text-xl font-semibold">{data.analysis?.potential?.available && data.analysis.potential.cents != null ? formatCurrencyFromCents(data.analysis.potential.cents) : "Sem estimativa disponível"}</span>
                    </Tooltip>
                </div>
            </>}
        </section>
        <section className={styles.crmDetailBlock}><h3>Pagamentos</h3><PaymentHistory id={restaurant.id} kind="payments" /></section>
        <section className={styles.crmDetailBlock}><h3>Repasses</h3><PaymentHistory id={restaurant.id} kind="payouts" /></section>
    </div>;
}

export default function CrmSection() {
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [plan, setPlan] = useState("all");
    const [age, setAge] = useState("all");
    const [selected, setSelected] = useState<Restaurant | null>(null);
    useEffect(() => { const timer = setTimeout(() => setQuery(search), 300); return () => clearTimeout(timer); }, [search]);
    return <div className="space-y-6">
        <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-60 flex-[2] max-w-[480px]"><Input label="Buscar restaurantes" icon={<Search size={17}/>} type="search" placeholder="Nome, e-mail ou celular" value={search} onChange={e => setSearch(e.target.value)} /></div>
            <div className="min-w-40 flex-1 max-w-56"><Dropdown label="Cliente" value={plan} onChange={e => setPlan(e.target.value)} options={[
                { value: "all", label: "Todos" }, { value: "plus", label: "iMenu Plus" }, { value: "historical", label: "Pagantes históricos" }, { value: "free", label: "Gratuitos" },
            ]} /></div>
            <div className="min-w-40 flex-1 max-w-56"><Dropdown label="Cadastro" value={age} onChange={e => setAge(e.target.value)} options={[
                { value: "all", label: "Qualquer período" }, { value: "30", label: "Últimos 30 dias" }, { value: "90", label: "Últimos 90 dias" }, { value: "older", label: "Mais de 90 dias" },
            ]} /></div>
        </div>
        <CrmList paid search={query} plan={plan} age={age} onOpen={setSelected} />
        <CrmList paid={false} search={query} plan={plan} age={age} onOpen={setSelected} />
        <DevDialog wide title={selected?.name || "Restaurante"} description="Histórico e relacionamento" open={Boolean(selected)} onClose={() => setSelected(null)}>{selected && <RestaurantDetails key={selected.id} restaurant={selected} />}</DevDialog>
    </div>;
}
