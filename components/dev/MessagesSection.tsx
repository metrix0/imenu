"use client";

import { useEffect, useState } from "react";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Tabs from "@/components/ui/Tabs";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";
import { formatPhone } from "@/lib/dev/supportView";
import type { DevMessage, MessageCategory } from "@/lib/dev/messageHistory";

const categories = ["Todas", "Follow-ups", "Boas-vindas Plus", "Automações de clientes"] as const;
const filters: Record<typeof categories[number], MessageCategory> = {
    "Todas": "all",
    "Follow-ups": "followup",
    "Boas-vindas Plus": "congratulations",
    "Automações de clientes": "automation",
};
const automationLabels: Record<string, string> = {
    cart: "Carrinho abandonado",
    reactivation: "Reativação",
    habit: "Hábito de compra",
};
const statusLabels: Record<string, string> = {
    sent: "Enviada",
    failed: "Falhou",
    pending: "Pendente",
    sending: "Enviando",
    unconfirmed: "Não confirmado",
};

function messageType(message: DevMessage) {
    if (message.category === "followup") return "Follow-up";
    if (message.category === "congratulations") return "Boas-vindas iMenu Plus";
    return automationLabels[message.subtype || ""] || "Automação de cliente";
}

const empty: PageData<DevMessage> = { rows: [], total: 0, page: 0, pageCount: 1 };

export default function MessagesSection() {
    const [tab, setTab] = useState<typeof categories[number]>("Todas");
    const [page, setPage] = useState(0);
    const [revision, setRevision] = useState(0);
    const [data, setData] = useState<PageData<DevMessage>>(empty);
    const [selected, setSelected] = useState<DevMessage | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        void devJson<PageData<DevMessage>>(
            `/api/dev/messages?type=${filters[tab]}&page=${page}`,
            { signal: controller.signal }
        ).then(result => { setData(result); setError(""); })
            .catch(err => { if (!controller.signal.aborted) setError(err.message); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [tab, page, revision]);

    return <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-lg font-semibold">Mensagens enviadas <span className="text-sm font-normal text-gray-500">({data.total})</span></h2>
            <Button variant="secondary" loading={loading} onClick={() => setRevision(value => value + 1)}>Atualizar</Button>
        </div>
        <Tabs tabs={[...categories]} active={tab} onChange={next => { setTab(next); setPage(0); }} />
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <PagedTable data={data} loading={loading} onPage={setPage} rowKey={row => row.id}
            onRowClick={setSelected} columns={[
                { key: "date", label: "Data", render: row => formatDateTime(row.sent_at || row.created_at) },
                { key: "type", label: "Tipo", render: row => messageType(row) },
                { key: "restaurant", label: "Restaurante / contato", render: row => row.restaurant || "—" },
                { key: "phone", label: "Telefone", render: row => formatPhone(row.phone) },
                { key: "message", label: "Mensagem", render: row => <p className="max-w-sm truncate" title={row.message || ""}>{row.message || "Texto não registrado no histórico."}</p> },
                { key: "status", label: "Status", render: row => statusLabels[row.status] || row.status },
            ]} />
        <Modal open={Boolean(selected)} onClose={() => setSelected(null)} height="80dvh" showCloseButton>
            {selected && <div className="space-y-4 p-5">
                <h2 className="pr-8 text-lg font-semibold">{messageType(selected)}</h2>
                <div className="space-y-1 text-sm text-gray-600">
                    <p>{selected.restaurant || "iMenu"} · {formatPhone(selected.phone)}</p>
                    <p>{formatDateTime(selected.sent_at || selected.created_at)} · {statusLabels[selected.status] || selected.status}</p>
                </div>
                <p className="whitespace-pre-wrap break-words text-sm">{selected.message || "Texto não registrado no histórico."}</p>
                {selected.error && <p role="alert" className="text-sm text-red-700">{selected.error}</p>}
            </div>}
        </Modal>
    </section>;
}
