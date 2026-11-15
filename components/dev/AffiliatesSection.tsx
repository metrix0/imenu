"use client";

import { useEffect, useState, type FormEvent } from "react";
import { Copy } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import PagedTable, { type PageData } from "./PagedTable";
import { useDevProfile } from "./DevProfileProvider";
import { affiliateDashboardLink, affiliateReferralLink } from "@/lib/analytics/affiliateCode";
import { devJson } from "@/lib/dev/client";
import { formatCurrencyFromCents, formatDateTime } from "@/lib/dev/dashboardFormat";
import styles from "./dashboard.module.css";

type Partner = { code: string; name: string; purchases: number };
type Purchase = {
    id: string; name: string; code: string; restaurant_id: string; restaurant_name: string;
    paid_at: string; amount_cents: number;
};
type Affiliates = { partners: PageData<Partner>; purchases: PageData<Purchase> };
const empty = <T,>(): PageData<T> => ({ rows: [], page: 0, total: 0, pageCount: 1 });

export default function AffiliatesSection() {
    const { openProfile } = useDevProfile();
    const [data, setData] = useState<Affiliates>({ partners: empty(), purchases: empty() });
    const [page, setPage] = useState(0);
    const [purchasePage, setPurchasePage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [name, setName] = useState("");
    const [code, setCode] = useState("");
    const [copied, setCopied] = useState("");
    const [error, setError] = useState("");
    const [loadError, setLoadError] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        void devJson<Affiliates>(`/api/dev/affiliates?page=${page}&purchases=${purchasePage}`, { signal: controller.signal })
            .then(result => {
                if (!controller.signal.aborted) { setData(result); setLoadError(""); }
            })
            .catch(cause => { if (!controller.signal.aborted) setLoadError(cause.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page, purchasePage, revision]);

    async function createPartner(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (saving) return;
        setSaving(true);
        setError("");
        try {
            await devJson("/api/dev/affiliates", { method: "POST", body: JSON.stringify({ name, code }) });
            setName("");
            setCode("");
            setPage(0);
            setRevision(current => current + 1);
        } catch (cause) {
            setError((cause as Error).message);
        } finally {
            setSaving(false);
        }
    }

    async function copy(partner: Partner, kind: "link" | "message") {
        setError("");
        const referralLink = affiliateReferralLink(partner.code);
        const message = [
            "Olá! Seu código de afiliado do iMenu já está ativo.",
            `Compartilhe este link com os restaurantes que você quer indicar:\n${referralLink}`,
            "Você recebe 50% de cada pagamento confirmado do iMenu Plus das contas que indicar, incluindo as renovações.",
            `Acompanhe suas indicações e comissões pelo seu painel:\n${affiliateDashboardLink(partner.code)}`,
        ].join("\n\n");
        try {
            await navigator.clipboard.writeText(kind === "link" ? referralLink : message);
            setCopied(`${kind}:${partner.code}`);
        } catch {
            setError(kind === "link" ? "Não foi possível copiar o link." : "Não foi possível copiar a mensagem.");
        }
    }

    return <>
        {(error || loadError) && <p role="alert" className="text-sm text-red-700">{error || loadError}</p>}
        <section className={styles.tableSection}>
            <h2>Parceiros</h2>
            <form onSubmit={createPartner} className="mb-4 grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]">
                <Input label="Nome do parceiro" value={name} maxLength={100} required onChange={event => setName(event.target.value)} />
                <Input label="Código" placeholder="nome-do-parceiro" value={code} maxLength={40} required onChange={event => setCode(event.target.value)} />
                <Button type="submit" loading={saving}>Criar código</Button>
            </form>
            <PagedTable data={data.partners} loading={loading} onPage={setPage} rowKey={row => row.code} columns={[
                { key: "name", label: "Parceiro", render: row => row.name },
                { key: "code", label: "Código", render: row => row.code },
                { key: "purchases", label: "Compras", render: row => row.purchases },
                { key: "link", label: "Link", render: row => <Button variant="secondary" leftIcon={<Copy size={14} />}
                    className="!min-h-8 !px-2 !py-1" onClick={() => void copy(row, "link")}>{copied === `link:${row.code}` ? "Copiado" : "Copiar"}</Button> },
                { key: "message", label: "Mensagem pronta", render: row => <Button variant="secondary" leftIcon={<Copy size={14} />}
                    className="!min-h-8 !px-2 !py-1" aria-label={`Copiar mensagem para ${row.name}`}
                    onClick={() => void copy(row, "message")}>{copied === `message:${row.code}` ? "Copiada" : "Copiar"}</Button> },
            ]} />
        </section>
        <section className={styles.tableSection}>
            <h2>Compras atribuídas</h2>
            <PagedTable data={data.purchases} loading={loading} onPage={setPurchasePage} rowKey={row => row.id} columns={[
                { key: "partner", label: "Parceiro", render: row => <span title={row.code}>{row.name}</span> },
                { key: "restaurant", label: "Restaurante", render: row => <button type="button" className={styles.profileLink}
                    onClick={() => openProfile({ id: row.restaurant_id, name: row.restaurant_name })}>{row.restaurant_name}</button> },
                { key: "date", label: "Data", render: row => formatDateTime(row.paid_at) },
                { key: "amount", label: "Valor", render: row => formatCurrencyFromCents(row.amount_cents) },
            ]} />
        </section>
    </>;
}
