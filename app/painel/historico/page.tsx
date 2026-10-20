"use client";

import { useState, useEffect, useMemo, useRef } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import { useCreationStore } from "@/lib/stores/restaurant-owner/creationStore"; // Store Global
import Pagination from "@/components/ui/Pagination";
import { orderSearchFilter } from "@/lib/utils/orderSearch";
import type { DateRange } from "@/lib/utils/dateRange";
import OrdersFilter from "@/components/restaurant-owner/pedidos/OrdersFilter";
import OrdersTable, { Order } from "@/components/restaurant-owner/pedidos/OrdersTable";
import OrderDetailsModal from "@/components/restaurant-owner/pedidos/OrderDetailsModal";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Toast from "@/components/ui/Toast";
import Link from "next/link";
import { faArrowRight, faChartLine } from "@fortawesome/free-solid-svg-icons";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ListLoader from "@/components/ui/ListLoader";
import { Wallet, RefreshCw, Download, Save } from "lucide-react";



type CashGroupKey = "pixOnline" | "pixDelivery" | "cardOnline" | "cardMachine" | "cash";
type CashGroup = { count: number; cents: number };
type CashOrder = {
    display_id: number | null;
    created_at: string;
    status: string;
    payment_method: string | null;
    total_cents: number;
    delivery_cents: number | null;
    coupon_discount_cents: number | null;
};
type CashClosing = {
    closing_date: string;
    opening_cash_cents: number;
    cash_in_cents: number;
    cash_out_cents: number;
    counted_cash_cents: number;
    expected_cash_cents: number;
    sales_cash_cents: number;
    sales_pix_cents: number;
    sales_card_cents: number;
    orders_count: number;
    notes: string | null;
    closed_at: string;
};
type CashForm = { opening: string; added: string; removed: string; counted: string; notes: string };

const CASH_PAGE_SIZE = 1000;
const CASH_METHODS = ["pix", "pix-entrega", "cartao", "trazer-maquininha", "dinheiro"];
const CASH_PAID_STATUSES = ["done", "paid", "preparing", "delivering"];
const CASH_DEFAULT_FORM: CashForm = { opening: "0,00", added: "0,00", removed: "0,00", counted: "", notes: "" };
const CASH_METHOD_DETAILS: { label: string; parts: CashGroupKey[]; detail: string }[] = [
    { label: "Pix", parts: ["pixOnline", "pixDelivery"], detail: "Online e na entrega" },
    { label: "Cartão", parts: ["cardOnline", "cardMachine"], detail: "Online e maquininha" },
    { label: "Dinheiro", parts: ["cash"], detail: "Pagamento físico" },
];
const formatCashTotal = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatCashInput = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const cashDateToday = () => {
    const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: "America/Sao_Paulo", year: "numeric", month: "2-digit", day: "2-digit",
    }).formatToParts(new Date());
    const part = (type: string) => parts.find(item => item.type === type)?.value || "";
    return [part("year"), part("month"), part("day")].join("-");
};
const cashDateOffset = (daysAgo: number) => {
    const date = new Date(cashDateToday() + "T12:00:00Z");
    date.setUTCDate(date.getUTCDate() - daysAgo);
    return date.toISOString().slice(0, 10);
};
const formatCashDate = (date: string) =>
    new Date(date + "T12:00:00Z").toLocaleDateString("pt-BR", {
        day: "2-digit", month: "long", year: "numeric", timeZone: "UTC",
    });
const moneyFieldToCents = (raw: string): number | null => {
    const cleaned = raw.replace(/\s|R\$/g, "").trim();
    if (!cleaned || !/^[\d.,]+$/.test(cleaned)) return null;
    const value = cleaned.includes(",")
        ? cleaned.replace(/\./g, "").replace(",", ".")
        : cleaned;
    if (!/^\d+(\.\d{1,2})?$/.test(value)) return null;
    const cents = Math.round(Number(value) * 100);
    return Number.isSafeInteger(cents) && cents >= 0 ? cents : null;
};

