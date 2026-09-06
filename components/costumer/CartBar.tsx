"use client";

import {
    getCartStorageKey,
    useCartStore,
} from "@/lib/stores/costumer/cartStore";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import HybridModal from "@/components/ui/HybridModal";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { useState } from "react";
import {formatPrice, promotionPrice} from "@/lib/utils/formatPrice";
import { captureConsumerEvent } from "@/lib/analytics/captureConsumerEvent";
import { CONSUMER_EVENTS } from "@/lib/analytics/consumerEvents";
import { useRouter } from "next/navigation";
import type { PromotionResult } from "@/lib/promotions/automatic";
import type { QrTableMenuContext } from "@/lib/qr-table/types";

export default function CartBar({
                                    onOpenCartAction,
                                    cartOpen,
                                    restaurant,
                                    setCartOpenAction,
    closeItemModalOpen, trackMeta, slug, tableOrder, selectedTableId,
    selectedTableName, promotionResult
                                }: {
    onOpenCartAction: () => void,
    cartOpen: boolean,
    restaurant: any,
    setCartOpenAction: React.Dispatch<React.SetStateAction<boolean>>;
    closeItemModalOpen: () => void;
    trackMeta?: (slug: string, eventName: string, customData: Record<string, any>) => void;
    slug?: string;
    tableOrder?: QrTableMenuContext | null;
    selectedTableId?: string | null;
    selectedTableName?: string | null;
    promotionResult?: PromotionResult;
}) {
    const router = useRouter();
    const items = useCartStore((s) => s.items);

    const step = useCheckoutStore((s) => s.step);
    const setStep = useCheckoutStore((s) => s.setStep);
    const setShowAddressWarning = useCheckoutStore(s => s.setShowAddressWarning);
    const [cartWarningVisible, setCartWarningVisible] = useState(false);

    const checkoutState = useCheckoutStore((s) => s);
    const isTableOrder = Boolean(tableOrder);
    const isPickup = Boolean((checkoutState as any).is_pickup);
    const isContinueBlocked = useCheckoutStore(state => state.isContinueBlocked);

    if (items.length === 0) return null;

    const total = items.reduce((acc, i) => acc + (promotionPrice(i) || i.total_cents), 0);
    const itemCount = items.reduce((acc, i) => acc + i.qty, 0);

    const delivery_fee_cents = isPickup || isTableOrder
        ? 0
        : checkoutState.delivery_fee_cents
            ? Number(checkoutState.delivery_fee_cents)
            : 0;

    const discount_cents = isTableOrder
        ? 0
        : checkoutState.coupon_discount_cents || 0;

    const allRequiredFilled = isTableOrder
        ? Boolean(checkoutState.nome && selectedTableId)
        : Boolean(
              checkoutState.nome &&
                  checkoutState.celular &&
                  (isPickup ||
                      (checkoutState.cep?.length >= 8 &&
                          checkoutState.rua &&
                          checkoutState.bairro &&
                          checkoutState.numero))
          );

    const disabledContinue = cartOpen && step === "info" && !allRequiredFilled;

    const missingFields: string[] = [];
    if (isTableOrder) {
        if (!selectedTableId) missingFields.push("Mesa");
    } else if (!isPickup) {
        if (!checkoutState.cep || checkoutState.cep.length < 8) {
            missingFields.push("CEP");
        }
        if (!checkoutState.rua) missingFields.push("Rua");
        if (!checkoutState.bairro) missingFields.push("Bairro");
        if (!checkoutState.numero) missingFields.push("Número");
    }
    if (!checkoutState.nome) missingFields.push("Nome");
    if (!isTableOrder && !checkoutState.celular) missingFields.push("Celular");

    const tooltipText =
        missingFields.length > 0
            ? `Preencha: ${missingFields.join(", ")}`
            : "";

    const originalTotalCents = total + delivery_fee_cents;
    const finalTotalCents = promotionResult?.total_cents ?? Math.max(originalTotalCents - discount_cents, 0);
    const hasDiscount = (promotionResult?.discount_cents ?? discount_cents) > 0;

    const consumerProperties = () => {
        const currentItems = useCartStore.getState().items;

        return {
            restaurant_id: restaurant?.id || null,
            restaurant_slug: slug || null,
            cart_total_cents: currentItems.reduce(
                (sum, item) =>
                    sum + (promotionPrice(item) || item.total_cents),
                0
            ),
            cart_item_count: currentItems.reduce(
                (sum, item) => sum + item.qty,
                0
            ),
        };
    };

    const maybeWrap = (children: React.ReactNode) => {
        if (disabledContinue && step === "info") {
            return (
                <Tooltip text={tooltipText}  position="left" className={!disabledContinue ? "!hidden" : ""} tooltipClassName={!disabledContinue ? "!hidden" : ""}>
                    {children}
                </Tooltip>
            );
        }
        return children;
    };

    async function handleClick() {
        closeItemModalOpen();
        if (cartOpen && step === "cart") {
            const totalCents = items.reduce((acc,i)=>acc+i.total_cents,0);

            if (!isTableOrder && totalCents < restaurant.min_order_cents) {
                setCartWarningVisible(true);
                return;
            }
            if (!isTableOrder) {
                captureConsumerEvent(
                    CONSUMER_EVENTS.addressStarted,
                    consumerProperties()
                );
            }
            setStep("info");
            return;
        }

        if (cartOpen && !allRequiredFilled && step !== "info") {
            captureConsumerEvent(
                CONSUMER_EVENTS.addressStarted,
                consumerProperties()
            );
            setStep("info");
            return;
        }

        if (step === "info" && !allRequiredFilled) return;

        const fee = useCheckoutStore.getState().delivery_fee_cents;

        if (!isTableOrder && !isPickup && cartOpen && step === "info" && fee === false) {
            useCheckoutStore.setState({ cepTrigger: true });
            return;
        }

        if (!isTableOrder && !isPickup && cartOpen && step === "info" && fee === null) {
            setShowAddressWarning(true)
            return;
        }

        if (!cartOpen) {
            captureConsumerEvent(
                CONSUMER_EVENTS.informationStarted,
                consumerProperties()
            );
            onOpenCartAction();
            return;
        }

        if (step === "info") {
            if (isTableOrder) {
                if (isContinueBlocked) return;
                useCheckoutStore.setState({ isContinueBlocked: true });
                try {
                    await createOrder();
                } finally {
                    setTimeout(() => {
                        useCheckoutStore.setState({ isContinueBlocked: false });
                    }, 6000);
                }
                return;
            }

            captureConsumerEvent(
                CONSUMER_EVENTS.paymentStarted,
                consumerProperties()
            );
            setStep("checkout");
            return;
        }

        if (step === "checkout") {
            if (isContinueBlocked) return;
            useCheckoutStore.setState({ isContinueBlocked: true });

            try {
                await createOrder();
            } finally {
                setTimeout(() => {
                    useCheckoutStore.setState({ isContinueBlocked: false });
                },6000)
            }
        }
    }

    async function createOrder() {
        const cart = useCartStore.getState();
        const checkout = useCheckoutStore.getState();
        const pickup = !isTableOrder && Boolean((checkout as any).is_pickup);
        const shouldReturnToGarcom =
            isTableOrder &&
            typeof window !== "undefined" &&
            new URLSearchParams(window.location.search).get("source") === "garcom";
        const shouldOpenWhatsapp =
            restaurant.force_whatsapp_order_confirmation === true &&
            typeof window !== "undefined" &&
            window.matchMedia("(max-width: 767px)").matches;
        const whatsappWindow = shouldOpenWhatsapp
            ? window.open("", "_blank")
            : null;

        const subtotal_cents = cart.items.reduce(
            (sum, i) => sum + (promotionPrice(i) || i.total_cents),
            0
        );

        const delivery_fee_cents = pickup || isTableOrder
            ? 0
            : checkout.delivery_fee_cents && checkout.delivery_fee_cents !== true
                ? Number(checkout.delivery_fee_cents)
                : 0;

        const discount_cents = isTableOrder ? 0 : checkout.coupon_discount_cents || 0;
        const changeFor = !isTableOrder && checkout.pagamento === "dinheiro"
            ? String((checkout as any).troco ?? "").replace(/^R\$\s*/i, "").trim()
            : "";
        const changeObservation = changeFor ? `Troco para: R$ ${changeFor}` : "";
        const currentPromotion = promotionResult;
        const total_cents = currentPromotion?.total_cents ?? subtotal_cents + delivery_fee_cents - discount_cents;

        if (trackMeta && slug) {
            trackMeta?.(slug, "Purchase", {
                content_ids: cart.items.map(i => i.id),
                content_type: "product",
                value: total_cents / 100,
                currency: "BRL"
            });
        }

        const body = {
            restaurantId: restaurant.id,
            expected_promotion: { id: currentPromotion?.promotion?.id || null, total_cents },
            customer_name: checkout.nome,
            customer_phone: isTableOrder ? null : checkout.celular,
            customer_address: pickup || isTableOrder
                ? null
                : `${checkout.rua}, ${checkout.numero} - ${checkout.bairro} - ${checkout.cep}${checkout.complemento ? ` (${checkout.complemento})` : ""}`,
            delivery_fee_cents,
            is_delivery: isTableOrder ? "mesa" : pickup ? "retirada" : "entrega",
            paymentMethod: isTableOrder ? null : checkout.pagamento,
            delivery_time_minutes: pickup || isTableOrder ? null : checkout.delivery_time_minutes,
            scheduled_for: isTableOrder ? null : checkout.scheduled_for || null,
            table_token: isTableOrder ? tableOrder?.token : null,
            table_id: isTableOrder ? selectedTableId : null,
            items: cart.items.map((i, index) => {
                const existingObservation = i.observation ?? null;
                const observation = index === 0 && changeObservation
                    ? existingObservation
                        ? `${existingObservation}\n${changeObservation}`
                        : changeObservation
                    : existingObservation;

                return {
                    cart_row_id: i.id,
                    base_item_id: i.base_item_id,
                    name: i.name,
                    qty: i.qty,
                    unit_price_cents: i.unit_price_cents,
                    total_cents: i.total_cents,
                    observation,
                    selectedSubitems: i.selectedSubitems,
                    promotion: i.promotion,
                    is_reward: i.is_reward === true
                };
            }),
            coupon_id: isTableOrder ? null : checkout.coupon_id || null,
            coupon_code: isTableOrder ? null : checkout.coupon_code || null,
            coupon_type: isTableOrder ? null : checkout.coupon_type || null,
            coupon_discount_cents: discount_cents,
            subtotal_cents,
            total_cents,
        };

        const res = await fetch("/api/orders", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json();

        if (!res.ok) {
            whatsappWindow?.close();
            if (res.status === 409) router.refresh();
            window.alert(data?.error || "Não foi possível criar o pedido. Tente novamente.");
            return;
        }

        try {
            if (!isTableOrder && checkout.coupon_id && (!currentPromotion?.promotion || currentPromotion.coupon_discount_cents > 0)) {
                const couponUsage = {
                    coupon_id: checkout.coupon_id,
                    coupon_code: checkout.coupon_code,
                    used_at: Date.now()
                };
                if (typeof window !== "undefined") {
                    localStorage.setItem(`coupon_used_${body.restaurantId}`, JSON.stringify(couponUsage));
                }
                document.cookie = `coupon_used_${body.restaurantId}=${encodeURIComponent(JSON.stringify(couponUsage))}; path=/; max-age=${60 * 60 * 24 * 30}`;
            }
        } catch (err) {
            console.error("[COUPON] Failed to persist coupon usage:", err);
        }

        try {
            document.cookie = `order_page_entered_id_${body.restaurantId}=${data.id}; path=/; max-age=${60 * 60 * 5}`;
        } catch (err) {
            console.error("[COOKIE] Failed to set order_page_entered cookie:", err);
        }

        try {
            if (typeof window !== "undefined") localStorage.removeItem(getCartStorageKey());
            else localStorage.removeItem("cart-storage");
        } catch (err) {
            console.error("[CART] Failed to clear cart-storage:", err);
        }

        useCheckoutStore.setState({ is_pickup: false, scheduled_for: null } as any);

        const createdOrderId = data.order_id || data.id;
        if (shouldOpenWhatsapp && createdOrderId) {
            try {
                const confirmationResponse = await fetch(
                    `/api/orders/${createdOrderId}/whatsapp-confirmation`,
                    { cache: "no-store" }
                );

                if (confirmationResponse.ok) {
                    const confirmation = await confirmationResponse.json();
                    if (confirmation?.url) {
                        if (whatsappWindow) {
                            whatsappWindow.opener = null;
                            whatsappWindow.location.href = confirmation.url;
                        } else {
                            window.open(confirmation.url, "_blank", "noopener,noreferrer");
                        }
                    } else whatsappWindow?.close();
                } else whatsappWindow?.close();
            } catch (error) {
                whatsappWindow?.close();
                console.error("[WHATSAPP_ORDER_CONFIRMATION] Failed to open WhatsApp:", error);
            }
        } else whatsappWindow?.close();

        if (shouldReturnToGarcom) {
            window.location.href = "/garcom";
            return;
        }

        if (data.payment_type === "offline") {
            window.location.href = data.redirect;
            return;
        }

        if (data.payment_type === "online") {
            window.location.href = data.init_point;
            return;
        }
        if (data.id) {
            const orderSlug = slug || restaurant?.url_slug;
            window.location.href = orderSlug
                ? `/${orderSlug}/${data.id}`
                : `/pedido/${data.id}`;
        }
    }

    const displayTotalCents = total + (delivery_fee_cents || 0);

    const minimumOrderContent = (
        <div className="p-6 text-center md:p-8">
            <div className="text-text mb-2 mt-2 text-md font-medium">
                Valor mínimo do pedido.
            </div>
            <p className="mb-4 text-sm text-gray-500">
                O pedido mínimo deste restaurante é de <b>R$ {(restaurant.min_order_cents/100).toFixed(2).replace(".",",")}</b>, sem contar com a taxa de entrega.
            </p>
            <Button variant="primary" className="w-full py-3 text-sm" onClick={() => {
                setCartWarningVisible(false);
                setCartOpenAction(false);
            }}>
                Adicionar mais itens
            </Button>
            <button type="button" className="mt-4 cursor-pointer text-sm text-brand" onClick={() => setCartWarningVisible(false)}>
                Ok, entendi
            </button>
        </div>
    );

    return (
        <>
            <div className={`fixed pb-8 2xl:pb-6 2xl:pt-5 md:pb-4 bottom-0 left-0 right-0 ${cartOpen ? "z-[60]" : "z-[40]"} isolate bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.12)] px-4 py-3 border-t border-gray-200`}>
                {promotionResult?.promotion && (
                    <div className="mb-2 flex flex-wrap gap-1.5 md:px-7 2xl:px-12" aria-live="polite">
                        {promotionResult.promotion.benefits.map((benefit, index) => (
                            <span key={index} className="rounded-full bg-green-50 px-2.5 py-1 text-xs font-semibold text-green-700">
                                {benefit.label}
                            </span>
                        ))}
                    </div>
                )}
                <div className="relative z-10 flex items-center justify-between w-full md:px-7 2xl:px-12">
                    <div className="flex flex-col text-left text-[12px] 2xl:text-lg text-gray-600">
                        <span>
                            {isTableOrder
                                ? selectedTableName ? `Total • ${selectedTableName} ` : "Total "
                                : isPickup ? "Total para retirada "
                                : checkoutState.delivery_fee_cents === null || checkoutState.delivery_fee_cents === undefined || !checkoutState.delivery_fee_cents
                                    ? "Total sem a entrega " : "Total com a entrega "}
                        </span>
                        <span>
                            <span className={`${hasDiscount && "line-through text-gray-400 !text-sm 2xl:!text-base"} font-semibold text-black text-lg 2xl:text-xl leading-tight tracking-tighter`}>
                                {formatPrice(displayTotalCents)}
                            </span>
                            {hasDiscount && <span className="ml-1 font-semibold text-black text-lg 2xl:text-xl leading-tight tracking-tighter">{formatPrice(finalTotalCents)}</span>}
                            <span> / {itemCount} {itemCount === 1 ? "item" : "itens"}</span>
                        </span>
                    </div>

                    {maybeWrap(
                        <Button
                            variant="primary"
                            onClick={handleClick}
                            loading={isContinueBlocked}
                            disabled={disabledContinue}
                            className={`relative z-10 py-3 px-10 2xl:px-15 2xl:py-4 text-[13px] 2xl:text-lg tracking-wide font-normal ${disabledContinue ? "!bg-gray-300 focus:ring-transparent" : ""}`}
                        >
                            {isTableOrder && step === "info"
                                ? "Confirmar pedido"
                                : step === "checkout" ? "Confirmar" : cartOpen ? "Continuar" : "Ver Sacola"}
                        </Button>
                    )}
                </div>
            </div>

            {!isTableOrder && (
                <HybridModal
                    open={cartWarningVisible}
                    onClose={() => setCartWarningVisible(false)}
                    height={0.3}
                    className="md:max-w-md"
                >
                    {minimumOrderContent}
                </HybridModal>
            )}
        </>
    );
}
