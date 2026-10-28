"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { ArrowLeftRight } from "lucide-react";
import { supabase } from "@/lib/database/supabaseClient";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ChoiceCardGroup from "@/components/ui/ChoiceCardGroup";
import DataTable from "@/components/ui/DataTable";
import Input from "@/components/ui/Input";
import Loader from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import Pagination from "@/components/ui/Pagination";
import Toast from "@/components/ui/Toast";

export type CashOrder = {
    id: string;
    display_id: number;
    created_at: string;
    status: string;
    payment_method: string | null;
    total_cents: number;
    is_delivery: string | null;
};

type CashEntry = { id: string; amount_cents: number; created_at: string; movement_type: "entry" | "withdrawal" };
type CashReport = { total: number; pix: number; card: number; cash: number; unspecified: number; confirmed: number; delivery: number; pickup: number; salon: number };
type CashMovement = { id: string; label: string; created_at: string; amount_cents: number; withdrawal: boolean };
const PAGE_SIZE = 15;
const formatMoney = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const formatAmountInput = (value: string) => {
    const digits = value.replace(/\D/g, "").slice(0, 10);
    return digits ? (Number(digits) / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";
};
const formatTime = (value: string) =>
    new Intl.DateTimeFormat("pt-BR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Sao_Paulo" }).format(new Date(value));

