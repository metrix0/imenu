"use client";

import { useState } from "react";
import PagedTable from "./PagedTable";
import styles from "./dashboard.module.css";
import { DEV_BLAST_PAGE_SIZE } from "@/lib/dev/pagination";
import { statusPresentation } from "@/lib/dev/supportView";
import type { Connection } from "@/lib/dev/supportTypes";

export type Automation = { id: string; name: string; message: string | null; sender: string; criteria: string; limit: number | null; category?: "payouts" };
export type Connections = { support: Connection | null; blast: Connection | null };

export function BlastSender({ sender, connections }: { sender: string; connections?: Connections }) {
    const label = sender === "blast" ? "Blast" : "Suporte";
    if (!connections) return <span className="whitespace-nowrap">{label}</span>;

    const connection = sender === "blast" ? connections.blast : connections.support;
    const status = statusPresentation(connection);
    const healthy = connection?.desired_state === "connected" && connection.status === "WORKING";
    return <span className="inline-flex max-w-full items-center gap-2 whitespace-nowrap" title={connection?.last_error || status.label}>
        <span role="img" aria-label={status.label} className={`h-2 w-2 shrink-0 rounded-full ${healthy ? "bg-green-600" : connection?.status === "UNKNOWN" || !connection ? "bg-gray-400" : "bg-red-600"}`} />
        <span className="truncate">{label}</span>
    </span>;
}

export default function BlastAutomation({ automations, connections, loading, group }: {
    automations: readonly Automation[];
    connections?: Connections;
    loading?: boolean;
    group?: { label: string; defaultOpen?: boolean };
}) {
    const [page, setPage] = useState(0);
    const pageSize = DEV_BLAST_PAGE_SIZE;
    const pageCount = Math.max(1, Math.ceil(automations.length / pageSize));
    const currentPage = Math.min(page, pageCount - 1);
    const table = <PagedTable data={{
        rows: automations.slice(currentPage * pageSize, (currentPage + 1) * pageSize),
        total: automations.length, page: currentPage, pageCount,
    }} loading={loading} onPage={setPage} rowKey={row => row.id} columns={[
        { key: "name", label: "Título", render: row => <span className="font-medium">{row.name}</span> },
        { key: "criteria", label: "Critérios", render: row => <p className="max-w-80 text-xs leading-5 text-gray-600">{row.criteria}</p> },
        { key: "limit", label: "Limite/dia", className: "whitespace-nowrap", render: row => row.limit === null ? "Sem limite" : `${row.limit} envios${["recovery-plus", "recovery", "single-order", "first-order"].includes(row.id) ? " (compart.)" : ""}` },
        { key: "message", label: "Mensagem", render: row => <p className={styles.blastMessage}>{row.message || "—"}</p> },
        { key: "sender", label: "Remetente", render: row => <BlastSender sender={row.sender} connections={connections} /> },
    ]} />;
    const className = `${styles.tableSection} ${styles.blastTable} ${styles.blastAutomations}`;
    if (group) {
        return <details className={className} name="blast-automation" open={group.defaultOpen}>
            <summary className="mb-3 cursor-pointer rounded-lg border border-[#e2e5e9] bg-white px-4 py-3 text-sm font-semibold">{group.label}</summary>
            {table}
        </details>;
    }
    return <section className={className}><h2>Blasts automáticos</h2>{table}</section>;
}
