"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import { supabase } from "@/lib/database/supabaseClient";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
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

type CashWithdrawal = { id: string; amount_cents: number; created_at: string };
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

export default function CashRegister({ restaurantId, date, orders, refreshKey }: {
    restaurantId: string;
    date: string;
    orders: CashOrder[];
    refreshKey: number;
}) {
    const [balance, setBalance] = useState<number | null>(null);
    const [balanceError, setBalanceError] = useState("");
    const [withdrawals, setWithdrawals] = useState<CashWithdrawal[]>([]);
    const [movementsLoading, setMovementsLoading] = useState(true);
    const [movementsError, setMovementsError] = useState("");
    const [reload, setReload] = useState(0);
    const [page, setPage] = useState(0);
    const [withdrawOpen, setWithdrawOpen] = useState(false);
    const [amount, setAmount] = useState("");
    const [submitError, setSubmitError] = useState("");
    const [saving, setSaving] = useState(false);
    const [toast, setToast] = useState(false);

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
                .select("id, amount_cents, created_at")
                .eq("restaurant_id", restaurantId)
                .gte("created_at", date + "T00:00:00-03:00")
                .lt("created_at", nextDate + "T00:00:00-03:00")
                .order("created_at", { ascending: false });
            if (canceled) return;
            if (error) setMovementsError("Não foi possível carregar as movimentações.");
            else setWithdrawals((data || []) as CashWithdrawal[]);
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
        ...withdrawals.map(item => ({
            id: "withdrawal-" + item.id,
            label: "Retirada",
            created_at: item.created_at,
            amount_cents: item.amount_cents,
            withdrawal: true,
        })),
    ].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [orders, withdrawals]);

    const withdraw = async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        if (saving || balance === null) return;
        const cents = Number(amount.replace(/\D/g, ""));
        if (!Number.isSafeInteger(cents) || cents <= 0 || cents > balance) {
            setSubmitError("Informe um valor maior que zero e até o saldo disponível.");
            return;
        }
        setSaving(true);
        setSubmitError("");
        try {
            const { error } = await supabase.from("cash_withdrawals")
                .insert({ restaurant_id: restaurantId, amount_cents: cents });
            if (error) throw error;
            setWithdrawOpen(false);
            setAmount("");
            setToast(true);
            setReload(value => value + 1);
        } catch (error) {
            console.error("Erro ao registrar retirada:", error);
            setSubmitError("Não foi possível registrar a retirada.");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex flex-wrap items-end justify-between gap-3">
                <Card className="w-full sm:w-auto sm:min-w-[260px]">
                    <p className="text-sm font-medium text-gray-500">Caixa atual</p>
                    {balanceError ? (
                        <p className="mt-3 text-sm text-red-600">{balanceError}</p>
                    ) : balance === null ? (
                        <div className="mt-3"><Loader /></div>
                    ) : (
                        <p className="mt-3 text-2xl font-semibold tracking-tight tabular-nums text-gray-900">{formatMoney(balance)}</p>
                    )}
                    <p className="mt-2 text-xs text-gray-500">Dinheiro recebido menos retiradas registradas</p>
                </Card>
                <Button type="button" disabled={balance === null || balance <= 0}
                    onClick={() => { setAmount(""); setSubmitError(""); setWithdrawOpen(true); }}>
                    Retirar dinheiro do caixa
                </Button>
            </div>
            <div>
                <h3 className="mb-3 text-base font-semibold text-gray-900">Movimentações em dinheiro</h3>
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
            <Modal open={withdrawOpen} onClose={() => { if (!saving) setWithdrawOpen(false); }}
                height={320} className="max-w-md">
                <form className="space-y-5 p-5 sm:p-6" onSubmit={event => void withdraw(event)}>
                    <div>
                        <h3 className="text-lg font-semibold text-gray-900">Retirar dinheiro</h3>
                        <p className="mt-1 text-sm text-gray-500">Disponível: {formatMoney(balance ?? 0)}</p>
                    </div>
                    <Input label="Valor (R$)" inputMode="numeric" value={amount} onChange={event => setAmount(formatAmountInput(event.target.value))}
                        placeholder="0,00" autoFocus disabled={saving} />
                    {submitError && <p className="text-sm text-red-600" role="alert">{submitError}</p>}
                    <div className="flex justify-end gap-2">
                        <Button type="button" variant="secondary" disabled={saving} onClick={() => setWithdrawOpen(false)}>Cancelar</Button>
                        <Button type="submit" loading={saving}>Confirmar retirada</Button>
                    </div>
                </form>
            </Modal>
            {toast && <Toast message="Retirada registrada." type="success" onClose={() => setToast(false)} />}
        </div>
    );
}