export default function CashRegister({ restaurantId, date, dateLabel, dateControls, orders, refreshKey, report, reportLoading, reportError }: {
    restaurantId: string;
    date: string;
    dateLabel: string;
    dateControls: ReactNode;
    orders: CashOrder[];
    refreshKey: number;
    report: CashReport;
    reportLoading: boolean;
    reportError: string;
}) {
    const [balance, setBalance] = useState<number | null>(null);
    const [balanceError, setBalanceError] = useState("");
    const [entries, setEntries] = useState<CashEntry[]>([]);
    const [movementsLoading, setMovementsLoading] = useState(true);
    const [movementsError, setMovementsError] = useState("");
    const [reload, setReload] = useState(0);
    const [page, setPage] = useState(0);
    const [movementOpen, setMovementOpen] = useState(false);
    const [movementType, setMovementType] = useState<"entry" | "withdrawal">("withdrawal");
    const [amount, setAmount] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState<string | null>(null);

    useEffect(() => {
        let canceled = false;
        setBalance(null);
        setBalanceError("");
        void (async () => {
            const { data, error } = await supabase.rpc("get_cash_balance", { p_restaurant_id: restaurantId });
            if (canceled) return;
            if (error || data === null || !Number.isSafeInteger(Number(data))) {
                setBalanceError("Não foi possível carregar o saldo.");
            } else {
                setBalance(Number(data));
            }
        })();
        return () => { canceled = true; };
    }, [restaurantId, refreshKey, reload]);

    useEffect(() => {
        let canceled = false;
        setPage(0);
        setMovementsLoading(true);
        setMovementsError("");
        void (async () => {
            const [year, month, day] = date.split("-").map(Number);
            const nextDate = new Date(Date.UTC(year, month - 1, day + 1)).toISOString().slice(0, 10);
            const { data, error } = await supabase.from("cash_withdrawals")
                .select("id, amount_cents, created_at, movement_type")
                .eq("restaurant_id", restaurantId)
                .gte("created_at", date + "T00:00:00-03:00")
                .lt("created_at", nextDate + "T00:00:00-03:00")
                .order("created_at", { ascending: false });
            if (canceled) return;
            if (error) setMovementsError("Não foi possível carregar as movimentações.");
            else setEntries((data || []) as CashEntry[]);
            setMovementsLoading(false);
        })();
        return () => { canceled = true; };
    }, [restaurantId, date, reload]);

    const movements = useMemo<CashMovement[]>(() => [
        ...orders.filter(order => order.status === "done" && order.payment_method === "dinheiro")
            .map(order => ({
                id: "order-" + order.id,
                label: "Pedido #" + order.display_id,
                created_at: order.created_at,
                amount_cents: Number(order.total_cents || 0),
                withdrawal: false,
            })),
        ...entries.map(item => ({
            id: "movement-" + item.id,
            label: item.movement_type === "entry" ? "Entrada" : "Retirada",
            created_at: item.created_at,
            amount_cents: item.amount_cents,
            withdrawal: item.movement_type === "withdrawal",
        })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [orders, entries]);

    const registerMovement = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (saving || balance === null) return;
        const cents = Number(amount.replace(/\D/g, ""));
        if (!Number.isSafeInteger(cents) || cents <= 0 || (movementType === "withdrawal" && cents > balance)) {
            setSubmitError(movementType === "withdrawal" ? "Informe um valor maior que zero e até o saldo disponível." : "Informe um valor maior que zero.");
            return;
        }
        setSaving(true);
        setSubmitError("");
        try {
            const { error } = await supabase.from("cash_withdrawals")
                .insert({ restaurant_id: restaurantId, amount_cents: cents, movement_type: movementType });
            if (error) throw error;
            setMovementOpen(false);
            setAmount("");
            setToast(movementType === "entry" ? "Entrada registrada." : "Retirada registrada.");
            setReload(value => value + 1);
        } catch (error) {
            console.error("Erro ao registrar movimentação:", error);
            setSubmitError("Não foi possível registrar a movimentação.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <div>
                    <h2 id="cash-closing-heading" className="text-xl font-semibold text-gray-900">Fechamento de Caixa</h2>
                    <p className="mt-1 text-sm text-gray-500">Resumo de {dateLabel}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <Button type="button" variant="secondary" disabled={balance === null}
                        onClick={() => { setAmount(""); setSubmitError(""); setMovementType("withdrawal"); setMovementOpen(true); }}
                        className="gap-2">
                        <ArrowLeftRight size={16} aria-hidden="true" />
                        Registrar movimentação de caixa
                    </Button>
                    {dateControls}
                </div>
            </div>
            {reportError ? (
                <p className="text-sm text-red-600">{reportError}</p>
            ) : reportLoading ? (
                <p className="py-4 text-sm text-gray-500" role="status">Calculando fechamento de caixa...</p>
            ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <Card className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">Caixa atual</p>
                        {balanceError ? (
                            <p className="mt-3 text-sm text-red-600">{balanceError}</p>
                        ) : balance === null ? (
                            <div className="mt-3"><Loader /></div>
                        ) : (
                            <p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums text-gray-900 2xl:text-3xl">{formatMoney(balance)}</p>
                        )}
                        <p className="mt-3 text-xs text-gray-500">Dinheiro recebido e entradas, menos retiradas</p>
                    </Card>
                    <Card className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">Total de vendas</p>
                        <p className="mt-3 break-words text-2xl font-semibold tracking-tight tabular-nums text-gray-900 2xl:text-3xl">{formatMoney(report.total)}</p>
                        <p className="mt-3 text-xs text-gray-500">{report.confirmed} pedidos pagos ou concluídos</p>
                    </Card>
                    <Card className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">Pedidos</p>
                        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-gray-900 2xl:text-3xl">{report.confirmed}</p>
                        <p className="mt-3 text-xs text-gray-500">{report.delivery} entregas · {report.pickup} retiradas · {report.salon} no salão</p>
                    </Card>
                    <Card className="min-w-0">
                        <p className="text-sm font-medium text-gray-500">Vendas por pagamento</p>
                        <div className="mt-3 space-y-1.5 text-xs">
                            {([
                                { label: "Pix", value: report.pix },
                                { label: "Cartão", value: report.card },
                                { label: "Dinheiro", value: report.cash },
                            ] as const).map(item => (
                                <div key={item.label} className="flex items-baseline justify-between gap-2">
                                    <span className="text-gray-500">{item.label}</span>
                                    <span className="font-semibold tabular-nums text-gray-900">{formatMoney(item.value)}</span>
                                </div>
                            ))}
                            {report.unspecified > 0 && (
                                <div className="flex items-baseline justify-between gap-2 border-t border-gray-100 pt-1.5">
                                    <span className="text-gray-500">Não informado</span>
                                    <span className="font-semibold tabular-nums text-gray-900">{formatMoney(report.unspecified)}</span>
                                </div>
                            )}
                        </div>
                    </Card>
                </div>
            )}
            {!reportError && !reportLoading && (
                <div>
                {movementsError ? (
                    <p className="text-sm text-red-600">{movementsError}</p>
                ) : (
                    <DataTable<CashMovement>
                        columns={[
                            { key: "created_at", label: "Horário", render: row => formatTime(row.created_at) },
                            { key: "label", label: "Movimentação", render: row => row.label },
                            { key: "amount", label: "Valor", className: "text-right", render: row => (
                                <span className={row.withdrawal ? "font-medium text-red-600" : "font-medium text-gray-900"}>
                                    {row.withdrawal ? "− " : "+ "}{formatMoney(row.amount_cents)}
                                </span>
                            ) },
                        ]}
                        rows={movements.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)}
                        rowKey={row => row.id}
                        loading={movementsLoading}
                        emptyMessage="Nenhuma movimentação em dinheiro nesta data."
                    />
                )}
                {!movementsLoading && !movementsError && movements.length > PAGE_SIZE && (
                    <div className="mt-3">
                        <Pagination page={page} pageCount={Math.ceil(movements.length / PAGE_SIZE)}
                            onChange={setPage} />
                    </div>
                )}
                </div>
            )}
            <Modal open={movementOpen} onClose={() => { if (!saving) setMovementOpen(false); }}
                height={395} className="max-w-md">
                <form className="space-y-4 p-5 sm:p-6" onSubmit={event => void registerMovement(event)}>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Movimentação de caixa</h3>
                        <p className="mt-1 text-sm text-gray-500">Caixa atual: {formatMoney(balance ?? 0)}</p>
                    </div>
                    <ChoiceCardGroup
                        aria-label="Tipo de movimentação"
                        value={movementType}
                        onChange={setMovementType}
                        disabled={saving}
                        options={[{ value: "entry", label: "Adicionar dinheiro" }, { value: "withdrawal", label: "Retirar dinheiro" }]}
                        className="!grid-cols-2 gap-2"
                    />
                    <Input label="Valor (R$)" inputMode="numeric" value={amount}
                        onChange={event => setAmount(formatAmountInput(event.target.value))}
                        placeholder="0,00" autoFocus disabled={saving} />
                    {submitError && <p className="text-sm text-red-600" role="alert">{submitError}</p>}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" disabled={saving} onClick={() => setMovementOpen(false)}>Cancelar</Button>
                        <Button type="submit" loading={saving}>Registrar</Button>
                    </div>
                </form>
            </Modal>
            {toast && <Toast message={toast} type="success" onClose={() => setToast(null)} />}
        </div>
    );
}
