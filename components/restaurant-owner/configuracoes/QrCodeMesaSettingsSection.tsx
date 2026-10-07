"use client";

import { useCallback, useEffect, useState } from "react";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import {
    faCalendarDays,
    faCreditCard,
    faChevronDown,
    faExternalLinkAlt,
    faQrcode,
    faWandMagicSparkles,
} from "@fortawesome/free-solid-svg-icons";

import IaPlusSalesModal from "@/components/restaurant-owner/ia-vendas/IaPlusSalesModal";
import IaPlusProductCard from "@/components/restaurant-owner/ia-vendas/IaPlusProductCard";
import MenuProductCards from "@/components/restaurant-owner/mesas/MenuProductCards";
import QrCodeMesaCheckoutModal from "@/components/restaurant-owner/mesas/QrCodeMesaCheckoutModal";
import QrCodeMesaSalesModal from "@/components/restaurant-owner/mesas/QrCodeMesaSalesModal";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import ConfirmModal from "@/components/ui/ConfirmModal";
import Loader from "@/components/ui/Loader";
import Toast from "@/components/ui/Toast";
import { captureQrTableEvent } from "@/lib/qr-table/analytics";
import { qrTableAuthenticatedFetch } from "@/lib/qr-table/clientApi";
type Addon = {
    id: string;
    restaurant_id: string;
    product_key: string;
    status: string;
    price_cents: number;
    billing_cycle: string;
    payment_provider: string | null;
    payzu_payment_method: string | null;
    payzu_recurrence_id: string | null;
    payzu_payment_status: string | null;
    current_period_ends_at: string | null;
};

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

type BillingItem = {
    addon: Addon;
    active: boolean;
    payments: Payment[];
};

type BillingPayload = {
    addons: BillingItem[];
    error?: string;
};

