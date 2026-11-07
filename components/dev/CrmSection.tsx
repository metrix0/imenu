"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import styles from "./dashboard.module.css";
import { Search } from "lucide-react";
import Dropdown from "@/components/ui/Dropdown";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";

import {useDevProfile,monthsSince,PhoneLink,CustomerBadge,type Restaurant} from "./DevProfileProvider";
const empty = <T,>(): PageData<T> => ({ rows: [], page: 0, total: 0, pageCount: 1 });

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

export default function CrmSection() {
    const [search, setSearch] = useState("");
    const [query, setQuery] = useState("");
    const [plan, setPlan] = useState("all");
    const [age, setAge] = useState("all");
    const {openProfile}=useDevProfile();
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
        <CrmList paid search={query} plan={plan} age={age} onOpen={openProfile} />
        <CrmList paid={false} search={query} plan={plan} age={age} onOpen={openProfile} />
    </div>;
}
