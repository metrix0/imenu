"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import Card from "@/components/ui/Card";
import {Check, LogIn} from "lucide-react";
import Button from "@/components/ui/Button";
import DevDialog from "./DevDialog";
import styles from "./dashboard.module.css";
import Badge from "@/components/ui/Badge";
import { formatPhone, getWhatsappUrl } from "@/lib/dev/supportView";
import Tooltip from "@/components/ui/Tooltip";
import DevLoading from "./DevLoading";
import PagedTable, { type PageData } from "./PagedTable";
import dynamic from "next/dynamic";
const IaAssistantConversationsSection=dynamic(()=>import("./IaAssistantConversationsSection"),{ssr:false});
import { calculateOnePercentPayout } from "@/lib/services/payoutSafety";
import { normalizeCreationStep } from "@/lib/restaurantCreation";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents, formatDateTime, monthsSince, accountAge } from "@/lib/dev/dashboardFormat";

export type Restaurant = { id: string; name: string; email?: string | null; phone?: string | null; store_phone?: string | null; owner_phone?: string | null; created_at?: string; plus_since?: string | null; has_paid?: boolean; plus?: boolean; payment_info?: string | null; url_slug?: string | null; creation_step?: number | null; first_time?: boolean | null; onboarding_completed_at?: string | null; city?: string | null; state?: string | null; pickup_enabled?: boolean | null; delivery_disabled?: boolean | null; preorder_only?: boolean | null };
type Payment = { id: string; amount_cents: number; status: string; created_at: string; product_key?: string; failure_reason?: string | null; billing_type?: string | null };
type Details = { restaurant: Restaurant; metrics: { gmv_cents: number; orders: number; online_cents: number; monthly_gmv_cents: number }; analysis: { potential: { cents?: number; assumptions?: string; reason?: string; available?: boolean }; summary: string } | null };
const empty = <T,>(): PageData<T> => ({rows:[],total:0,page:0,pageCount:1});
export function PhoneLink({ phone }: { phone?: string | null }) {
    const href = getWhatsappUrl(phone || "");
    return href
        ? <a href={href} target="_blank" rel="noopener noreferrer" title={formatPhone(phone || "")} className="inline-block max-w-full truncate whitespace-nowrap text-[#c43700] align-middle" onClick={e => e.stopPropagation()}>{formatPhone(phone || "")}</a>
        : <span>—</span>;
}

export function CustomerBadge({ restaurant: r }: { restaurant: Restaurant }) {
    return <span className="inline-flex items-center gap-2 whitespace-nowrap"><Badge className="whitespace-nowrap" variant={r.plus ? "brand" : "neutral"}>{r.plus ? "iMenu Plus" : r.has_paid ? "Pagante histórico" : "Gratuito"}</Badge>{r.plus && r.plus_since && <span className="text-xs font-normal text-gray-500">há {monthsSince(r.plus_since)}</span>}</span>;
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
    return <div>{error && <p role="alert">{error}</p>}<PagedTable pageSize={10} data={data} onPage={setPage} loading={loading} rowKey={r => r.id} columns={[
        { key: "date", label: "Data", render: r => formatDateTime(r.created_at) },
        { key: "amount", label: "Valor", render: r => formatCurrencyFromCents(r.amount_cents) },
        ...(kind === "payments" ? [{key:"type",label:"Tipo",render:(r:Payment)=>({PIX:"Pix",CREDIT_CARD:"Cartão de crédito",DEBIT_CARD:"Cartão de débito",BOLETO:"Boleto",UNDEFINED:"Não informado"} as Record<string,string>)[r.billing_type || ""] || r.billing_type || "—"}] : []),
        { key: "status", label: "Status", render: r => <Tooltip text={r.failure_reason || ""} showOnClick><span>{r.status}</span></Tooltip> },
    ]} /></div>;
}

