"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import Dropdown from "@/components/ui/Dropdown";
import Loader from "@/components/ui/Loader";
import Modal from "@/components/ui/Modal";
import { supabase } from "@/lib/database/supabaseClient";

const ALLOWED_DEV_EMAIL = "joaovralmeida@hotmail.com";
const HISTORY_PAGE_SIZE = 10;

type AccessState = "checking" | "allowed" | "forbidden" | "signed-out";
type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

type Payable = {
    restaurantId: string;
    restaurantName: string;
    grossCents: number;
    payzuFeeCents: number;
    pixKey: string | null;
    pixKeyType: PixKeyType | null;
    pixKeyTypeStored: PixKeyType | null;
    canSend: boolean;
};

type HistoryItem = {
    id: string;
    restaurant_id: string;
    restaurant_name: string;
    amount_cents: number;
    gross_cents: number | null;
    payzu_fee_cents: number | null;
    discount_cents: number | null;
    status: string;
    created_at: string;
    paid_at: string | null;
};

type AutomationRun = {
    id: string;
    run_date: string;
    status: string;
    started_at: string;
    finished_at: string | null;
    payzu_step_status: string;
    adjustment_step_status: string;
    comparison_step_status: string;
    payout_step_status: string;
    payzu_balance_before_cents: number | null;
    payzu_reserve_cents: number | null;
    transferred_cents: number | null;
    asaas_balance_before_payout_cents: number | null;
    gross_cents: number | null;
    payzu_fee_cents: number | null;
    discount_cents: number | null;
    payout_cents: number | null;
    difference_cents: number | null;
    restaurant_count: number;
    paid_count: number;
    processing_count: number;
    failed_count: number;
    payzu_transaction_status: string | null;
    error_message: string | null;
};

type DashboardPayload = {
    asaasConfigured: boolean;
    asaasBalanceCents: number | null;
    asaasError: string | null;
    generatedAt: string;
    payables: Payable[];
    history: HistoryItem[];
    automationRuns: AutomationRun[];
    error?: string;
};

type SendResult = {
    paidCount: number;
    processingCount: number;
    failedCount: number;
    results: Array<{
        restaurantId: string;
        restaurantName: string;
        amountCents: number;
        status: "paid" | "processing" | "failed";
        message?: string;
    }>;
};

type PayzuTransferResult = {
    success: boolean;
    skipped: boolean;
    reason?: string;
    amountCents?: number;
    reserveCents: number;
    balanceBeforeCents: number;
    transactionStatus?: string | null;
    error?: string;
};

const PIX_KEY_TYPE_OPTIONS = [
    { value: "", label: "Selecionar tipo" },
    { value: "CPF", label: "CPF" },
    { value: "CNPJ", label: "CNPJ" },
    { value: "EMAIL", label: "E-mail" },
    { value: "PHONE", label: "Telefone" },
    { value: "EVP", label: "Chave aleatória" },
];

const money = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

const amountInput = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });

const parseAmountInput = (value: string) => {
    const normalized = value.trim().replace(/\./g, "").replace(",", ".");
    if (!normalized) return null;
    const number = Number(normalized);
    if (!Number.isFinite(number)) return null;
    return Math.round(number * 100);
};