function summarizeCashOrders(orders: CashOrder[]) {
    const groups: Record<CashGroupKey, CashGroup> = {
        pixOnline: { count: 0, cents: 0 },
        pixDelivery: { count: 0, cents: 0 },
        cardOnline: { count: 0, cents: 0 },
        cardMachine: { count: 0, cents: 0 },
        cash: { count: 0, cents: 0 },
    };
    let confirmed = 0, canceled = 0, canceledCents = 0;
    let pending = 0, pendingCents = 0, noMethod = 0;
    let deliveryCents = 0, discountCents = 0;
    for (const order of orders) {
        const cents = Number(order.total_cents || 0);
        if (order.status === "canceled") {
            canceled++;
            canceledCents += cents;
            continue;
        }
        if (!order.payment_method || !CASH_METHODS.includes(order.payment_method)) {
            noMethod++;
            continue;
        }
        const online = order.payment_method === "pix" || order.payment_method === "cartao";
        if (!CASH_PAID_STATUSES.includes(order.status) || (!online && order.status !== "done")) {
            pending++;
            pendingCents += cents;
            continue;
        }
        const key: CashGroupKey =
            order.payment_method === "pix" ? "pixOnline"
            : order.payment_method === "pix-entrega" ? "pixDelivery"
            : order.payment_method === "cartao" ? "cardOnline"
            : order.payment_method === "trazer-maquininha" ? "cardMachine"
            : "cash";
        groups[key].count++;
        groups[key].cents += cents;
        confirmed++;
        deliveryCents += Number(order.delivery_cents || 0);
        discountCents += Number(order.coupon_discount_cents || 0);
    }
    const pix = groups.pixOnline.cents + groups.pixDelivery.cents;
    const card = groups.cardOnline.cents + groups.cardMachine.cents;
    const cash = groups.cash.cents;
    return {
        groups, pix, card, cash, total: pix + card + cash, confirmed,
        canceled, canceledCents, pending, pendingCents, noMethod,
        deliveryCents, discountCents,
    };
}

