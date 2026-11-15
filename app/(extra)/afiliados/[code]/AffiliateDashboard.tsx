"use client";

import { useEffect, useState } from "react";
import { Copy } from "lucide-react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import DataTable from "@/components/ui/DataTable";
import Loader from "@/components/ui/Loader";
import Pagination from "@/components/ui/Pagination";
import type { PageData } from "@/components/dev/PagedTable";
import { affiliateReferralLink } from "@/lib/analytics/affiliateCode";
import { formatCount, formatCurrencyFromCents, formatDateTime } from "@/lib/dev/dashboardFormat";

type Referral = { position: number; restaurant_name: string | null; referred_at: string; has_purchase: boolean };
type Purchase = { position: number; restaurant_name: string; paid_at: string; commission_cents: number };
type Dashboard = { referrals: PageData<Referral>; purchases: PageData<Purchase>; commissionCents: number };

export default function AffiliateDashboard({ code }: { code: string }) {
    const [dashboard, setDashboard] = useState<Dashboard | null>(null);
    const [referralPage, setReferralPage] = useState(0);
    const [purchasePage, setPurchasePage] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [copyStatus, setCopyStatus] = useState("");
    const referralLink = affiliateReferralLink(code);

    useEffect(() => {
        const controller = new AbortController();
        async function load() {
            setLoading(true);
            setError("");
            try {
                const response = await fetch(`/api/afiliados/${code}?page=${referralPage}&purchases=${purchasePage}`, {
                    signal: controller.signal, cache: "no-store",
                });
                const result = await response.json();
                if (!response.ok) throw new Error(result.error || "Não foi possível carregar o painel.");
                if (!controller.signal.aborted) setDashboard(result);
            } catch (cause) {
                if (!controller.signal.aborted) {
                    setDashboard(null);
                    setError(cause instanceof Error ? cause.message : "Não foi possível carregar o painel.");
                }
            } finally {
                if (!controller.signal.aborted) setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, [code, referralPage, purchasePage]);

    async function copyLink() {
        try {
            await navigator.clipboard.writeText(referralLink);
            setCopyStatus("Link copiado");
        } catch {
            setCopyStatus("Não foi possível copiar o link.");
        }
    }

    if (error) return <Card><p role="alert" className="text-sm text-[#626973]">{error}</p></Card>;
    if (!dashboard) return <Loader className="mx-auto" />;

    return <>
        <Card className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
                <h2 className="text-sm font-semibold">Seu link de indicação</h2>
                <p className="mt-1 break-all text-sm text-[#626973]">{referralLink}</p>
            </div>
            <Button type="button" leftIcon={<Copy size={16} />} onClick={() => void copyLink()}>
                {copyStatus === "Link copiado" ? "Link copiado" : "Copiar link"}
            </Button>
            <span role="status" className={copyStatus === "Link copiado" || !copyStatus ? "sr-only" : "w-full text-sm text-[#626973]"}>{copyStatus}</span>
        </Card>
        <dl className="grid gap-3 sm:grid-cols-3">
            {[
                ["Contas indicadas", formatCount(dashboard.referrals.total)],
                ["Compras confirmadas", formatCount(dashboard.purchases.total)],
                ["Comissão gerada", formatCurrencyFromCents(dashboard.commissionCents)],
            ].map(([label, value]) => <Card key={label}>
                <dt className="text-sm text-[#626973]">{label}</dt>
                <dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd>
            </Card>)}
        </dl>
        <section aria-labelledby="affiliate-referrals">
            <h2 id="affiliate-referrals" className="mb-2 text-lg font-semibold">Contas indicadas</h2>
            <DataTable rows={dashboard.referrals.rows} loading={loading} rowKey={row => String(row.position)}
                emptyMessage="Nenhuma conta indicada ainda." columns={[
                    { key: "restaurant", label: "Restaurante", render: row => row.restaurant_name || "Sem restaurante" },
                    { key: "date", label: "Indicação", render: row => formatDateTime(row.referred_at) },
                    { key: "status", label: "iMenu Plus", render: row => <Badge variant={row.has_purchase ? "success" : "neutral"}>
                        {row.has_purchase ? "Compra confirmada" : "Sem compra"}
                    </Badge> },
                ]} />
            {dashboard.referrals.pageCount > 1 && <Pagination page={dashboard.referrals.page} pageCount={dashboard.referrals.pageCount}
                disabled={loading} onChange={setReferralPage} />}
        </section>
        <section aria-labelledby="affiliate-purchases">
            <h2 id="affiliate-purchases" className="mb-2 text-lg font-semibold">Compras confirmadas</h2>
            <DataTable rows={dashboard.purchases.rows} loading={loading} rowKey={row => String(row.position)}
                emptyMessage="Nenhuma compra confirmada ainda." columns={[
                    { key: "restaurant", label: "Restaurante", render: row => row.restaurant_name },
                    { key: "date", label: "Pagamento", render: row => formatDateTime(row.paid_at) },
                    { key: "commission", label: "Comissão", render: row => formatCurrencyFromCents(row.commission_cents) },
                ]} />
            {dashboard.purchases.pageCount > 1 && <Pagination page={dashboard.purchases.page} pageCount={dashboard.purchases.pageCount}
                disabled={loading} onChange={setPurchasePage} />}
        </section>
    </>;
}
