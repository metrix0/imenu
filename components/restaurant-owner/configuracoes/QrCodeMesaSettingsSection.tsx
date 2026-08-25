"use client";

import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCalendarDays,
    faCreditCard,
    faExternalLinkAlt,
} from "@fortawesome/free-solid-svg-icons";

import MenuProductCards from "@/components/restaurant-owner/mesas/MenuProductCards";
import QrCodeMesaSalesModal from "@/components/restaurant-owner/mesas/QrCodeMesaSalesModal";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";
import {
    qrTableAuthenticatedFetch,
    startQrTableCheckout,
} from "@/lib/qr-table/clientApi";
import type { QrTableAddon } from "@/lib/qr-table/types";

type Payment = {
    id: string;
    amount_cents: number;
    status: string;
    billing_type: string | null;
    due_date: string | null;
    paid_at: string | null;
    invoice_url: string | null;
    created_at: string;
};

type BillingPayload = {
    addon: QrTableAddon | null;
    active: boolean;
    payments: Payment[];
    error?: string;
};

const PAYMENT_STATUS: Record<string, string> = {
    CONFIRMED: "Confirmado",
    RECEIVED: "Recebido",
    PENDING: "Pendente",
    OVERDUE: "Vencido",
    REFUNDED: "Reembolsado",
};

function formatMoney(cents: number): string {
    return new Intl.NumberFormat("pt-BR", {
        style: "currency",
        currency: "BRL",
    }).format(cents / 100);
}

function formatDate(value: string | null): string {
    if (!value) return "—";
    return new Intl.DateTimeFormat("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
    }).format(new Date(value));
}

function addonStatus(addon: QrTableAddon | null, active: boolean): string {
    if (addon?.status === "canceled" && active) {
        return `Cancelado — acesso até ${formatDate(
            addon.current_period_ends_at
        )}`;
    }
    if (active) return "Ativo";
    if (addon?.status === "pending") return "Aguardando pagamento";
    if (addon?.status === "past_due") return "Pagamento pendente";
    if (addon?.status === "canceled") return "Cancelado";
    return "Inativo";
}

