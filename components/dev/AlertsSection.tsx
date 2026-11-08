"use client";

import { useEffect, useRef, useState } from "react";
import styles from "./dashboard.module.css";
import DevDialog from "./DevDialog";
import PagedTable, { type PageData } from "./PagedTable";
import { devJson } from "@/lib/dev/client";
import { formatDateTime } from "@/lib/dev/dashboardFormat";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";

import type {DateRange} from "@/lib/utils/dateRange";

type Alert = { id: string; source: string; title: string; message: string; severity: string;
    phone_notified: boolean|null; alarm_triggered: boolean|null; delivery_error:string|null;
    trigger_type:"notification"|"alarm"|"blast"|"none"|null; operation:string|null; http_status:number|null;
    occurrences:number; last_seen_at:string|null; resolved_at:string|null; created_at: string };

const MONITOR_EVENTS: Record<string, { operation: string; describe: (count: number) => string }> = {
    owner_push_missing_event: { operation: "Notificação de pedidos", describe: n => `${n} pedidos não tiveram registro de envio de notificação ao restaurante.` },
    printer_recent_failures: { operation: "Impressão de pedidos", describe: n => `${n} impressões falharam na última hora.` },
    wa_webhooks_stuck: { operation: "Webhooks do WhatsApp", describe: n => `${n} webhooks do WhatsApp ficaram presos em processamento.` },
    wa_webhooks_failed: { operation: "Webhooks do WhatsApp", describe: n => `${n} webhooks do WhatsApp falharam na última hora.` },
    wa_outbound_failed: { operation: "Envio de WhatsApp", describe: n => `${n} mensagens de WhatsApp falharam no envio na última hora.` },
    billing_webhooks_stuck: { operation: "Webhooks de pagamentos", describe: n => `${n} webhooks de pagamentos ficaram sem processamento.` },
    payout_failed_today: { operation: "Repasses", describe: n => `${n} execuções de repasse falharam nas últimas 24 horas.` },
};

function presentAlert(alert: Alert) {
    const message = alert.message.trim();
    if (alert.source === "vps-monitor") {
        const lines = message.split(/\r?\n/).map(line => line.trim()).filter(line => line && line !== "TRIGGER ALARM");
        const issues = lines.map(line => {
            const match = /^operation:([a-z_]+)(?:\s+\((\d+)\))?$/.exec(line);
            const metric = match ? MONITOR_EVENTS[match[1]] : undefined;
            return { text: metric ? metric.describe(Number(match?.[2] || 1)) : line, operation: metric?.operation };
        });
        if (issues.length && issues.some(issue => issue.operation)) {
            return {
                headline: issues.length === 1 ? issues[0].text : `${issues.length} problemas identificados pelo monitor do VPS`,
                explanation: issues.length === 1
                    ? "O número de itens afetados é diferente de “Ocorrências”, que conta os registros repetidos deste alerta."
                    : issues.map(issue => issue.text).join("\n"),
                operation: alert.operation || (issues.length === 1 ? issues[0].operation : null),
                technical: true,
            };
        }
    }
    if (alert.source === "gemini" && alert.operation?.includes("fallback OpenAI")) {
        const http = /^Gemini HTTP (\d{3})/i.exec(message);
        return {
            headline: "Importação de cardápio usou OpenAI",
            explanation: http
                ? `O Gemini retornou HTTP ${http[1]}. A importação usou a OpenAI como alternativa.`
                : `A importação usou a OpenAI como alternativa ao Gemini. Motivo: ${message || "não informado"}.`,
            operation: alert.operation,
            technical: true,
        };
    }
    if (alert.title === "Falha na aplicação" && message.startsWith("Rota: ")) {
        return {
            headline: `Falha na aplicação · ${message.slice(6).trim()}`,
            explanation: "Foi registrada uma falha nessa rota. O alerta não informa a causa técnica.",
            operation: alert.operation,
            technical: true,
        };
    }
    return { headline: alert.title, explanation: message || "Sem detalhes adicionais.", operation: alert.operation, technical: false };
}