const whatsappMoney = (cents: number) =>
    `R$ ${(cents / 100).toLocaleString("pt-BR", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

const dateTime = (value: string) =>
    new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

const runDate = (value: string) => value.split("-").reverse().join("/");

const STEP_LABELS: Record<string, string> = {
    pending: "Pendente",
    running: "Executando",
    processing: "Processando",
    completed: "Concluído",
    skipped: "Não executado",
    blocked: "Bloqueado",
    partial: "Parcial",
    failed: "Falhou",
};

function StatusBadge({ status }: { status: string }) {
    const className =
        status === "completed"
            ? "bg-green-50 text-green-700"
            : status === "running" || status === "processing"
              ? "bg-blue-50 text-blue-700"
              : status === "blocked" || status === "failed" || status === "partial"
                ? "bg-red-50 text-red-700"
                : "bg-gray-100 text-gray-600";

    return (
        <span className={`inline-flex rounded-full px-2 py-1 text-xs font-semibold ${className}`}>
            {STEP_LABELS[status] || status}
        </span>
    );
}

function formatPhone(value: string | undefined) {
    let digits = String(value || "").replace(/\D/g, "");
    if (digits.startsWith("55") && digits.length >= 12) digits = digits.slice(2);
    if (digits.length === 11) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    }
    return value || "";
}

function normalizeWhatsappNumber(value: string | undefined) {
    const digits = String(value || "").replace(/\D/g, "");
    if (!digits) return "";
    if (digits.startsWith("55") && digits.length >= 12) return digits;
    if (digits.length === 10 || digits.length === 11) return `55${digits}`;
    return digits;
}

function getDiscountCents(
    item: Payable,
    discountPercent: number,
    onePercentNet: boolean
) {
    const totalDiscountCents = onePercentNet
        ? Math.round(item.grossCents * 0.01)
        : Math.round(item.grossCents * (discountPercent / 100));
    return totalDiscountCents - item.payzuFeeCents;
}

function getNetCents(
    item: Payable,
    discountPercent: number,
    onePercentNet: boolean
) {
    const discountCents = getDiscountCents(
        item,
        discountPercent,
        onePercentNet
    );
    return Math.max(
        0,
        item.grossCents - item.payzuFeeCents - discountCents
    );
}

export default function DevPayoutPage() {
    const router = useRouter();
    const [accessState, setAccessState] = useState<AccessState>("checking");
    const [data, setData] = useState<DashboardPayload | null>(null);
    const [restaurantPhones, setRestaurantPhones] = useState<Record<string, string>>({});
    const [restaurantPixInfo, setRestaurantPixInfo] = useState<
        Record<string, { pixKey: string; pixKeyType: string }>
    >({});
    const [manualAmounts, setManualAmounts] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [transferringPayzu, setTransferringPayzu] = useState(false);
    const [savingPixTypeId, setSavingPixTypeId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [discountPercent, setDiscountPercent] = useState("0.75");
    const [onePercentNet, setOnePercentNet] = useState(false);
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [historyPage, setHistoryPage] = useState(1);
    const [lastResult, setLastResult] = useState<SendResult | null>(null);
    const [lastPayzuTransfer, setLastPayzuTransfer] =
        useState<PayzuTransferResult | null>(null);

    const numericDiscount = useMemo(() => {
        const value = Number(discountPercent.replace(",", "."));
        return Number.isFinite(value) ? value : 0;
    }, [discountPercent]);

    const loadDashboard = async () => {
        setLoading(true);
        setError("");

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (!session?.access_token) {
                setAccessState("signed-out");
                setData(null);
                return;
            }

            const response = await fetch("/api/dev/payout", {
                headers: { Authorization: `Bearer ${session.access_token}` },
                cache: "no-store",
            });
            const payload = (await response.json()) as DashboardPayload;

            if (response.status === 401) {
                setAccessState("signed-out");
                setData(null);
                return;
            }
            if (response.status === 403) {
                setAccessState("forbidden");
                setData(null);
                return;
            }
            if (!response.ok) {
                throw new Error(payload.error || "Erro ao carregar repasses.");
            }

            const restaurantIds = Array.from(
                new Set([
                    ...payload.payables.map((item) => item.restaurantId),
                    ...payload.history.map((item) => item.restaurant_id),
                ])
            );
            const restaurantEntries = await Promise.all(
                restaurantIds.map(async (restaurantId) => {
                    try {
                        const restaurantResponse = await fetch(
                            `/api/restaurants/${restaurantId}`,
                            { cache: "no-store" }
                        );
                        if (!restaurantResponse.ok) {
                            return [
                                restaurantId,
                                { phone: "", pixKey: "", pixKeyType: "" },
                            ] as const;
                        }
                        const restaurant = await restaurantResponse.json();
                        return [
                            restaurantId,
                            {
                                phone: String(restaurant?.phone || ""),
                                pixKey: String(restaurant?.payment_info || ""),
                                pixKeyType: String(restaurant?.payment_info_type || ""),
                            },
                        ] as const;
                    } catch {
                        return [
                            restaurantId,
                            { phone: "", pixKey: "", pixKeyType: "" },
                        ] as const;
                    }
                })
            );

            setRestaurantPhones(
                Object.fromEntries(
                    restaurantEntries.map(([restaurantId, details]) => [
                        restaurantId,
                        details.phone,
                    ])
                )
            );
            setRestaurantPixInfo(
                Object.fromEntries(
                    restaurantEntries.map(([restaurantId, details]) => [
                        restaurantId,
                        {
                            pixKey: details.pixKey,
                            pixKeyType: details.pixKeyType,
                        },
                    ])
                )
            );
            setManualAmounts({});
            setHistoryPage(1);
            setAccessState("allowed");
            setData(payload);
        } catch (caught) {
            setAccessState("allowed");
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Erro ao carregar repasses."
            );
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        void loadDashboard();
    }, []);

    const payables = data?.payables || [];
    const history = data?.history || [];
    const automationRuns = data?.automationRuns || [];
    const historyPageCount = Math.max(1, Math.ceil(history.length / HISTORY_PAGE_SIZE));
    const currentHistoryPage = Math.min(historyPage, historyPageCount);
    const paginatedHistory = history.slice(
        (currentHistoryPage - 1) * HISTORY_PAGE_SIZE,
        currentHistoryPage * HISTORY_PAGE_SIZE
    );
    const sendable = useMemo(
        () => data?.payables.filter((item) => item.canSend) || [],
        [data]
    );
    const missingPix = useMemo(
        () => data?.payables.filter((item) => !item.pixKey) || [],
        [data]
    );
    const ambiguousPix = useMemo(
        () => data?.payables.filter((item) => item.pixKey && !item.pixKeyType) || [],
        [data]
    );

    const getSendCents = (item: Payable) => {
        const manual = manualAmounts[item.restaurantId];
        if (manual === undefined) {
            return getNetCents(item, numericDiscount, onePercentNet);
        }
        return parseAmountInput(manual) ?? 0;
    };

    const invalidManualAmounts = sendable.some((item) => {
        const manual = manualAmounts[item.restaurantId];
        if (manual === undefined) return false;
        const cents = parseAmountInput(manual);
        return cents === null || cents <= 0 || cents > item.grossCents;
    });

    const grossOwedCents = payables.reduce(
        (sum, item) => sum + item.grossCents,
        0
    );
    const payzuOwedCents = payables.reduce(
        (sum, item) => sum + item.payzuFeeCents,
        0
    );
    const owedDiscountCents = payables.reduce(
        (sum, item) =>
            sum + getDiscountCents(item, numericDiscount, onePercentNet),
        0
    );
    const netOwedCents = payables.reduce(
        (sum, item) => sum + getNetCents(item, numericDiscount, onePercentNet),
        0
    );

    const netSendableCents = sendable.reduce(
        (sum, item) => sum + getSendCents(item),
        0
    );

    const handleAdjustToOnePercent = () => {
        setManualAmounts({});
        setOnePercentNet(true);
    };

    const handlePixTypeChange = async (
        restaurantId: string,
        pixKeyType: PixKeyType
    ) => {
        setSavingPixTypeId(restaurantId);
        setError("");

        try {
            const response = await fetch(`/api/restaurants/${restaurantId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payment_info_type: pixKeyType }),
            });
            const payload = await response.json();

            if (!response.ok) {
                throw new Error(payload?.error || "Erro ao salvar tipo da chave PIX.");
            }

            setData((current) =>
                current
                    ? {
                          ...current,
                          payables: current.payables.map((item) =>
                              item.restaurantId === restaurantId
                                  ? {
                                        ...item,
                                        pixKeyType,
                                        pixKeyTypeStored: pixKeyType,
                                        canSend: Boolean(item.pixKey),
                                    }
                                  : item
                          ),
                      }
                    : current
            );
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Erro ao salvar tipo da chave PIX."
            );
        } finally {
            setSavingPixTypeId(null);
        }
    };

    const handlePayzuTransfer = async () => {
        setTransferringPayzu(true);
        setError("");
        setLastPayzuTransfer(null);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setAccessState("signed-out");
                return;
            }

            const response = await fetch("/api/cron/payzu-to-asaas", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                },
            });
            const payload = (await response.json()) as PayzuTransferResult;
            if (!response.ok) {
                throw new Error(payload.error || "Falha ao transferir saldo PayZu.");
            }

            setLastPayzuTransfer(payload);
            await loadDashboard();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Falha ao transferir saldo PayZu."
            );
        } finally {
            setTransferringPayzu(false);
        }
    };

    const handleSend = async () => {
        setSending(true);
        setError("");
        setLastResult(null);

        try {
            const {
                data: { session },
            } = await supabase.auth.getSession();
            if (!session?.access_token) {
                setAccessState("signed-out");
                return;
            }

            const response = await fetch("/api/dev/payout", {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${session.access_token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({
                    discountPercent: numericDiscount,
                    adjustToOnePercent: onePercentNet,
                    amounts: Object.fromEntries(
                        sendable.map((item) => [
                            item.restaurantId,
                            getSendCents(item),
                        ])
                    ),
                }),
            });
            const payload = await response.json();
            if (!response.ok) {
                const blocked = Array.isArray(payload.blocked)
                    ? ` (${payload.blocked.map((item: any) => item.restaurantName).join(", ")})`
                    : "";
                throw new Error((payload.error || "Falha ao enviar repasses.") + blocked);
            }

            setLastResult(payload as SendResult);
            setConfirmOpen(false);
            await loadDashboard();
        } catch (caught) {
            setError(
                caught instanceof Error
                    ? caught.message
                    : "Falha ao enviar repasses."
            );
        } finally {
            setSending(false);
        }
    };

    if (accessState === "checking" || (loading && !data)) {
        return (
            <div className="flex min-h-[60vh] items-center justify-center">
                <Loader />
            </div>
        );
    }

    if (accessState === "signed-out") {
        return (
            <CenteredMessage
                title="Faça login primeiro"
                description={`Entre com ${ALLOWED_DEV_EMAIL} para acessar esta página.`}
                actionLabel="Ir para o login"
                onAction={() => router.push("/restaurante/login")}
            />
        );
    }

    if (accessState === "forbidden") {
        return (
            <CenteredMessage
                title="Acesso negado"
                description={`Esta página é restrita a ${ALLOWED_DEV_EMAIL}.`}
            />
        );
    }

    return (
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">Repasses</h1>
                    <p className="mt-1 text-sm text-gray-500">
                        Automação diária e envio manual via Asaas para as chaves PIX cadastradas dos restaurantes.
                    </p>
                </div>
                <Button
                    variant="secondary"
                    onClick={() => void loadDashboard()}
                    disabled={loading || sending || transferringPayzu}
                >
                    {loading ? "Atualizando..." : "Atualizar"}
                </Button>
            </div>

            {error && (
                <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {error}
                </div>
            )}

            {lastResult && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                    <b>Último envio:</b> {lastResult.paidCount} concluído(s), {lastResult.processingCount} processando, {lastResult.failedCount} falhou(aram).
                </div>
            )}

            {lastPayzuTransfer && (
                <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900">
                    {lastPayzuTransfer.skipped
                        ? `Saldo PayZu: ${money(lastPayzuTransfer.balanceBeforeCents)}. Nada para transferir além da reserva de ${money(lastPayzuTransfer.reserveCents)}.`
                        : `Transferidos ${money(lastPayzuTransfer.amountCents || 0)} da PayZu para o Asaas. Reserva mantida: ${money(lastPayzuTransfer.reserveCents)}.`}
                </div>
            )}

            <Card>
                <h2 className="text-lg font-bold text-gray-900">Histórico da automação diária</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Executa todos os dias às 12h. Só envia quando Transferido − Enviar fica entre −R$ 3,00 e +R$ 10,00.
                </p>

                <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[1450px] text-left text-sm">
                        <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-3 py-3">Data</th>
                                <th className="px-3 py-3">Transferir saldo</th>
                                <th className="px-3 py-3">Ajustar p/ 1% líquido</th>
                                <th className="px-3 py-3">Comparação</th>
                                <th className="px-3 py-3">Enviar p/ todos</th>
                                <th className="px-3 py-3 text-right">Bruto</th>
                                <th className="px-3 py-3 text-right">PayZu</th>
                                <th className="px-3 py-3 text-right">Desconto</th>
                                <th className="px-3 py-3 text-right">Lucro líquido</th>
                                <th className="px-3 py-3">Erro</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {automationRuns.map((run) => {
                                const comparisonSafe =
                                    run.difference_cents != null &&
                                    run.difference_cents >= -300 &&
                                    run.difference_cents <= 1000;
                                const finalProfitCents =
                                    run.status === "completed"
                                        ? run.difference_cents
                                        : null;

                                return (
                                    <tr key={run.id}>
                                        <td className="whitespace-nowrap px-3 py-4 align-top">
                                            <div className="font-semibold text-gray-900">{runDate(run.run_date)}</div>
                                            <div className="mt-2"><StatusBadge status={run.status} /></div>
                                        </td>
                                        <td className="px-3 py-4 align-top">
                                            <StatusBadge status={run.payzu_step_status} />
                                            <div className="mt-2 font-semibold text-gray-900">
                                                {run.transferred_cents == null ? "—" : money(run.transferred_cents)}
                                            </div>
                                            {run.payzu_balance_before_cents != null && (
                                                <div className="mt-1 text-xs text-gray-500">
                                                    Saldo {money(run.payzu_balance_before_cents)} · Reserva {money(run.payzu_reserve_cents || 0)}
                                                </div>
                                            )}
                                            {run.payzu_transaction_status && (
                                                <div className="mt-1 text-xs text-gray-500">PayZu: {run.payzu_transaction_status}</div>
                                            )}
                                        </td>
                                        <td className="px-3 py-4 align-top">
                                            <StatusBadge status={run.adjustment_step_status} />
                                            <div className="mt-2 font-semibold text-gray-900">
                                                {run.payout_cents == null ? "—" : money(run.payout_cents)} para enviar
                                            </div>
                                        </td>
                                        <td className="px-3 py-4 align-top">
                                            <StatusBadge status={run.comparison_step_status} />
                                            <div className={`mt-2 font-semibold ${comparisonSafe ? "text-green-700" : "text-gray-900"}`}>
                                                {run.difference_cents == null
                                                    ? "—"
                                                    : `${money(run.difference_cents)} · ${comparisonSafe ? "Dentro da faixa" : "Fora da faixa"}`}
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">Transferido − Enviar</div>
                                        </td>
                                        <td className="px-3 py-4 align-top">
                                            <StatusBadge status={run.payout_step_status} />
                                            <div className="mt-2 font-semibold text-gray-900">
                                                {run.payout_cents == null ? "—" : money(run.payout_cents)} · {run.restaurant_count} restaurante(s)
                                            </div>
                                            <div className="mt-1 text-xs text-gray-500">
                                                {run.paid_count} pagos · {run.processing_count} processando · {run.failed_count} falhas
                                            </div>
                                            {run.asaas_balance_before_payout_cents != null && (
                                                <div className="mt-1 text-xs text-gray-500">
                                                    Saldo Asaas: {money(run.asaas_balance_before_payout_cents)}
                                                </div>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right align-top">
                                            {run.gross_cents == null ? "—" : money(run.gross_cents)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right align-top text-gray-500">
                                            {run.payzu_fee_cents == null ? "—" : money(run.payzu_fee_cents)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right align-top text-gray-500">
                                            {run.discount_cents == null ? "—" : money(run.discount_cents)}
                                        </td>
                                        <td className={`whitespace-nowrap px-3 py-4 text-right align-top font-bold ${
                                            (finalProfitCents || 0) >= 0 ? "text-green-700" : "text-red-700"
                                        }`}>
                                            {finalProfitCents == null ? "—" : money(finalProfitCents)}
                                        </td>
                                        <td className="max-w-72 px-3 py-4 align-top text-xs text-red-700">
                                            {run.error_message || "—"}
                                        </td>
                                    </tr>
                                );
                            })}
                            {automationRuns.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-3 py-10 text-center text-gray-400">
                                        Nenhuma execução automática registrada.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="grid gap-4 md:grid-cols-3">
                <MetricCard
                    label="Saldo no Asaas"
                    value={
                        data?.asaasBalanceCents == null
                            ? data?.asaasConfigured
                                ? "Indisponível"
                                : "Não configurado"
                            : money(data.asaasBalanceCents)
                    }
                    detail={data?.asaasError || undefined}
                />
                <MetricCard
                    label="Total que devo aos restaurantes"
                    value={money(netOwedCents)}
                    detail={`${money(grossOwedCents)} bruto · PayZu ${money(payzuOwedCents)} · Desconto ${money(owedDiscountCents)} · ${onePercentNet ? "1%" : `${numericDiscount.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%`} total`}
                />
                <MetricCard
                    label="Restaurantes com valor a receber"
                    value={String(payables.length)}
                    detail={`${sendable.length} prontos · ${missingPix.length} sem PIX · ${ambiguousPix.length} com tipo pendente`}
                />
            </div>

            <Card>
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900">PayZu → Asaas</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Transfere todo o saldo disponível da PayZu para o Asaas, deixando R$ 1,00 de reserva.
                        </p>
                    </div>
                    <Button
                        onClick={() => void handlePayzuTransfer()}
                        loading={transferringPayzu}
                        disabled={transferringPayzu || sending}
                        className="min-w-52"
                    >
                        Transferir saldo
                    </Button>
                </div>
            </Card>

            <Card>
                <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div className="max-w-2xl">
                        <h2 className="text-lg font-bold text-gray-900">Enviar repasses</h2>
                        <p className="mt-1 text-sm text-gray-500">
                            O botão só envia quando você confirmar. Um repasse só entra no histórico do restaurante após ser confirmado pelo Asaas.
                        </p>
                    </div>
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                        <label className="block">
                            <span className="mb-1 block text-xs font-semibold text-gray-600">Desconto (%)</span>
                            <input
                                type="text"
                                inputMode="decimal"
                                value={discountPercent}
                                onChange={(event) => {
                                    setManualAmounts({});
                                    setOnePercentNet(false);
                                    setDiscountPercent(event.target.value);
                                }}
                                className="h-10 w-32 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-brand"
                            />
                        </label>
                        <Button
                            variant="secondary"
                            onClick={handleAdjustToOnePercent}
                            disabled={sendable.length === 0}
                        >
                            {onePercentNet
                                ? "1% líquido aplicado"
                                : "Ajustar p/ 1% líquido"}
                        </Button>
                        <Button
                            onClick={() => setConfirmOpen(true)}
                            disabled={
                                sending ||
                                transferringPayzu ||
                                !data?.asaasConfigured ||
                                sendable.length === 0 ||
                                ambiguousPix.length > 0 ||
                                invalidManualAmounts ||
                                (!onePercentNet &&
                                    (numericDiscount < 0 || numericDiscount > 100))
                            }
                            className="min-w-52 bg-green-600 text-white hover:opacity-90 disabled:opacity-40"
                        >
                            Enviar para todos — {money(netSendableCents)}
                        </Button>
                    </div>
                </div>

                {!data?.asaasConfigured && (
                    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Configure <b>ASAAS_API_KEY</b> no ambiente antes de enviar.
                    </div>
                )}

                {ambiguousPix.length > 0 && (
                    <div className="mt-5 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
                        Defina abaixo o tipo da chave PIX para: {ambiguousPix.map((item) => item.restaurantName).join(", ")}.
                    </div>
                )}

                {invalidManualAmounts && (
                    <div className="mt-5 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        O valor manual deve ser maior que R$ 0,00 e não pode ultrapassar o bruto do restaurante.
                    </div>
                )}
            </Card>

            <Card>
                <h2 className="text-lg font-bold text-gray-900">Valores por restaurante</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Apenas pedidos PIX Online confirmados desde o último repasse registrado são considerados. O valor em Enviar pode ser ajustado manualmente antes da confirmação.
                </p>

                <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[1000px] text-left text-sm">
                        <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-3 py-3">Restaurante</th>
                                <th className="px-3 py-3">Telefone</th>
                                <th className="px-3 py-3">PIX</th>
                                <th className="px-3 py-3 text-right">Bruto</th>
                                <th className="px-3 py-3 text-right">PayZu</th>
                                <th className="px-3 py-3 text-right">Desconto</th>
                                <th className="px-3 py-3 text-right">Enviar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {payables.map((item) => {
                                const discountCents = getDiscountCents(
                                    item,
                                    numericDiscount,
                                    onePercentNet
                                );
                                const calculatedNet = getNetCents(
                                    item,
                                    numericDiscount,
                                    onePercentNet
                                );
                                return (
                                    <tr key={item.restaurantId}>
                                        <td className="px-3 py-4 font-semibold text-gray-900">{item.restaurantName}</td>
                                        <td className="px-3 py-4 text-gray-500">
                                            {formatPhone(restaurantPhones[item.restaurantId]) || "—"}
                                        </td>
                                        <td className="px-3 py-4 text-gray-500">
                                            {item.pixKey ? (
                                                item.pixKeyType ? (
                                                    <span>
                                                        {item.pixKeyType} · {item.pixKey}
                                                    </span>
                                                ) : (
                                                    <div className="flex min-w-48 flex-col gap-2">
                                                        <span className="break-all text-amber-700">
                                                            Tipo pendente · {item.pixKey}
                                                        </span>
                                                        <Dropdown
                                                            aria-label={`Tipo da chave PIX de ${item.restaurantName}`}
                                                            options={PIX_KEY_TYPE_OPTIONS}
                                                            value=""
                                                            disabled={savingPixTypeId === item.restaurantId}
                                                            onChange={(event) => {
                                                                const value = event.target.value as PixKeyType;
                                                                if (value) {
                                                                    void handlePixTypeChange(item.restaurantId, value);
                                                                }
                                                            }}
                                                            className="py-2 text-sm"
                                                        />
                                                    </div>
                                                )
                                            ) : (
                                                <span className="text-amber-700">Não cadastrado</span>
                                            )}
                                        </td>
                                        <td className="px-3 py-4 text-right">{money(item.grossCents)}</td>
                                        <td className="px-3 py-4 text-right text-gray-500">{money(item.payzuFeeCents)}</td>
                                        <td className="px-3 py-4 text-right text-gray-500">
                                            {money(discountCents)}
                                        </td>
                                        <td className="px-3 py-4 text-right font-bold">
                                            {item.canSend ? (
                                                <div className="ml-auto flex w-32 items-center rounded-lg border border-gray-200 bg-white px-2 focus-within:border-brand">
                                                    <span className="mr-1 text-xs font-medium text-gray-400">R$</span>
                                                    <input
                                                        type="text"
                                                        inputMode="decimal"
                                                        value={
                                                            manualAmounts[item.restaurantId] ??
                                                            amountInput(calculatedNet)
                                                        }
                                                        onChange={(event) =>
                                                            setManualAmounts((current) => ({
                                                                ...current,
                                                                [item.restaurantId]: event.target.value,
                                                            }))
                                                        }
                                                        className="h-9 w-full bg-transparent text-right font-bold outline-none"
                                                        aria-label={`Valor a enviar para ${item.restaurantName}`}
                                                    />
                                                </div>
                                            ) : (
                                                "—"
                                            )}
                                        </td>
                                    </tr>
                                );
                            })}
                            {payables.length === 0 && (
                                <tr>
                                    <td colSpan={7} className="px-3 py-10 text-center text-gray-400">
                                        Nada a repassar agora.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <Card>
                <h2 className="text-lg font-bold text-gray-900">Histórico de envios</h2>
                <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[1250px] table-fixed text-left text-sm">
                        <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="w-48 px-3 py-3">Restaurante</th>
                                <th className="w-40 px-3 py-3">Data</th>
                                <th className="w-36 px-3 py-3">Telefone</th>
                                <th className="w-56 px-3 py-3">PIX</th>
                                <th className="w-28 px-3 py-3 text-right">Bruto</th>
                                <th className="w-28 px-3 py-3 text-right">PayZu</th>
                                <th className="w-28 px-3 py-3 text-right">Desconto</th>
                                <th className="w-28 px-3 py-3 text-right">Enviado</th>
                                <th className="w-28 px-3 py-3">Status</th>
                                <th className="w-28 px-3 py-3 text-right">Ação</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {paginatedHistory.map((item) => {
                                const phone = restaurantPhones[item.restaurant_id];
                                const whatsappNumber = normalizeWhatsappNumber(phone);
                                const pixInfo = restaurantPixInfo[item.restaurant_id];
                                const pixLabel = pixInfo?.pixKey
                                    ? `${pixInfo.pixKeyType ? `${pixInfo.pixKeyType} · ` : ""}${pixInfo.pixKey}`
                                    : "—";
                                const effectiveDiscountCents =
                                    item.gross_cents == null
                                        ? item.discount_cents
                                        : item.gross_cents -
                                          item.amount_cents -
                                          (item.payzu_fee_cents ?? 0);

                                return (
                                    <tr key={item.id}>
                                        <td
                                            className="truncate whitespace-nowrap px-3 py-4 font-semibold text-gray-900"
                                            title={item.restaurant_name}
                                        >
                                            {item.restaurant_name}
                                        </td>
                                        <td className="truncate whitespace-nowrap px-3 py-4 text-gray-500">
                                            {dateTime(item.created_at)}
                                        </td>
                                        <td
                                            className="truncate whitespace-nowrap px-3 py-4 text-gray-500"
                                            title={formatPhone(phone) || "—"}
                                        >
                                            {formatPhone(phone) || "—"}
                                        </td>
                                        <td
                                            className="truncate whitespace-nowrap px-3 py-4 text-gray-500"
                                            title={pixLabel}
                                        >
                                            {pixLabel}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right">
                                            {item.gross_cents == null ? "—" : money(item.gross_cents)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right text-gray-500">
                                            {item.payzu_fee_cents == null ? "—" : money(item.payzu_fee_cents)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right text-gray-500">
                                            {effectiveDiscountCents == null
                                                ? "—"
                                                : money(effectiveDiscountCents)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right font-bold text-gray-900">
                                            {money(item.amount_cents)}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4">
                                            {item.status === "processing" ? (
                                                <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">
                                                    Processando
                                                </span>
                                            ) : item.status === "paid" ? (
                                                <span className="rounded-full bg-green-50 px-2 py-1 text-xs font-semibold text-green-700">
                                                    Pago
                                                </span>
                                            ) : (
                                                <span className="text-xs font-semibold text-gray-500">
                                                    {item.status}
                                                </span>
                                            )}
                                        </td>
                                        <td className="whitespace-nowrap px-3 py-4 text-right">
                                            <Button
                                                variant="secondary"
                                                disabled={!whatsappNumber}
                                                onClick={() => {
                                                    if (!whatsappNumber) return;
                                                    const message = `Repasse iMenu - ${item.restaurant_name}: ${whatsappMoney(item.amount_cents)}`;
                                                    window.open(
                                                        `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(message)}`,
                                                        "_blank",
                                                        "noopener,noreferrer"
                                                    );
                                                }}
                                                className="px-3 py-1.5 text-xs"
                                            >
                                                WhatsApp
                                            </Button>
                                        </td>
                                    </tr>
                                );
                            })}
                            {history.length === 0 && (
                                <tr>
                                    <td colSpan={10} className="px-3 py-10 text-center text-gray-400">
                                        Nenhum repasse registrado.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>

                {historyPageCount > 1 && (
                    <div className="mt-4 flex flex-wrap items-center justify-end gap-2">
                        <button
                            type="button"
                            onClick={() => setHistoryPage((page) => Math.max(1, page - 1))}
                            disabled={currentHistoryPage === 1}
                            className="h-9 cursor-pointer rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-default disabled:opacity-40"
                        >
                            Anterior
                        </button>
                        {Array.from({ length: historyPageCount }, (_, index) => index + 1).map((page) => (
                            <button
                                key={page}
                                type="button"
                                onClick={() => setHistoryPage(page)}
                                className={`h-9 min-w-9 cursor-pointer rounded-lg border px-3 text-sm font-semibold transition ${
                                    page === currentHistoryPage
                                        ? "border-brand bg-brand text-white"
                                        : "border-gray-200 text-gray-600 hover:bg-gray-50"
                                }`}
                            >
                                {page}
                            </button>
                        ))}
                        <button
                            type="button"
                            onClick={() =>
                                setHistoryPage((page) => Math.min(historyPageCount, page + 1))
                            }
                            disabled={currentHistoryPage === historyPageCount}
                            className="h-9 cursor-pointer rounded-lg border border-gray-200 px-3 text-sm font-medium text-gray-600 transition hover:bg-gray-50 disabled:cursor-default disabled:opacity-40"
                        >
                            Próxima
                        </button>
                    </div>
                )}
            </Card>

            <Modal open={confirmOpen} onClose={() => !sending && setConfirmOpen(false)}>
                <div className="p-6 sm:p-7">
                    <h2 className="text-xl font-bold text-gray-900">Confirmar envio</h2>
                    <p className="mt-2 text-sm text-gray-500">
                        {onePercentNet
                            ? `Serão enviados ${money(netSendableCents)} para ${sendable.length} restaurante(s). PayZu + Desconto totalizam exatamente 1% do bruto de cada restaurante; valores editados manualmente são respeitados.`
                            : `Serão enviados ${money(netSendableCents)} para ${sendable.length} restaurante(s). PayZu + Desconto totalizam ${numericDiscount.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}% do bruto; valores editados manualmente são respeitados.`}
                    </p>

                    <div className="mt-5 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-100 p-3">
                        {sendable.map((item) => (
                            <div key={item.restaurantId} className="flex items-center justify-between gap-4 text-sm">
                                <span className="truncate text-gray-600">{item.restaurantName}</span>
                                <span className="shrink-0 font-semibold">
                                    {money(getSendCents(item))}
                                </span>
                            </div>
                        ))}
                    </div>

                    <div className="mt-6 flex justify-end gap-3">
                        <Button variant="secondary" disabled={sending} onClick={() => setConfirmOpen(false)}>
                            Cancelar
                        </Button>
                        <Button
                            loading={sending}
                            disabled={sending}
                            onClick={() => void handleSend()}
                            className="bg-green-600 text-white hover:opacity-90"
                        >
                            Confirmar e enviar
                        </Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
}

function MetricCard({
    label,
    value,
    detail,
}: {
    label: string;
    value: string;
    detail?: string;
}) {
    return (
        <Card>
            <div className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</div>
            <div className="mt-2 text-2xl font-bold text-gray-900">{value}</div>
            {detail && <div className="mt-1 text-xs text-gray-500">{detail}</div>}
        </Card>
    );
}

function CenteredMessage({
    title,
    description,
    actionLabel,
    onAction,
}: {
    title: string;
    description?: string;
    actionLabel?: string;
    onAction?: () => void;
}) {
    return (
        <div className="flex min-h-[70vh] items-center justify-center px-4">
            <Card className="w-full max-w-md text-center">
                <h1 className="text-xl font-bold text-gray-900">{title}</h1>
                {description && <p className="mt-2 text-sm text-gray-500">{description}</p>}
                {actionLabel && onAction && (
                    <Button className="mt-5" onClick={onAction}>
                        {actionLabel}
                    </Button>
                )}
            </Card>
        </div>
    );
}