function RestaurantDetails({ restaurant: initialRestaurant, onLoaded }: { restaurant: Restaurant; onLoaded:(restaurant:Restaurant)=>void }) {
    const [data, setData] = useState<Details | null>(null);
    const restaurant=data?.restaurant || initialRestaurant;
    const completedSteps = restaurant.first_time === false || restaurant.onboarding_completed_at ? 4 : normalizeCreationStep(restaurant.creation_step) - 1;
    const [due, setDue] = useState<number | null>(null);
    const [error, setError] = useState("");
    const [entering, setEntering] = useState(false);
    useEffect(() => {
        let active = true;
        void devJson<Details>(`/api/dev/restaurants?mode=crm&restaurant_id=${restaurant.id}`)
            .then(result => { if (active) {setData(result);if(result.restaurant)onLoaded(result.restaurant);} })
            .catch(e => { if (active) setError(e.message); });
        return () => { active = false; };
    }, [restaurant.id, onLoaded]);
    useEffect(() => {
        let active = true;
        void devJson<{ payables: { restaurantId: string; grossCents: number; payzuFeeCents: number }[] }>("/api/dev/payout")
            .then(result => {
                const row = result.payables.find(r => r.restaurantId === restaurant.id);
                if (active) setDue(calculateOnePercentPayout(row?.grossCents || 0, row?.payzuFeeCents || 0).netCents);
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
    if(!data&&!error&&!initialRestaurant.created_at)return <DevLoading/>;
    return <div className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="min-w-0 flex-1 space-y-4">
                <dl className={styles.crmDetails}>
                    <div><dt>E-mail</dt><dd title={restaurant.email || undefined}>{restaurant.email || "—"}</dd></div>
                    <div><dt>Celular loja</dt><dd><PhoneLink phone={restaurant.store_phone} /></dd></div>
                    <div><dt>Celular dono</dt><dd><PhoneLink phone={restaurant.owner_phone || restaurant.phone} /></dd></div>
                    <div><dt>Conta há</dt><dd>{accountAge(restaurant.created_at)}</dd></div>
                </dl>
            </div>
            <div className="flex flex-wrap items-center gap-2">
                <IaAssistantConversationsSection restaurant={{ restaurantId: restaurant.id, restaurantName: restaurant.name }} />
                <Button leftIcon={<LogIn size={16} aria-hidden="true" />} loading={entering} onClick={() => void enter()}>Entrar no restaurante</Button>
            </div>
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <section className={styles.crmDetailBlock}>
            <h3>Visão geral</h3>
            {!data ? <div className="flex min-h-32 items-center justify-center"><DevLoading /></div> : <>
                <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
                    {([["GMV", formatCurrencyFromCents(data.metrics.gmv_cents)], ["GMV online", formatCurrencyFromCents(data.metrics.online_cents)], ["GMV do mês", formatCurrencyFromCents(data.metrics.monthly_gmv_cents)], ["A repassar", due === null ? "—" : formatCurrencyFromCents(due)]] as const).map(([label, value]) => <Card key={label} className="min-w-0"><p className="text-xs text-gray-500">{label}</p><p className="mt-2 break-words text-lg font-semibold tabular-nums xl:text-xl">{value}</p></Card>)}
                </div>
                <p className="mt-5 text-sm leading-6"><span className="font-medium">Potencial Vendas IA</span>{" · "}{data.analysis?.potential?.available && data.analysis.potential.cents != null ? formatCurrencyFromCents(data.analysis.potential.cents) : "Sem estimativa disponível"}{(data.analysis?.potential?.assumptions || data.analysis?.potential?.reason || data.analysis?.summary) && <span className="text-gray-500">{" · "}{data.analysis?.potential?.assumptions || data.analysis?.potential?.reason || data.analysis?.summary}</span>}</p>
                <div className="mt-5 space-y-4">
                    <dl className={styles.crmDetails}>
                        <div><dt>Data de criação</dt><dd>{formatDateTime(restaurant.created_at || null)}</dd></div>
                        <div><dt>Cidade / UF</dt><dd title={[restaurant.city,restaurant.state].filter(Boolean).join(" / ")}>{[restaurant.city,restaurant.state].filter(Boolean).join(" / ") || "—"}</dd></div>
                        <div><dt>Cardápio</dt><dd>{restaurant.url_slug ? <a className={styles.profileLink} href={`/${restaurant.url_slug}`} target="_blank" rel="noopener noreferrer" title={`/${restaurant.url_slug}`}>/{restaurant.url_slug}</a> : "—"}</dd></div>
                        <div><dt>Chave PIX</dt><dd>{restaurant.payment_info?.trim() ? "Cadastrada" : "Não cadastrada"}</dd></div>
                        <div className="col-span-full"><dt>Modalidades</dt><dd>{[restaurant.delivery_disabled ? null : "Delivery",restaurant.pickup_enabled ? "Retirada" : null,restaurant.preorder_only ? "Somente encomendas" : null].filter(Boolean).join(" · ") || "—"}</dd></div>
                    </dl>
                    <div><p className="mb-2 text-xs text-gray-500">Etapas do cadastro · {completedSteps}/4</p><div className="flex flex-wrap gap-2" aria-label="Etapas do cadastro">{["Cardápio","Disponibilidade","Loja","Localização"].map((step,index)=><Badge key={step} variant={index < completedSteps ? "success" : "neutral"}>{index < completedSteps && <Check size={12} aria-hidden="true" className="mr-1" />}{step}</Badge>)}</div></div>
                </div>
            </>}
        </section>
        <section className={styles.crmDetailBlock}><h3>Repasses</h3><PaymentHistory id={restaurant.id} kind="payouts" /></section>
        <section className={styles.crmDetailBlock}><h3>Pagamentos</h3><PaymentHistory id={restaurant.id} kind="payments" /></section>
    </div>;
}

const ProfileContext=createContext<{openProfile:(restaurant:Restaurant)=>void}|null>(null);
export function useDevProfile(){const context=useContext(ProfileContext);if(!context)throw new Error("DevProfileProvider missing");return context;}
export default function DevProfileProvider({children}:{children:ReactNode}){
 const [selected,setSelected]=useState<Restaurant|null>(null);
 return <ProfileContext.Provider value={{openProfile:setSelected}}>{children}<DevDialog wide title={selected?.name||"Restaurante"} description={selected?.plus !== undefined ? <CustomerBadge restaurant={selected}/> : undefined} open={Boolean(selected)} onClose={()=>setSelected(null)}>{selected&&<RestaurantDetails key={selected.id} restaurant={selected} onLoaded={setSelected}/>}</DevDialog></ProfileContext.Provider>;
}
