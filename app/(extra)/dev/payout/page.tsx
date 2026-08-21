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

type AccessState = "checking" | "allowed" | "forbidden" | "signed-out";
type PixKeyType = "CPF" | "CNPJ" | "EMAIL" | "PHONE" | "EVP";

type Payable = {
    restaurantId: string;
    restaurantName: string;
    grossCents: number;
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
    status: string;
    created_at: string;
    paid_at: string | null;
};

type DashboardPayload = {
    asaasConfigured: boolean;
    asaasBalanceCents: number | null;
    asaasError: string | null;
    generatedAt: string;
    payables: Payable[];
    history: HistoryItem[];
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

const dateTime = (value: string) =>
    new Date(value).toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

function getNetCents(grossCents: number, discountPercent: number) {
    return Math.max(
        0,
        grossCents - Math.round(grossCents * (discountPercent / 100))
    );
}

export default function DevPayoutPage() {
    const router = useRouter();
    const [accessState, setAccessState] = useState<AccessState>("checking");
    const [data, setData] = useState<DashboardPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [savingPixTypeId, setSavingPixTypeId] = useState<string | null>(null);
    const [error, setError] = useState("");
    const [discountPercent, setDiscountPercent] = useState("0.75");
    const [confirmOpen, setConfirmOpen] = useState(false);
    const [lastResult, setLastResult] = useState<SendResult | null>(null);

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

    const grossOwedCents = payables.reduce(
        (sum, item) => sum + item.grossCents,
        0
    );
    const netOwedCents = payables.reduce(
        (sum, item) => sum + getNetCents(item.grossCents, numericDiscount),
        0
    );
    const owedDiscountCents = grossOwedCents - netOwedCents;

    const grossSendableCents = sendable.reduce(
        (sum, item) => sum + item.grossCents,
        0
    );
    const netSendableCents = sendable.reduce(
        (sum, item) => sum + getNetCents(item.grossCents, numericDiscount),
        0
    );

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
                body: JSON.stringify({ discountPercent: numericDiscount }),
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
                        Envio manual via Asaas para as chaves PIX cadastradas dos restaurantes.
                    </p>
                </div>
                <Button variant="secondary" onClick={() => void loadDashboard()} disabled={loading || sending}>
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
                    detail={`${money(grossOwedCents)} bruto − ${money(owedDiscountCents)} (${numericDiscount.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%)`}
                />
                <MetricCard
                    label="Restaurantes com valor a receber"
                    value={String(payables.length)}
                    detail={`${sendable.length} prontos · ${missingPix.length} sem PIX · ${ambiguousPix.length} com tipo pendente`}
                />
            </div>

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
                                onChange={(event) => setDiscountPercent(event.target.value)}
                                className="h-10 w-32 rounded-lg border border-gray-200 bg-white px-3 text-sm font-semibold outline-none transition focus:border-brand"
                            />
                        </label>
                        <Button
                            onClick={() => setConfirmOpen(true)}
                            disabled={
                                sending ||
                                !data?.asaasConfigured ||
                                sendable.length === 0 ||
                                ambiguousPix.length > 0 ||
                                numericDiscount < 0 ||
                                numericDiscount > 100
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
            </Card>

            <Card>
                <h2 className="text-lg font-bold text-gray-900">Valores por restaurante</h2>
                <p className="mt-1 text-sm text-gray-500">
                    Apenas pedidos PIX Online confirmados desde o último repasse registrado são considerados.
                </p>

                <div className="mt-5 overflow-x-auto">
                    <table className="w-full min-w-[760px] text-left text-sm">
                        <thead className="border-b border-gray-100 text-xs uppercase text-gray-400">
                            <tr>
                                <th className="px-3 py-3">Restaurante</th>
                                <th className="px-3 py-3">PIX</th>
                                <th className="px-3 py-3 text-right">Bruto</th>
                                <th className="px-3 py-3 text-right">Desconto</th>
                                <th className="px-3 py-3 text-right">Enviar</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {payables.map((item) => {
                                const net = getNetCents(item.grossCents, numericDiscount);
                                return (
                                    <tr key={item.restaurantId}>
                                        <td className="px-3 py-4 font-semibold text-gray-900">{item.restaurantName}</td>
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
                                        <td className="px-3 py-4 text-right text-gray-500">{money(item.grossCents - net)}</td>
                                        <td className="px-3 py-4 text-right font-bold">{item.canSend ? money(net) : "—"}</td>
                                    </tr>
                                );
                            })}
                            {payables.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-3 py-10 text-center text-gray-400">
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
                <div className="mt-5 space-y-3">
                    {(data?.history || []).map((item) => (
                        <div
                            key={item.id}
                            className="flex flex-col gap-2 rounded-lg border border-gray-100 p-4 sm:flex-row sm:items-center sm:justify-between"
                        >
                            <div>
                                <div className="font-semibold text-gray-900">{item.restaurant_name}</div>
                                <div className="text-xs text-gray-500">{dateTime(item.created_at)}</div>
                            </div>
                            <div className="flex items-center gap-3">
                                {item.status === "processing" && (
                                    <span className="rounded-full bg-amber-50 px-2 py-1 text-xs font-semibold text-amber-700">Processando</span>
                                )}
                                <span className="text-lg font-bold text-gray-900">{money(item.amount_cents)}</span>
                            </div>
                        </div>
                    ))}
                    {data?.history.length === 0 && (
                        <div className="py-8 text-center text-gray-400">Nenhum repasse registrado.</div>
                    )}
                </div>
            </Card>

            <Modal open={confirmOpen} onClose={() => !sending && setConfirmOpen(false)}>
                <div className="p-6 sm:p-7">
                    <h2 className="text-xl font-bold text-gray-900">Confirmar envio</h2>
                    <p className="mt-2 text-sm text-gray-500">
                        Serão enviados {money(netSendableCents)} para {sendable.length} restaurante(s), com desconto de {numericDiscount.toLocaleString("pt-BR", { maximumFractionDigits: 4 })}%.
                    </p>

                    <div className="mt-5 max-h-64 space-y-2 overflow-y-auto rounded-lg border border-gray-100 p-3">
                        {sendable.map((item) => (
                            <div key={item.restaurantId} className="flex items-center justify-between gap-4 text-sm">
                                <span className="truncate text-gray-600">{item.restaurantName}</span>
                                <span className="shrink-0 font-semibold">{money(getNetCents(item.grossCents, numericDiscount))}</span>
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