function DailyCashClosing({ restaurantId, refreshKey }: {
    restaurantId: string | null;
    refreshKey: number;
}) {
    const [dayOffset, setDayOffset] = useState(0);
    const [reloadKey, setReloadKey] = useState(0);
    const date = cashDateOffset(dayOffset);
    const [orders, setOrders] = useState<CashOrder[]>([]);
    const [history, setHistory] = useState<CashClosing[]>([]);
    const [saved, setSaved] = useState<CashClosing | null>(null);
    const [form, setForm] = useState<CashForm>(CASH_DEFAULT_FORM);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState("");
    const [saveFeedback, setSaveFeedback] = useState("");

    useEffect(() => {
        if (!restaurantId) { setLoading(false); return; }
        let canceled = false;
        const load = async () => {
            setLoading(true);
            setError("");
            setSaveFeedback("");
            setOrders([]);
            setForm(CASH_DEFAULT_FORM);
            setSaved(null);
            try {
                const [year, month, day] = date.split("-").map(Number);
                const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
                const [savedResult, historyResult] = await Promise.all([
                    supabase.from("cash_closings").select("*")
                        .eq("restaurant_id", restaurantId).eq("closing_date", date).maybeSingle(),
                    supabase.from("cash_closings")
                        .select("closing_date, opening_cash_cents, cash_in_cents, cash_out_cents, counted_cash_cents, expected_cash_cents, sales_cash_cents, sales_pix_cents, sales_card_cents, orders_count, notes, closed_at")
                        .eq("restaurant_id", restaurantId).order("closing_date", { ascending: false }).limit(6),
                ]);
                if (savedResult.error) throw savedResult.error;
                if (historyResult.error) throw historyResult.error;
                const all: CashOrder[] = [];
                while (true) {
                    const { data, error: queryError } = await supabase
                        .from("orders")
                        .select("display_id, created_at, status, payment_method, total_cents, delivery_cents, coupon_discount_cents")
                        .eq("restaurant_id", restaurantId)
                        .gte("created_at", date + "T00:00:00-03:00")
                        .lt("created_at", nextDate + "T00:00:00-03:00")
                        .order("created_at", { ascending: true })
                        .order("id", { ascending: true })
                        .range(all.length, all.length + CASH_PAGE_SIZE - 1);
                    if (canceled) return;
                    if (queryError) throw queryError;
                    all.push(...((data || []) as CashOrder[]));
                    if (!data || data.length < CASH_PAGE_SIZE) break;
                }
                if (canceled) return;
                const previous = (savedResult.data as CashClosing | null) || null;
                setOrders(all);
                setHistory((historyResult.data || []) as CashClosing[]);
                setSaved(previous);
                if (previous) setForm({
                    opening: formatCashInput(Number(previous.opening_cash_cents)),
                    added: formatCashInput(Number(previous.cash_in_cents)),
                    removed: formatCashInput(Number(previous.cash_out_cents)),
                    counted: formatCashInput(Number(previous.counted_cash_cents)),
                    notes: previous.notes || "",
                });
            } catch (caught) {
                console.error("Erro ao carregar fechamento de caixa:", caught);
                if (!canceled) setError("Não foi possível carregar o fechamento de caixa.");
            } finally {
                if (!canceled) setLoading(false);
            }
        };
        void load();
        return () => { canceled = true; };
    }, [restaurantId, date, refreshKey, reloadKey]);

    const report = useMemo(() => summarizeCashOrders(orders), [orders]);
    const opening = moneyFieldToCents(form.opening);
    const added = moneyFieldToCents(form.added);
    const removed = moneyFieldToCents(form.removed);
    const counted = moneyFieldToCents(form.counted);
    const validAmounts = opening !== null && added !== null && removed !== null;
    const expected = validAmounts ? opening + report.cash + added - removed : null;
    const difference = counted !== null && expected !== null ? counted - expected : null;
    const savedTotal = saved
        ? Number(saved.sales_cash_cents) + Number(saved.sales_pix_cents) + Number(saved.sales_card_cents)
        : null;
    const changedSinceClosing = !!saved && (savedTotal !== report.total || Number(saved.orders_count) !== report.confirmed);
    const methodRows = CASH_METHOD_DETAILS.map(({ label, parts, detail }) => ({
        label, detail, count: parts.reduce((a, key) => a + report.groups[key].count, 0),
        cents: parts.reduce((a, key) => a + report.groups[key].cents, 0),
        parts,
    }));

    const updateForm = (key: keyof CashForm, value: string) => {
        setForm(previous => ({ ...previous, [key]: value }));
        setSaveFeedback("");
    };
    const saveClosing = async () => {
        if (!restaurantId || saving) return;
        if (!validAmounts || counted === null || expected === null) {
            setSaveFeedback("Preencha todos os valores da conferência com números válidos.");
            return;
        }
        setSaving(true);
        setSaveFeedback("");
        try {
            const { data: userData, error: authError } = await supabase.auth.getUser();
            if (authError || !userData.user) throw authError || new Error("Sessão expirada");
            const now = new Date().toISOString();
            const { data, error: saveError } = await supabase.from("cash_closings").upsert({
                restaurant_id: restaurantId,
                closing_date: date,
                opening_cash_cents: opening,
                cash_in_cents: added,
                cash_out_cents: removed,
                counted_cash_cents: counted,
                expected_cash_cents: expected,
                sales_cash_cents: report.cash,
                sales_pix_cents: report.pix,
                sales_card_cents: report.card,
                orders_count: report.confirmed,
                notes: form.notes.trim() || null,
                closed_by: userData.user.id,
                closed_at: now,
                updated_at: now,
            }, { onConflict: "restaurant_id,closing_date" }).select("*").single();
            if (saveError) throw saveError;
            const savedRow = data as CashClosing;
            setSaved(savedRow);
            setHistory(previous => [savedRow, ...previous.filter(row => row.closing_date !== date)]
                .sort((a, b) => b.closing_date.localeCompare(a.closing_date)).slice(0, 6));
            setSaveFeedback("Fechamento salvo com sucesso.");
        } catch (caught) {
            console.error("Erro ao salvar fechamento de caixa:", caught);
            setSaveFeedback("Não foi possível salvar o fechamento. Tente novamente.");
        } finally {
            setSaving(false);
        }
    };

    const exportOrders = () => {
        const rows: (string | number)[][] = [
            ["Fechamento de Caixa", formatCashDate(date)],
            ["Total considerado", formatCashTotal(report.total)],
            ["Pedidos considerados", report.confirmed],
            ["Pix", formatCashTotal(report.pix)],
            ["Cartão", formatCashTotal(report.card)],
            ["Dinheiro", formatCashTotal(report.cash)],
            ["Pendentes", report.pending, formatCashTotal(report.pendingCents)],
            ["Cancelados", report.canceled, formatCashTotal(report.canceledCents)],
            ["Sem forma de pagamento", report.noMethod],
            ["Taxa de entrega incluída", formatCashTotal(report.deliveryCents)],
            ["Descontos já aplicados", formatCashTotal(report.discountCents)],
            [],
            ["Pedido", "Data e hora", "Situação", "Pagamento", "Total (R$)", "Entrega (R$)", "Desconto (R$)"],
            ...orders.map(order => [
                order.display_id || "",
                new Date(order.created_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" }),
                order.status, order.payment_method || "Não informado",
                formatCashInput(Number(order.total_cents || 0)),
                formatCashInput(Number(order.delivery_cents || 0)),
                formatCashInput(Number(order.coupon_discount_cents || 0)),
            ]),
        ];
        const escaped = rows.map(row => row.map(value => {
            const raw = String(value);
            const safe = /^[=+@-]/.test(raw) ? "'" + raw : raw;
            return '"' + safe.replace(/"/g, '""') + '"';
        }).join(";")).join("\r\n");
        const url = URL.createObjectURL(new Blob(["\uFEFF", escaped], { type: "text/csv;charset=utf-8" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "fechamento-caixa-" + date + ".csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    };

    return (
        <section aria-labelledby="cash-closing-heading" className="space-y-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <div className="mb-2 flex items-center gap-2 text-brand">
                        <Wallet size={20} aria-hidden="true" />
                        <span className="text-xs font-semibold uppercase tracking-wider">Controle financeiro</span>
                    </div>
                    <h2 id="cash-closing-heading" className="text-2xl font-semibold tracking-tight text-gray-900">Fechamento de Caixa</h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Resumo dos pedidos registrados em {formatCashDate(date)}.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex items-center gap-1 rounded-lg border border-[#e2e5e9] bg-white p-1">
                        {([{ value: 0, label: "Hoje" }, { value: 1, label: "Ontem" }] as const).map(day => (
                            <button key={day.value} type="button" onClick={() => setDayOffset(day.value)}
                                aria-pressed={dayOffset === day.value}
                                className={dayOffset === day.value
                                    ? "rounded-md bg-[#f1f3f5] px-3 py-2 text-xs font-semibold text-gray-900"
                                    : "rounded-md px-3 py-2 text-xs font-medium text-gray-500 hover:bg-gray-50"}>
                                {day.label}
                            </button>
                        ))}
                    </div>
                    <Button type="button" variant="secondary" disabled={loading || saving}
                        onClick={() => setReloadKey(value => value + 1)}>
                        <RefreshCw size={14} className="mr-2" /> Atualizar
                    </Button>
                    <Button type="button" variant="secondary" disabled={loading || !!error}
                        onClick={exportOrders}>
                        <Download size={14} className="mr-2" /> Exportar CSV
                    </Button>
                </div>
            </div>
            {error ? (
                <Card className="border-red-200 bg-red-50"><p className="text-sm text-red-700">{error}</p></Card>
            ) : loading ? (
                <Card><ListLoader lines={6} /></Card>
            ) : (
                <>
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Card className="border-brand/20 bg-brand/5">
                            <p className="text-sm font-medium text-gray-600">Vendas consideradas</p>
                            <p className="mt-3 break-words text-3xl font-semibold tracking-tight tabular-nums text-gray-900">{formatCashTotal(report.total)}</p>
                            <p className="mt-3 text-xs text-gray-500">Total de Pix + cartão + dinheiro</p>
                        </Card>
                        <Card>
                            <p className="text-sm font-medium text-gray-500">Pedidos considerados</p>
                            <p className="mt-3 text-3xl font-semibold tabular-nums text-gray-900">{report.confirmed}</p>
                            <p className="mt-3 text-xs text-gray-500">Pagos online ou concluídos na entrega</p>
                        </Card>
                        <Card>
                            <p className="text-sm font-medium text-gray-500">Ticket médio</p>
                            <p className="mt-3 break-words text-3xl font-semibold tabular-nums text-gray-900">
                                {formatCashTotal(report.confirmed ? Math.round(report.total / report.confirmed) : 0)}
                            </p>
                            <p className="mt-3 text-xs text-gray-500">Valor médio por pedido considerado</p>
                        </Card>
                        <Card>
                            <p className="text-sm font-medium text-gray-500">Pedidos cancelados</p>
                            <p className="mt-3 text-3xl font-semibold tabular-nums text-gray-900">{report.canceled}</p>
                            <p className="mt-3 text-xs text-gray-500">{formatCashTotal(report.canceledCents)} fora das vendas</p>
                        </Card>
                    </div>

                    <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
                        <Card>
                            <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
                                <div>
                                    <h3 className="text-base font-semibold text-gray-900">Recebimentos por forma de pagamento</h3>
                                    <p className="mt-1 text-xs text-gray-500">Distribuição das vendas consideradas</p>
                                </div>
                                <span className="text-xs text-gray-500">{report.confirmed} pedidos</span>
                            </div>
                            <div className="space-y-6">
                                {methodRows.map(row => (
                                    <div key={row.label}>
                                        <div className="flex flex-wrap items-baseline justify-between gap-2">
                                            <div className="flex items-baseline gap-2">
                                                <span className="font-medium text-gray-900">{row.label}</span>
                                                <span className="text-xs text-gray-500">{row.count} {row.count === 1 ? "pedido" : "pedidos"}</span>
                                            </div>
                                            <span className="font-semibold tabular-nums text-gray-900">{formatCashTotal(row.cents)}</span>
                                        </div>
                                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-100">
                                            <div className="h-full rounded-full bg-brand" style={{
                                                width: (report.total ? (row.cents / report.total) * 100 : 0) + "%",
                                            }} />
                                        </div>
                                        <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-gray-500">
                                            <span>{row.detail}</span>
                                            <span className="tabular-nums">{report.total ? ((row.cents / report.total) * 100).toFixed(1).replace(".", ",") : "0,0"}%</span>
                                        </div>
                                        {row.parts.length > 1 && (
                                            <div className="mt-2 grid gap-1 text-xs text-gray-500 sm:grid-cols-2">
                                                <span>{row.label === "Pix" ? "Online" : "Online"}: {formatCashTotal(report.groups[row.parts[0]].cents)} · {report.groups[row.parts[0]].count}</span>
                                                <span>{row.label === "Pix" ? "Na entrega" : "Maquininha"}: {formatCashTotal(report.groups[row.parts[1]].cents)} · {report.groups[row.parts[1]].count}</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </Card>
                        <Card>
                            <h3 className="text-base font-semibold text-gray-900">Conciliação do dia</h3>
                            <p className="mt-1 text-xs text-gray-500">Valores que ajudam a conferir o fechamento</p>
                            <div className="mt-5 divide-y divide-gray-100">
                                {[
                                    { label: "Pedidos ainda em aberto", count: report.pending, value: formatCashTotal(report.pendingCents) },
                                    { label: "Pedidos cancelados", count: report.canceled, value: formatCashTotal(report.canceledCents) },
                                    { label: "Sem forma de pagamento", count: report.noMethod, value: report.noMethod ? "Verificar" : "Nenhum" },
                                    { label: "Taxas de entrega", count: null, value: formatCashTotal(report.deliveryCents) },
                                    { label: "Descontos aplicados", count: null, value: formatCashTotal(report.discountCents) },
                                ].map(item => (
                                    <div key={item.label} className="flex items-center justify-between gap-3 py-3">
                                        <div className="min-w-0">
                                            <p className="text-sm text-gray-700">{item.label}</p>
                                            {item.count !== null && <p className="text-xs text-gray-400">{item.count} {item.count === 1 ? "pedido" : "pedidos"}</p>}
                                        </div>
                                        <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-900">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                            <p className="mt-3 text-xs leading-5 text-gray-500">
                                Taxas de entrega e descontos já estão refletidos nos totais dos pedidos. Pendentes e cancelados não entram no faturamento considerado.
                            </p>
                        </Card>
                    </div>

                    <Card>
                        <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">Conferência do dinheiro em caixa</h3>
                                <p className="mt-1 text-sm text-gray-500">Informe a contagem física para comparar com o valor esperado.</p>
                            </div>
                            <span className={saved ? "rounded-full bg-green-50 px-3 py-1.5 text-xs font-medium text-green-700"
                                : "rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-600"}>
                                {saved ? "Fechamento registrado" : "Ainda não registrado"}
                            </span>
                        </div>
                        {changedSinceClosing && (
                            <p className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
                                Os pedidos mudaram desde o último fechamento. Confira os valores antes de salvar novamente.
                            </p>
                        )}
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                            {([
                                { key: "opening", label: "Troco inicial" },
                                { key: "added", label: "Suprimentos / entradas" },
                                { key: "removed", label: "Sangrias / saídas" },
                                { key: "counted", label: "Dinheiro contado" },
                            ] as const).map(item => (
                                <Input key={item.key} label={item.label} inputMode="decimal" type="text"
                                    value={form[item.key]} placeholder="0,00"
                                    onChange={event => updateForm(item.key, event.target.value)}
                                    onBlur={() => {
                                        const cents = moneyFieldToCents(form[item.key]);
                                        if (cents !== null) updateForm(item.key, formatCashInput(cents));
                                    }} />
                            ))}
                        </div>
                        <div className="mt-5 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-4 sm:grid-cols-3">
                            <div>
                                <p className="text-xs text-gray-500">Dinheiro esperado</p>
                                <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{expected !== null ? formatCashTotal(expected) : "—"}</p>
                                <p className="mt-1 text-xs text-gray-500">Troco + vendas + entradas − saídas</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Dinheiro contado</p>
                                <p className="mt-1 text-xl font-semibold tabular-nums text-gray-900">{counted !== null ? formatCashTotal(counted) : "—"}</p>
                                <p className="mt-1 text-xs text-gray-500">Valor informado por você</p>
                            </div>
                            <div>
                                <p className="text-xs text-gray-500">Diferença</p>
                                <p className={difference === null ? "mt-1 text-xl font-semibold text-gray-500"
                                    : difference === 0 ? "mt-1 text-xl font-semibold tabular-nums text-green-700"
                                    : "mt-1 text-xl font-semibold tabular-nums text-red-700"}>
                                    {difference !== null ? formatCashTotal(difference) : "—"}
                                </p>
                                <p className="mt-1 text-xs text-gray-500">
                                    {difference === null ? "Informe a contagem" : difference === 0 ? "Caixa conferido" : difference > 0 ? "Sobra no caixa" : "Falta no caixa"}
                                </p>
                            </div>
                        </div>
                        <div className="mt-4">
                            <label htmlFor="cash-closing-notes" className="mb-1.5 block text-xs font-medium text-gray-700">Observações do fechamento (opcional)</label>
                            <textarea id="cash-closing-notes" rows={2} maxLength={1000} value={form.notes}
                                onChange={event => updateForm("notes", event.target.value)}
                                placeholder="Registre diferenças, trocos, sangrias ou conferências relevantes."
                                className="w-full rounded-lg border border-[#e2e5e9] bg-white px-3 py-2 text-sm text-gray-900 outline-none focus:border-brand" />
                        </div>
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                            <p className="max-w-2xl text-xs leading-5 text-gray-500">
                                O dinheiro esperado considera pedidos marcados como concluídos. A contagem e as movimentações são informadas manualmente, não verificadas pelo iMenu.
                            </p>
                            <Button type="button" disabled={saving || counted === null || !validAmounts} onClick={() => void saveClosing()}>
                                <Save size={14} className="mr-2" /> {saving ? "Salvando..." : saved ? "Atualizar fechamento" : "Registrar fechamento"}
                            </Button>
                        </div>
                        {saveFeedback && <p role="status" className={saveFeedback.includes("sucesso") ? "mt-3 text-sm text-green-700" : "mt-3 text-sm text-red-700"}>{saveFeedback}</p>}
                        {saved && <p className="mt-2 text-xs text-gray-500">Último registro em {new Date(saved.closed_at).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" })}.</p>}
                    </Card>

                    {history.length > 0 && (
                        <Card>
                            <h3 className="text-base font-semibold text-gray-900">Últimos fechamentos</h3>
                            <div className="mt-3 overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead><tr className="border-b border-gray-200 text-xs text-gray-500">
                                        <th className="py-3 pr-4 font-medium">Data</th>
                                        <th className="py-3 pr-4 font-medium">Pedidos</th>
                                        <th className="py-3 pr-4 font-medium text-right">Esperado</th>
                                        <th className="py-3 pr-4 font-medium text-right">Contado</th>
                                        <th className="py-3 font-medium text-right">Diferença</th>
                                    </tr></thead>
                                    <tbody>{history.map(row => {
                                        const gap = Number(row.counted_cash_cents) - Number(row.expected_cash_cents);
                                        return (
                                            <tr key={row.closing_date} className="border-b border-gray-100 last:border-0">
                                                <td className="py-3 pr-4 font-medium text-gray-900">{formatCashDate(row.closing_date)}</td>
                                                <td className="py-3 pr-4 text-gray-600">{row.orders_count}</td>
                                                <td className="py-3 pr-4 text-right tabular-nums text-gray-700">{formatCashTotal(Number(row.expected_cash_cents))}</td>
                                                <td className="py-3 pr-4 text-right tabular-nums text-gray-700">{formatCashTotal(Number(row.counted_cash_cents))}</td>
                                                <td className={gap === 0 ? "py-3 text-right font-medium tabular-nums text-green-700" : "py-3 text-right font-medium tabular-nums text-red-700"}>
                                                    {formatCashTotal(gap)}
                                                </td>
                                            </tr>
                                        );
                                    })}</tbody>
                                </table>
                            </div>
                        </Card>
                    )}
                    <p className="text-xs leading-5 text-gray-500">
                        Base: pedidos criados no dia (horário de Brasília). Pix/cartão online após saída do status de pagamento pendente;
                        Pix na entrega, maquininha e dinheiro quando o pedido é concluído. Não é extrato bancário nem confirmação automática de recebimento físico;
                        taxas dos intermediadores não são descontadas.
                    </p>
                </>
            )}
        </section>
    );
}

const PAGE_SIZE = 10;

export default function HistoricoPage() {
    const { restaurantId, setRestaurantId } = useCreationStore();
    const [isLoading, setIsLoading] = useState(true);
    const [orders, setOrders] = useState<Order[]>([]);

    // Paginação
    const [page, setPage] = useState(0);
    const [totalCount, setTotalCount] = useState(0);
    const [cashRefreshKey, setCashRefreshKey] = useState(0);
    const requestId = useRef(0);

    // Filtros
    const [search, setSearch] = useState("");
    const [searchTerm, setSearchTerm] = useState("");
    const [range, setRange] = useState<DateRange>({ startDate: "", endDate: "" });
    const [selectedStatus, setSelectedStatus] = useState("todas");

    // Modal
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isDetailsOpen, setIsDetailsOpen] = useState(false);
    const [orderToDelete, setOrderToDelete] = useState<Order | null>(null);
    const [isDeleting, setIsDeleting] = useState(false);
    const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

    // 1. Inicialização (Busca ID se não tiver)
    useEffect(() => {
        const init = async () => {
            if (restaurantId) return; // Já temos ID no Zustand

            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;

            const { data: rest } = await supabase
                .from("restaurants")
                .select("id")
                .eq("user_id", session.user.id)
                .single();

            if (rest) {
                setRestaurantId(rest.id);
            }
        };
        init();
    }, [restaurantId, setRestaurantId]);

    useEffect(() => {
        const timer = window.setTimeout(() => { setSearchTerm(search); setPage(0); }, 250);
        return () => window.clearTimeout(timer);
    }, [search]);

    useEffect(() => {
        if (restaurantId) void fetchOrders(restaurantId);
        return () => { requestId.current += 1; };
    }, [restaurantId, page, searchTerm, range.startDate, range.endDate, selectedStatus]);

    // 3. Lógica de Busca
    const fetchOrders = async (restId: string) => {
        const currentRequest = ++requestId.current;
        setIsLoading(true);
        try {
            let query = supabase
                .from("orders")
                .select("id, display_id, created_at, customer_name, customer_address, status, payment_method, is_delivery, table_name_snapshot, total_cents", { count: 'exact' })
                .eq("restaurant_id", restId)
                .neq("status", "pending_online_payment")
                .order("created_at", { ascending: false })
                .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

            const searchFilter = orderSearchFilter(searchTerm);
            if (searchFilter) query = query.or(searchFilter);
            if (range.startDate) query = query.gte("created_at", new Date(range.startDate + "T00:00:00").toISOString());
            if (range.endDate) query = query.lte("created_at", new Date(range.endDate + "T23:59:59.999").toISOString());

            if (selectedStatus !== "todas") query = query.eq("status", selectedStatus);

            const { data, error, count } = await query;
            if (currentRequest !== requestId.current) return;
            if (error) throw error;

            setOrders(data as any[] || []);

            setTotalCount(count ?? data?.length ?? 0);

        } catch (err) {
            console.error("Erro ao buscar pedidos:", err);
        } finally {
            if (currentRequest === requestId.current) setIsLoading(false);
        }
    };

    const handleViewOrder = (order: Order) => {
        setSelectedOrder(order);
        setIsDetailsOpen(true);
    };

    // Callback chamado quando o modal altera status
    const handleOrderUpdate = () => {
        setCashRefreshKey(value => value + 1);
        if (restaurantId) fetchOrders(restaurantId);
    };

    const handleDeleteOrder = async () => {
        if (!restaurantId || !orderToDelete || isDeleting) return;
        setIsDeleting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session?.access_token) throw new Error("Sessão inválida ou expirada.");

            const response = await fetch(`/api/orders/${orderToDelete.id}`, {
                method: "DELETE",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ restaurant_id: restaurantId }),
            });
            const result = await response.json().catch(() => null);
            if (!response.ok) throw new Error(result?.error || "Não foi possível excluir o pedido.");

            setOrderToDelete(null);
            setToast({ message: "Pedido excluído.", type: "success" });
            setCashRefreshKey(value => value + 1);
            if (page > 0 && orders.length === 1) {
                setPage(page - 1);
            } else {
                await fetchOrders(restaurantId);
            }
        } catch (error) {
            setToast({
                message: error instanceof Error ? error.message : "Não foi possível excluir o pedido.",
                type: "error",
            });
        } finally {
            setIsDeleting(false);
        }
    };

    return (
        <div className="max-w-7xl 2xl:max-w-9xl mx-auto pb-20 space-y-8 px-4 sm:px-6 pt-8">
            <div>
                <h1 className="text-3xl font-bold text-gray-900">Histórico de Pedidos</h1>
            </div>

            <OrdersFilter
                search={search} onSearchChange={setSearch}
                range={range} onRangeChange={value => { setRange(value); setPage(0); }}
                selectedStatus={selectedStatus} onStatusChange={value => { setSelectedStatus(value); setPage(0); }}
            />

            <OrdersTable
                orders={orders}
                isLoading={isLoading}
                onViewOrder={handleViewOrder}
                onDeleteOrder={setOrderToDelete}
            />

            {(totalCount > 0 || page > 0) && <Pagination page={page} pageCount={Math.ceil(totalCount / PAGE_SIZE)} onChange={setPage} disabled={isLoading} />}

            <DailyCashClosing restaurantId={restaurantId} refreshKey={cashRefreshKey} />

            <Card className="overflow-hidden border-brand/20 bg-brand/5">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex min-w-0 items-start gap-4">
                        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white text-xl text-brand shadow-sm">
                            <FontAwesomeIcon icon={faChartLine} />
                        </span>
                        <div className="min-w-0 max-w-2xl">
                            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brand">
                                Analytics
                            </p>
                            <h2 className="mt-1 text-lg font-bold text-gray-900 2xl:text-xl">
                                Quer entender melhor o que está por trás das vendas?
                            </h2>
                            <p className="mt-1 text-sm leading-6 text-gray-600 2xl:text-base">
                                Descubra os itens mais pedidos, categorias que mais vendem, combinações de compra e outros indicadores do seu cardápio.
                            </p>
                        </div>
                    </div>
                    <Link
                        href="/painel/analytics"
                        className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition hover:brightness-95"
                    >
                        Abrir Analytics
                        <FontAwesomeIcon icon={faArrowRight} />
                    </Link>
                </div>
            </Card>

            <ConfirmModal
                open={orderToDelete !== null}
                onClose={() => { if (!isDeleting) setOrderToDelete(null); }}
                onConfirm={() => void handleDeleteOrder()}
                title="Excluir pedido?"
                description={`O pedido #${orderToDelete?.display_id || orderToDelete?.id.slice(0, 4) || ""} será removido permanentemente do histórico e das métricas. A exclusão não reembolsa pagamentos.`}
                confirmLabel="Excluir pedido"
                isLoading={isDeleting}
                variant="danger"
            />

            {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}

            <OrderDetailsModal
                isOpen={isDetailsOpen}
                onClose={() => setIsDetailsOpen(false)}
                order={selectedOrder}
                onOrderUpdate={handleOrderUpdate}
            />
        </div>
    );
}