export default function QrCodeMesaSettingsSection({
    restaurantId,
}: {
    restaurantId: string;
}) {
    const [billing, setBilling] = useState<BillingPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [salesOpen, setSalesOpen] = useState(false);
    const [buying, setBuying] = useState(false);
    const [cancelOpen, setCancelOpen] = useState(false);
    const [canceling, setCanceling] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    const loadBilling = useCallback(async () => {
        setLoading(true);
        try {
            const response = await qrTableAuthenticatedFetch(
                `/api/qr-table/billing?restaurantId=${encodeURIComponent(
                    restaurantId
                )}`,
                { cache: "no-store" }
            );
            const payload = (await response.json()) as BillingPayload;
            if (!response.ok) {
                throw new Error(
                    payload.error || "Não foi possível carregar os pagamentos."
                );
            }
            setBilling(payload);
            void captureQrTableEvent("qr_code_mesa_settings_viewed", {
                restaurant_id: restaurantId,
                active: payload.active,
            });
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível carregar os pagamentos.",
                type: "error",
            });
        } finally {
            setLoading(false);
        }
    }, [restaurantId]);

    useEffect(() => {
        void loadBilling();

        const checkoutState = new URLSearchParams(window.location.search).get(
            "checkout"
        );
        if (checkoutState === "success") {
            setToast({
                message:
                    "Pagamento enviado. A ativação ocorre após a confirmação do Asaas.",
                type: "success",
            });
        }
    }, [loadBilling]);

    const openSales = () => {
        setSalesOpen(true);
        void captureQrTableEvent("qr_code_mesa_learn_more_viewed", {
            restaurant_id: restaurantId,
            source: "settings",
        });
    };

    const buy = async () => {
        setBuying(true);
        void captureQrTableEvent("qr_code_mesa_purchase_started", {
            restaurant_id: restaurantId,
            source: "settings",
        });
        try {
            await startQrTableCheckout(restaurantId, "settings");
        } catch (error) {
            setBuying(false);
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível abrir o pagamento.",
                type: "error",
            });
        }
    };

    const cancelSubscription = async () => {
        setCanceling(true);
        try {
            const response = await qrTableAuthenticatedFetch(
                "/api/qr-table/subscription",
                {
                    method: "DELETE",
                    body: JSON.stringify({ restaurantId }),
                }
            );
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) {
                throw new Error(
                    payload.error || "Não foi possível cancelar a assinatura."
                );
            }

            setCancelOpen(false);
            setToast({
                message: "Assinatura cancelada.",
                type: "success",
            });
            await loadBilling();
        } catch (error) {
            setToast({
                message:
                    error instanceof Error
                        ? error.message
                        : "Não foi possível cancelar a assinatura.",
                type: "error",
            });
        } finally {
            setCanceling(false);
        }
    };

    const addon = billing?.addon || null;
    const active = billing?.active === true;
    const canCancel =
        Boolean(addon?.asaas_subscription_id) && addon?.status !== "canceled";

    return (
        <>
            {toast && (
                <Toast
                    message={toast.message}
                    type={toast.type}
                    onClose={() => setToast(null)}
                />
            )}

            <QrCodeMesaSalesModal
                open={salesOpen}
                onClose={() => setSalesOpen(false)}
                onBuy={() => void buy()}
                buying={buying}
                active={active}
            />

            <ConfirmModal
                open={cancelOpen}
                onClose={() => setCancelOpen(false)}
                onConfirm={() => void cancelSubscription()}
                title="Descadastrar do plano?"
                description="As próximas cobranças serão canceladas. Seu histórico de pagamentos continuará disponível."
                confirmLabel="Descadastrar"
                isLoading={canceling}
                variant="danger"
            />

            <Card className="border border-gray-200 shadow-sm">
                <div className="mb-6">
                    <h2 className="text-xl font-medium text-gray-900">
                        Sistemas iMenu
                    </h2>
                    <p className="mt-1 text-sm text-gray-500">
                        Gerencie os produtos disponíveis na sua conta.
                    </p>
                </div>

                {loading ? (
                    <div className="flex justify-center py-10">
                        <Loader className="border-t-brand" />
                    </div>
                ) : (
                    <MenuProductCards
                        qrSelected={active}
                        qrActive={active}
                        onLearnMore={openSales}
                    />
                )}
            </Card>

            {(addon || (billing?.payments.length || 0) > 0) && (
                <Card className="border border-gray-200 shadow-sm">
                    <div className="flex flex-col justify-between gap-4 border-b border-gray-100 pb-5 sm:flex-row sm:items-start">
                        <div>
                            <h2 className="text-xl font-medium text-gray-900">
                                Assinaturas e pagamentos
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                iMenu QR Code Mesa
                            </p>
                        </div>
                        <div className="flex flex-col items-start gap-2 sm:items-end">
                            <span
                                className={`rounded-full px-3 py-1 text-xs font-semibold ${
                                    active
                                        ? "bg-green-100 text-green-800"
                                        : "bg-gray-100 text-gray-700"
                                }`}
                            >
                                {addonStatus(addon, active)}
                            </span>
                            {canCancel && (
                                <Button
                                    type="button"
                                    variant="secondary"
                                    className="text-sm text-red-600 hover:bg-red-50"
                                    onClick={() => setCancelOpen(true)}
                                >
                                    Descadastrar do plano
                                </Button>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-4 border-b border-gray-100 py-5 sm:grid-cols-2">
                        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                            <FontAwesomeIcon
                                icon={faCreditCard}
                                className="text-brand"
                            />
                            <div>
                                <p className="text-xs text-gray-500">Plano</p>
                                <p className="font-semibold text-gray-900">
                                    R$ 5,00/mês no cartão
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                            <FontAwesomeIcon
                                icon={faCalendarDays}
                                className="text-brand"
                            />
                            <div>
                                <p className="text-xs text-gray-500">
                                    Acesso atual até
                                </p>
                                <p className="font-semibold text-gray-900">
                                    {formatDate(addon?.current_period_ends_at || null)}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-5">
                        <h3 className="font-semibold text-gray-900">
                            Histórico de pagamentos
                        </h3>
                        {billing?.payments.length ? (
                            <div className="mt-4 overflow-x-auto rounded-xl border border-gray-200">
                                <table className="w-full min-w-[620px] text-left text-sm">
                                    <thead className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500">
                                        <tr>
                                            <th className="px-4 py-3 font-semibold">
                                                Data
                                            </th>
                                            <th className="px-4 py-3 font-semibold">
                                                Situação
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold">
                                                Valor
                                            </th>
                                            <th className="px-4 py-3 text-right font-semibold">
                                                Cobrança
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {billing.payments.map((payment) => (
                                            <tr key={payment.id}>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {formatDate(
                                                        payment.paid_at ||
                                                            payment.due_date ||
                                                            payment.created_at
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-gray-700">
                                                    {PAYMENT_STATUS[
                                                        payment.status
                                                    ] || payment.status}
                                                </td>
                                                <td className="px-4 py-3 text-right font-medium text-gray-900">
                                                    {formatMoney(
                                                        payment.amount_cents
                                                    )}
                                                </td>
                                                <td className="px-4 py-3 text-right">
                                                    {payment.invoice_url ? (
                                                        <a
                                                            href={
                                                                payment.invoice_url
                                                            }
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-2 font-semibold text-brand hover:underline"
                                                        >
                                                            Ver
                                                            <FontAwesomeIcon
                                                                icon={
                                                                    faExternalLinkAlt
                                                                }
                                                                className="text-xs"
                                                            />
                                                        </a>
                                                    ) : (
                                                        <span className="text-gray-400">
                                                            —
                                                        </span>
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <p className="mt-3 text-sm text-gray-500">
                                Nenhum pagamento registrado ainda.
                            </p>
                        )}
                    </div>
                </Card>
            )}
        </>
    );
}