function alertHttpStatus(alert: Alert) {
    if (alert.http_status != null) return alert.http_status;
    const match = alert.source === "gemini" ? /^Gemini HTTP (\d{3})/i.exec(alert.message) : null;
    return match ? Number(match[1]) : null;
}

export default function AlertsSection({range, mode = "unread", refresh = 0, onMarkedRead}:{
    range?: DateRange; mode?: "unread" | "history"; refresh?: number; onMarkedRead?: () => void;
}) {
    const [page, setPage] = useState(0);
    const [selected,setSelected] = useState<Alert|null>(null);
    const [data, setData] = useState<PageData<Alert>>({ rows: [], total: 0, page: 0, pageCount: 1 });
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [revision, setRevision] = useState(0);
    const [markingId, setMarkingId] = useState<string | null>(null);
    const [markingAll, setMarkingAll] = useState(false);
    const lastQueryKey = useRef<string | null>(null);
    const skipNextLoader = useRef(false);
    const startDate = mode === "history" ? range?.startDate || "" : "";
    const endDate = mode === "history" ? range?.endDate || "" : "";

    async function markAsRead(alert: Alert) {
        if (markingId || markingAll) return;
        setMarkingId(alert.id);
        setError("");
        try {
            await devJson("/api/dev/health?section=alerts", {
                method: "POST",
                body: JSON.stringify({ id: String(alert.id) }),
            });
            setSelected(null);
            setData(current => {
                const total = Math.max(0, current.total - 1);
                return {
                    ...current,
                    rows: current.rows.filter(row => row.id !== alert.id),
                    total,
                    pageCount: Math.max(1, Math.ceil(total / 10)),
                };
            });
            if (data.rows.length === 1 && page > 0) {
                skipNextLoader.current = true;
                setPage(page - 1);
            } else {
                setRevision(value => value + 1);
            }
            onMarkedRead?.();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Não foi possível marcar o alerta como lido.");
        } finally {
            setMarkingId(null);
        }
    }

    async function markAllAsRead() {
        if (markingId || markingAll || !data.total) return;
        setMarkingAll(true);
        setError("");
        try {
            await devJson("/api/dev/health?section=alerts", {
                method: "POST",
                body: JSON.stringify({ all: true }),
            });
            setSelected(null);
            setData(current => ({ ...current, rows: [], total: 0, page: 0, pageCount: 1 }));
            if (page > 0) {
                skipNextLoader.current = true;
                setPage(0);
            } else {
                setRevision(value => value + 1);
            }
            onMarkedRead?.();
        } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Não foi possível marcar todos os alertas como lidos.");
        } finally {
            setMarkingAll(false);
        }
    }

    useEffect(() => {
        const queryKey = JSON.stringify([mode, page, startDate, endDate]);
        const showLoader = lastQueryKey.current !== queryKey && !skipNextLoader.current;
        lastQueryKey.current = queryKey;
        skipNextLoader.current = false;
        const controller = new AbortController();
        if (showLoader) setLoading(true);
        void devJson<PageData<Alert>>(`/api/dev/health?section=alerts&view=${mode}&page=${page}&startDate=${startDate}&endDate=${endDate}`, { signal: controller.signal })
            .then(result => { setData(result); setError(""); }).catch(e => { if (!controller.signal.aborted) setError(e.message); }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [page, mode, startDate, endDate, revision, refresh]);
    useEffect(()=>setPage(0),[mode, startDate, endDate]);
    return <section className={styles.externalSection}>
        <div className={styles.alertsHeading}>
            <h2>{mode === "unread" ? "Novos Alertas" : "Histórico de Alertas"}</h2>
            {mode === "unread" && <Button type="button" variant="secondary"
                loading={markingAll} disabled={loading || Boolean(markingId) || data.total === 0}
                onClick={() => void markAllAsRead()}>
                Marcar todos como lidos
            </Button>}
        </div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className={`${styles.alertsTable} ${mode === "unread" ? styles.alertsUnread : styles.alertsHistory}`}>
        <PagedTable pageSize={10} onRowClick={setSelected} data={data} onPage={setPage} rowKey={row => String(row.id)} loading={loading} columns={[
            { key: "date", label: "Data", render: row => formatDateTime(row.last_seen_at||row.created_at), className: "whitespace-nowrap" },
            { key: "source", label: "Origem", render: row => <span title={row.source}>{row.source === "vps-monitor" ? "VPS" : row.source === "phone" || row.source === "unknown" ? "Origem não registrada" : row.source}</span>, className: "whitespace-nowrap" },
            { key: "operation", label: "Operação", render: row => presentAlert(row).operation || "—", className: "whitespace-nowrap" },
            { key: "trigger", label: "Trigger", render: row => {
                const t=row.trigger_type;
                if(!t)return "Não registrado";
                const labels={notification:"Notificação",alarm:"Alarme",blast:"Disparo",none:"Registro"} as const;
                const variants={notification:"info",alarm:"danger",blast:"brand",none:"neutral"} as const;
                return <Badge variant={variants[t]}>{labels[t]}</Badge>;
            }, className: "whitespace-nowrap" },
            { key: "count", label: "Ocorrências", render: row => row.occurrences ?? 1, className: "whitespace-nowrap" },
            { key: "title", label: "Alerta", render: row => <span className="block max-w-md truncate font-medium" title={`${presentAlert(row).headline} · ${presentAlert(row).explanation}`}>{presentAlert(row).headline}</span> },
            ...(mode === "unread" ? [{ key: "action", label: "Ação", className: "whitespace-nowrap", render: (row: Alert) =>
                <Button variant="secondary" loading={markingId === row.id} disabled={Boolean(markingId) || markingAll}
                    onClick={event => { event.stopPropagation(); void markAsRead(row); }}>
                    Marcar como lido
                </Button> }] : []),
        ]} />
        </div>
        <DevDialog open={Boolean(selected)} onClose={()=>{ if (!markingId) setSelected(null); }} title={selected ? presentAlert(selected).headline : "Alerta"}
            footer={mode === "unread" && selected ? <Button loading={markingId === selected.id}
                disabled={Boolean(markingId) || markingAll} onClick={() => void markAsRead(selected)}>Marcar como lido</Button> : undefined}><>
            {selected && <p className="mb-4 whitespace-pre-wrap text-sm leading-6">{presentAlert(selected).explanation}</p>}
            <div className="mb-3 space-y-1 text-sm text-gray-600">
                <p>Origem: {selected?.source === "vps-monitor" ? "Monitor VPS" : selected?.source || "—"} · Operação: {selected ? presentAlert(selected).operation || "—" : "—"}</p>
                <p>HTTP: {selected ? alertHttpStatus(selected) ?? "—" : "—"} · Ocorrências: {selected?.occurrences ?? 1}</p>
                <p>Primeira ocorrência: {formatDateTime(selected?.created_at||null)}</p>
                <p>Última ocorrência: {formatDateTime(selected?.last_seen_at||selected?.created_at||null)}</p>
                <p>Status: {selected?.resolved_at?"Resolvido":selected?.trigger_type?"Em aberto":"Histórico"}</p>
                <p>Notificado no celular: {selected?.phone_notified==null?"Não registrado":selected.phone_notified?"Sim":"Não"}</p>
            </div>
            {selected && presentAlert(selected).technical && <details className="mt-4 border-t border-[#e2e5e9] pt-3 text-sm">
                <summary className="cursor-pointer text-gray-600">Ver mensagem original</summary>
                <p className="mt-2 whitespace-pre-wrap leading-6">{selected.title}{"\n"}{selected.message}</p>
            </details>}
            {selected?.delivery_error&&<p role="alert" className="text-red-700">{selected.delivery_error}</p>}
        </></DevDialog>
    </section>;
}