const PAYMENT_STATUS: Record<string, string> = {
    CONFIRMED: "Confirmado",
    COMPLETED: "Confirmado",
    APPROVED: "Confirmado",
    RECEIVED: "Recebido",
    PENDING: "Pendente",
    OVERDUE: "Vencido",
    REFUNDED: "Reembolsado",
    DENIED: "Negado",
    FAILED: "Falhou",
    ABORTED: "Cancelado",
    VOIDED: "Cancelado",
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

function isPrepaid(addon: Addon | null): boolean {
    return Boolean(
        addon?.payment_provider === "mercadopago" || addon?.payment_provider === "payzu" &&
            addon.payzu_payment_method?.toUpperCase() === "PIX" &&
            !addon.payzu_recurrence_id
    );
}

function addonProductName(productKey: string): string {
    if (productKey === "ia_plus") return "iMenu IA Plus";
    if (productKey === "qr_code_mesa") return "iMenu QR Code Mesa";

    return productKey
        .split("_")
        .filter(Boolean)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");
}

function addonStatus(addon: Addon | null, active: boolean): string {
    if (active && isPrepaid(addon)) {
        return `Ativo — acesso até ${formatDate(
            addon?.current_period_ends_at || null
        )}`;
    }
    if (addon?.status === "canceled" && active) {
        return `Cancelado — acesso até ${formatDate(
            addon.current_period_ends_at
        )}`;
    }
    if (active) return "Ativo";
    if (isPrepaid(addon) && addon?.current_period_ends_at) {
        return "Expirado";
    }
    if (addon?.status === "pending") return "Aguardando pagamento";
    if (addon?.status === "past_due") return "Pagamento pendente";
    if (addon?.status === "canceled") return "Cancelado";
    return "Inativo";
}

function planLabel(addon: Addon | null): string {
    if (!addon) return "—";

    if (isPrepaid(addon)) {
        return `Pix • ${formatMoney(addon.price_cents)} por período`;
    }

    if (addon.billing_cycle === "monthly") {
        const method =
            addon.payment_provider === "asaas" ? " no cartão" : "";
        return `${formatMoney(addon.price_cents)}/mês${method}`;
    }

    return formatMoney(addon.price_cents);
}

export default function QrCodeMesaSettingsSection({
    restaurantId,
    showHeader = true,
    presentation = "default",
}: {
    restaurantId: string;
    showHeader?: boolean;
    presentation?: "default" | "plans";
}) {
    const [billing, setBilling] = useState<BillingPayload | null>(null);
    const [loading, setLoading] = useState(true);
    const [salesOpen, setSalesOpen] = useState(false);
    const [iaPlusOpen, setIaPlusOpen] = useState(false);
    const [renewalProduct, setRenewalProduct] = useState<"qr_code_mesa" | "ia_plus">("qr_code_mesa");
    const [renewalOpen, setRenewalOpen] = useState(false);
    const [cancelAddonId, setCancelAddonId] = useState<string | null>(null);
    const [canceling, setCanceling] = useState(false);
    const [toast, setToast] = useState<{
        message: string;
        type: "success" | "error" | "info";
    } | null>(null);

    const loadBilling = useCallback(async () => {
        setLoading(true);
        try {
            const response = await qrTableAuthenticatedFetch(
                `/api/addons/billing?restaurantId=${encodeURIComponent(
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
            const qrCodeMesa = payload.addons.find(
                (item) => item.addon.product_key === "qr_code_mesa"
            );
            void captureQrTableEvent("qr_code_mesa_settings_viewed", {
                restaurant_id: restaurantId,
                active: qrCodeMesa?.active === true,
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

    const openRenewal = () => {
        setRenewalOpen(true);
    };

    const closeSales = () => {
        setSalesOpen(false);
    };

    const cancelSubscription = async () => {
        if (!cancelAddonId) return;

        setCanceling(true);
        try {
            const response = await qrTableAuthenticatedFetch(
                "/api/addons/subscription",
                {
                    method: "DELETE",
                    body: JSON.stringify({
                        restaurantId,
                        addonId: cancelAddonId,
                    }),
                }
            );
            const payload = (await response.json()) as { error?: string };
            if (!response.ok) {
                throw new Error(
                    payload.error || "Não foi possível cancelar a assinatura."
                );
            }

            setCancelAddonId(null);
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

    const qrBilling =
        billing?.addons.find(
            (item) => item.addon.product_key === "qr_code_mesa"
        ) || null;
    const addon = qrBilling?.addon || null;
    const active = qrBilling?.active === true;
    const iaPlusActive = billing?.addons.some(item => item.addon.product_key === "ia_plus" && item.active) === true;
    const cancelBilling =
        billing?.addons.find((item) => item.addon.id === cancelAddonId) || null;
    const cancelAddon = cancelBilling?.addon || null;
    const BillingContainer = presentation === "plans" ? "section" : Card;
    const productCards = loading ? (
        <div className="flex justify-center py-10">
            <Loader className="border-t-brand" />
        </div>
    ) : (
        <MenuProductCards
            presentation={presentation}
            qrSelected={active}
            qrActive={active}
            onLearnMore={openSales}
            extraCard={<IaPlusProductCard presentation={presentation} active={iaPlusActive} onLearnMore={() => setIaPlusOpen(true)} />}
        />
    );

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
                onClose={closeSales}
                restaurantId={restaurantId}
                source="settings"
                onPaid={async () => {
                    closeSales();
                    setToast({
                        message: "Pagamento confirmado. QR Code Mesa ativado!",
                        type: "success",
                    });
                    await loadBilling();
                }}
                active={active}
            />

            <QrCodeMesaCheckoutModal
                productKey={renewalProduct}
                open={renewalOpen}
                onClose={() => setRenewalOpen(false)}
                restaurantId={restaurantId}
                source="settings"
                renewal
                onPaid={async () => {
                    setRenewalOpen(false);
                    setToast({
                        message: "Pagamento confirmado. Renovação concluída!",
                        type: "success",
                    });
                    await loadBilling();
                }}
            />

            <IaPlusSalesModal active={iaPlusActive} open={iaPlusOpen} onClose={() => setIaPlusOpen(false)} restaurantId={restaurantId} onPaid={async () => { setIaPlusOpen(false); await loadBilling(); }} />

            <ConfirmModal
                open={Boolean(cancelAddonId)}
                onClose={() => setCancelAddonId(null)}
                onConfirm={() => void cancelSubscription()}
                title={
                    cancelAddon
                        ? `Descadastrar ${addonProductName(cancelAddon.product_key)}?`
                        : "Descadastrar adicional?"
                }
                description={
                    cancelAddon?.current_period_ends_at
                        ? `A assinatura será cancelada. O acesso atual continua até ${formatDate(cancelAddon.current_period_ends_at)} e o histórico de pagamentos será mantido.`
                        : "A assinatura será cancelada e o histórico de pagamentos será mantido."
                }
                confirmLabel="Descadastrar"
                isLoading={canceling}
                variant="danger"
            />

            {showHeader ? (
                <Card className="border border-gray-200 shadow-sm">
                    <div className="mb-6">
                        <h2 className="text-xl font-medium text-gray-900">
                            Sistemas iMenu
                        </h2>
                        <p className="mt-1 text-sm text-gray-500">
                            Gerencie os produtos disponíveis na sua conta.
                        </p>
                    </div>
                    {productCards}
                </Card>
            ) : (
                presentation === "plans" ? (
                    <section aria-labelledby="available-plans-heading" className="plans-catalog">
                        <div className="plans-section-heading">
                            <div>
                                <h2 id="available-plans-heading">Planos disponíveis</h2>
                            </div>
                        </div>
                        {productCards}
                    </section>
                ) : productCards
            )}

            {(billing?.addons.length || 0) > 0 && (
                <BillingContainer id={presentation === "plans" ? "suas-assinaturas" : undefined} className={presentation === "plans" ? "plans-subscriptions" : "border border-gray-200 shadow-sm"}>
                    <div className={presentation === "plans" ? "plans-section-heading" : "border-b border-gray-100 pb-5"}>
                        <div>
                            <h2 className="text-xl font-medium text-gray-900">
                                {presentation === "plans" ? "Suas assinaturas" : "Assinaturas e pagamentos"}
                            </h2>
                            <p className="mt-1 text-sm text-gray-500">
                                Acompanhe o acesso, as renovações e os pagamentos dos seus planos.
                            </p>
                        </div>
                    </div>

                    <div className={presentation === "plans" ? "plans-subscription-list" : "divide-y divide-gray-100"}>
                        {billing?.addons.map((item) => {
                            const itemAddon = item.addon;
                            const itemActive = item.active;
                            const isQrCodeMesa =
                                itemAddon.product_key === "qr_code_mesa";
                            const itemCanRenew =
                                (isQrCodeMesa || itemAddon.product_key === "ia_plus") && isPrepaid(itemAddon);
                            const itemCanCancel =
                                itemActive &&
                                itemAddon.status !== "canceled" &&
                                itemAddon.payment_provider === "asaas";

                            return (
                                <section
                                    key={itemAddon.id}
                                    className={presentation === "plans" ? "plans-subscription-card" : "py-5 first:pt-5 last:pb-0"}
                                >
                                    <div className={presentation === "plans" ? "plans-subscription-head" : "flex flex-col justify-between gap-3 sm:flex-row sm:items-start"}>
                                        <div className={presentation === "plans" ? "plans-subscription-identity" : undefined}>
                                            {presentation === "plans" && (
                                                <span className="plans-subscription-icon" aria-hidden="true">
                                                    <FontAwesomeIcon icon={isQrCodeMesa ? faQrcode : itemAddon.product_key === "ia_plus" ? faWandMagicSparkles : faCreditCard} />
                                                </span>
                                            )}
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2">
                                                    <h3 className="font-semibold text-gray-900">
                                                        {addonProductName(itemAddon.product_key)}
                                                    </h3>
                                                    {presentation === "plans" && (
                                                        <Badge variant={itemActive && itemAddon.status !== "canceled" ? "success" : "neutral"}>
                                                            {itemAddon.status === "canceled" ? "Cancelado" : itemActive ? "Ativo" : addonStatus(itemAddon, false)}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {presentation !== "plans" && (
                                                    <p className="mt-1 text-sm text-gray-500">{planLabel(itemAddon)}</p>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-wrap items-center gap-2">
                                            {presentation !== "plans" && (
                                                <span className={`w-fit rounded-full px-3 py-1 text-xs font-semibold ${itemActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>
                                                    {addonStatus(itemAddon, itemActive)}
                                                </span>
                                            )}
                                            {itemCanRenew && (
                                                <Button
                                                    type="button"
                                                    variant="primary"
                                                    onClick={() => { setRenewalProduct(itemAddon.product_key === "ia_plus" ? "ia_plus" : "qr_code_mesa"); openRenewal(); }}
                                                >
                                                    Renovar
                                                </Button>
                                            )}
                                            {itemCanCancel && (
                                                <Button
                                                    type="button"
                                                    variant="secondary"
                                                    onClick={() =>
                                                        setCancelAddonId(
                                                            itemAddon.id
                                                        )
                                                    }
                                                >
                                                    Descadastrar do plano
                                                </Button>
                                            )}
                                        </div>
                                    </div>

                                    <div className={`grid gap-4 border-b border-gray-100 py-5 sm:grid-cols-2 ${presentation === "plans" ? "plans-subscription-meta" : ""}`}>
                                        <div className="flex items-center gap-3 rounded-xl bg-gray-50 p-4">
                                            <FontAwesomeIcon
                                                icon={faCreditCard}
                                                className="text-brand"
                                            />
                                            <div>
                                                <p className="text-xs text-gray-500">
                                                    {presentation === "plans" ? "Valor do plano" : "Plano"}
                                                </p>
                                                <p className="font-semibold text-gray-900">
                                                    {planLabel(itemAddon)}
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
                                                    {formatDate(
                                                        itemAddon.current_period_ends_at
                                                    )}
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    <details className={presentation === "plans" ? "plans-payment-history" : "pt-5"} open={presentation === "plans" ? undefined : true}>
                                        <summary className="flex items-center justify-between gap-3 font-semibold text-gray-900">
                                            <span>Histórico de pagamentos</span>
                                            {presentation === "plans" && (
                                                <span className="flex items-center gap-3 text-xs text-gray-500">
                                                    {item.payments.length} {item.payments.length === 1 ? "pagamento" : "pagamentos"}
                                                    <FontAwesomeIcon icon={faChevronDown} className="plans-history-chevron" />
                                                </span>
                                            )}
                                        </summary>
                                        {item.payments.length ? (
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
                                                        {item.payments.map(
                                                            (payment) => (
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
                                                                                href={payment.invoice_url}
                                                                                target="_blank"
                                                                                rel="noreferrer"
                                                                                className="inline-flex items-center gap-2 font-semibold text-brand hover:underline"
                                                                            >
                                                                                Ver
                                                                                <FontAwesomeIcon
                                                                                    icon={faExternalLinkAlt}
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
                                                            )
                                                        )}
                                                    </tbody>
                                                </table>
                                            </div>
                                        ) : (
                                            <p className="mt-3 text-sm text-gray-500">
                                                Nenhum pagamento registrado ainda.
                                            </p>
                                        )}
                                    </details>

                                </section>
                            );
                        })}
                    </div>
                </BillingContainer>
            )}
            {presentation === "plans" && !loading && billing && !billing.addons.length && (
                <section id="suas-assinaturas" className="plans-subscriptions">
                    <div className="plans-section-heading">
                        <div>
                            <h2>Suas assinaturas</h2>
                            <p>Acompanhe o acesso, as renovações e os pagamentos dos seus planos.</p>
                        </div>
                    </div>
                    <div className="plans-subscription-card plans-subscription-empty">
                        <span className="plans-subscription-icon" aria-hidden="true">
                            <FontAwesomeIcon icon={faCreditCard} />
                        </span>
                        <div>
                            <p className="font-semibold text-gray-900">Nenhum plano adicional contratado.</p>
                            <p className="mt-1 text-sm text-gray-500">Ao adicionar um plano, você poderá gerenciar sua assinatura e os pagamentos aqui.</p>
                        </div>
                    </div>
                </section>
            )}
        </>
    );
}
