"use client";

import { useCartStore } from "@/lib/stores/costumer/cartStore";
import Button from "@/components/ui/Button";
import Tooltip from "@/components/ui/Tooltip";
import { useCheckoutStore } from "@/lib/stores/costumer/checkoutStore";
import { useState, useRef } from "react";

export default function CartBar({
                                    onOpenCartAction,
                                    cartOpen,
                                    restaurant,
                                    setCartOpenAction,
    closeItemModalOpen,
                                }: {
    onOpenCartAction: () => void,
    cartOpen: boolean,
    restaurant: any,
    setCartOpenAction: React.Dispatch<React.SetStateAction<boolean>>;
    closeItemModalOpen: () => void;
}) {
    const items = useCartStore((s) => s.items);

    const step = useCheckoutStore((s) => s.step);
    const setStep = useCheckoutStore((s) => s.setStep);
    const setShowAddressWarning = useCheckoutStore(s => s.setShowAddressWarning);
    const [cartWarningVisible, setCartWarningVisible] = useState(false);
    const [cartWarningClosing, setCartWarningClosing] = useState(false);

    // 🔥 REQUIRED FOR BACKDROP FADE-IN
    const [backdropVisible, setBackdropVisible] = useState(false);

    const checkoutState = useCheckoutStore((s) => s);
    const [closedByDrag, setClosedByDrag] = useState(false);
    const [translateY, setTranslateY] = useState(0);
    const [dragging, setDragging] = useState(false);
    const isContinueBlocked = useCheckoutStore(state => state.isContinueBlocked);
    const touchStartY = useRef<number | null>(null);
    const CLOSE_THRESHOLD = 120;

    if (items.length === 0) return null;

    const total = items.reduce((acc, i) => acc + i.total_cents, 0);
    const itemCount = items.reduce((acc, i) => acc + i.qty, 0);

    const delivery_fee_cents = checkoutState.delivery_fee_cents
        ? Number(checkoutState.delivery_fee_cents)
        : 0;

    const allRequiredFilled = Boolean(
        checkoutState.cep?.length >= 8 &&
        checkoutState.rua &&
        checkoutState.numero &&
        checkoutState.nome &&
        checkoutState.celular
    );

    const disabledContinue = cartOpen && step === "info" && !allRequiredFilled;

    const missingFields: string[] = [];
    if (!checkoutState.cep || checkoutState.cep.length < 8) {
        missingFields.push("CEP");
    }
    if (!checkoutState.rua) missingFields.push("Rua");
    if (!checkoutState.numero) missingFields.push("Número");
    if (!checkoutState.nome) missingFields.push("Nome");
    if (!checkoutState.celular) missingFields.push("Celular");

    const tooltipText =
        missingFields.length > 0
            ? `Preencha: ${missingFields.join(", ")}`
            : "";

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

            if (totalCents < restaurant.min_order_cents) {
                showCartWarning(true)
                return;
            }
            setStep("info");
            return;
        }

        if (cartOpen && !allRequiredFilled && step !== "info") {
            setStep("info");
            return;
        } //inutil?

        if (step === "info" && !allRequiredFilled) {

            return;
        }

        const fee = useCheckoutStore.getState().delivery_fee_cents;
        const deliveryFeeCents = fee !== null ? Number(fee) : null;


        if (cartOpen && step === "info" && fee === false) {
            useCheckoutStore.setState({ cepTrigger: true });
            return;
        }

        if (cartOpen && step === "info" && fee === null) {
            setShowAddressWarning(true)
            return;
        }

        if (!cartOpen) {
            onOpenCartAction();
            return;
        }

        if (step === "info") {
            setStep("checkout");
            return;
        }

        if (step === "checkout") {
            await createOrder();
        }
    }

    function showCartWarning(show: boolean) {
        if (!show) {

            // 🔥 fade backdrop OUT
            setBackdropVisible(false);

            if (closedByDrag) {
                setCartWarningClosing(true);

                setTimeout(() => {
                    setCartWarningVisible(false);
                    setCartWarningClosing(false);
                    setTranslateY(0);
                    setClosedByDrag(false);
                }, 220);
                return;
            }

            setCartWarningClosing(true);

            setTimeout(() => {
                setCartWarningVisible(false);
                setCartWarningClosing(false);
                setTranslateY(0);
            }, 220);

        } else {
            setCartWarningVisible(true);

            // 🔥 fade backdrop IN AFTER mount
            requestAnimationFrame(() => {
                setBackdropVisible(true);
            });
        }
    }

    async function createOrder() {
        const cart = useCartStore.getState();
        const checkout = useCheckoutStore.getState();

        const body = {
            restaurantId: checkout.restaurantId,
            customer_name: checkout.nome,
            customer_phone: checkout.celular,
            customer_address: `${checkout.rua}, ${checkout.numero} - ${checkout.cep} (${checkout.complemento})`,
            delivery_fee_cents: checkout.delivery_fee_cents ? Number(checkout.delivery_fee_cents) : 0,
            paymentMethod: checkout.pagamento,
            delivery_time_minutes: checkout.delivery_time_minutes,

            // 👇 THIS IS NOW CORRECT
            items: cart.items.map((i) => ({
                cart_row_id: i.id,
                base_item_id: i.base_item_id,
                name: i.name,
                qty: i.qty,
                unit_price_cents: i.unit_price_cents,
                total_cents: i.total_cents,
                observation: i.observation ?? null,
                selectedSubitems: i.selectedSubitems
            }))
        };

        const res = await fetch("/api/orders", {
            method: "POST",
            body: JSON.stringify(body),
            headers: { "Content-Type": "application/json" }
        });

        const data = await res.json();

        try {
            document.cookie = `order_page_entered_id_${body.restaurantId}=${data.id}; path=/; max-age=${60 * 60 * 5}`;
        } catch (err) {
            console.error("[COOKIE] Failed to set order_page_entered cookie:", err);
        }

        try {
            if(typeof window !== "undefined")
                localStorage.removeItem(`cart-storage-${window.location.pathname.split("/")[1]}`);
            else localStorage.removeItem("cart-storage")

        } catch (err) {
            console.error("[CART] Failed to clear cart-storage:", err);
        }

        console.log("removed cart-storage and created cookie")

        if (data.payment_type === "offline") {
            window.location.href = data.redirect;
            return;
        }

        if (data.payment_type === "online") {
            window.location.href = data.init_point;
            return;
        }

        if (data.id) {
            window.location.href = `/pedido/${data.id}`;
        }
    }


    const displayTotalCents = total + (delivery_fee_cents || 0);

    const handleTouchStart = (e: React.TouchEvent) => {
        touchStartY.current = e.touches[0].clientY;
        setDragging(true);
        setTranslateY(0);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (touchStartY.current === null) return;
        const currentY = e.touches[0].clientY;
        const diff = currentY - touchStartY.current;

        if (diff <= 0) {
            setTranslateY(0);
            return;
        }

        const dampened = diff > 300 ? 300 + (diff - 300) * 0.2 : diff;
        setTranslateY(dampened);
    };

    const handleTouchEnd = () => {
        const final = translateY;
        touchStartY.current = null;
        setDragging(false);

        if (final >= CLOSE_THRESHOLD) {
            setClosedByDrag(true);

            setCartWarningClosing(true);
            setBackdropVisible(false); // fade out immediately

            const offscreen = typeof window !== "undefined" ? window.innerHeight : 1000;
            setTranslateY(offscreen);

            setTimeout(() => {
                setCartWarningVisible(false);
                setCartWarningClosing(false);
                setTranslateY(0);
                setClosedByDrag(false);
            }, 260);

            return;
        }

        setTranslateY(0);
    };

    return (
        <>
            <div className="fixed pb-8 2xl:pb-6 2xl:pt-5 md:pb-4 bottom-0 left-0 right-0 z-50  bg-white shadow-[0_-4px_12px_rgba(0,0,0,0.12)] px-4 py-3 border-t border-gray-200">
                <div className="flex items-center justify-between w-full md:px-7 2xl:px-12">
                    <div className="flex flex-col text-left text-[12px] 2xl:text-lg text-gray-600">
                        <span>
                            {checkoutState.delivery_fee_cents === null ||
                            checkoutState.delivery_fee_cents === undefined || !checkoutState.delivery_fee_cents
                                ? "Total sem a entrega"
                                : "Total com a entrega"}
                        </span>

                        <span>
                            <span className="font-semibold text-black text-lg  2xl:text-xl leading-tight tracking-tighter">
                                R$ {(displayTotalCents / 100).toFixed(2).replace('.', ',')}
                            </span>
                            <span>
                                / {itemCount} {itemCount === 1 ? "item" : "itens"}
                            </span>
                        </span>
                    </div>

                    {maybeWrap(
                        <Button
                            variant="primary"
                            onClick={handleClick}
                            loading={isContinueBlocked}
                            disabled={disabledContinue}
                            className={`py-3 px-10 2xl:px-15 2xl:py-4 text-[13px] 2xl:text-lg tracking-wide font-normal ${
                                disabledContinue ? "!bg-gray-300 focus:ring-transparent" : ""
                            }`}
                        >
                            {step === "checkout"
                                ? "Confirmar"
                                : cartOpen
                                    ? "Continuar"
                                    : "Ver Sacola"}
                        </Button>
                    )}
                </div>
            </div>

            {cartWarningVisible && (
                <>
                    {/* 🔥 FIXED BACKDROP WITH FADE-IN & FADE-OUT */}
                    <div
                        onClick={() => showCartWarning(false)}
                        className={`fixed inset-0 z-49 bg-black/40 backdrop-blur-[1px]
                            transition-opacity duration-300
                            ${backdropVisible ? "opacity-100" : "opacity-0"}
                        `}
                    />

                    <div
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                        className={`
                            fixed bottom-0 left-0 right-0 z-50
                            bg-white rounded-t-2xl shadow-xl
                            h-[30vh]
                            p-6 
                            ${closedByDrag ? "" : cartWarningClosing ? "animate-slide-down" : "animate-slide-up"}
                        `}
                        style={{
                            transform: `translateY(${translateY}px)`,
                            transition: dragging ? "none" : "transform 250ms ease",
                            touchAction: "pan-y"
                        }}
                    >
                        <div className="text-center">
                            <div className="text-text text-md font-medium mb-2 mt-4">
                                Valor mínimo do pedido.
                            </div>
                            <p className="text-gray-500 mb-4 text-sm">
                                O pedido mínimo deste restaurante é de <b>R$ {(restaurant.min_order_cents/100).toFixed(2).replace(".",",")}</b>, sem contar com a taxa de entrega.
                            </p>
                            <Button variant={"primary"} className={"text-sm w-full py-3"} onClick={() => {
                                showCartWarning(false);
                                setCartOpenAction(false);
                            }}>
                                Adicionar mais itens
                            </Button>
                            <p className="text-brand text-sm mt-4" onClick={() => showCartWarning(false)}>
                                Ok, entendi
                            </p>
                        </div>
                    </div>
                </>
            )}
        </>
    );
}
