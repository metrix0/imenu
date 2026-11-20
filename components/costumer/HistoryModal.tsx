"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
    faStar,
    faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ModalMobile from "@/components/ui/HybridModal";
import Toast from "@/components/ui/Toast";
import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { formatPrice } from "@/lib/utils/formatPrice";
import type { LoyaltyOffer } from "@/lib/types/types";
import { useHistoryStore } from "@/lib/stores/costumer/historyStore";

type Props = {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
    offer: LoyaltyOffer | null;
};

type ToastState = {
    message: string;
    type: "success" | "error" | "info";
};

function formatPhone(value: string): string {
    let digits = value.replace(/\D/g, "");

    if (
        digits.startsWith("55") &&
        (digits.length === 12 || digits.length === 13)
    ) {
        digits = digits.slice(2);
    }

    digits = digits.slice(0, 11);

    if (digits.length <= 2) {
        return digits ? `(${digits}` : "";
    }

    if (digits.length <= 7) {
        return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    }

    if (digits.length === 10) {
        return `(${digits.slice(0, 2)}) ${digits.slice(
            2,
            6
        )}-${digits.slice(6)}`;
    }

    return `(${digits.slice(0, 2)}) ${digits.slice(
        2,
        7
    )}-${digits.slice(7)}`;
}

function phoneIsValid(value: string): boolean {
    const digits = value.replace(/\D/g, "");
    return digits.length === 10 || digits.length === 11;
}

function LoyaltyStampRows({ goal, current }: { goal: number; current: number }) {
    const container = useRef<HTMLDivElement>(null);
    const [capacity, setCapacity] = useState(5);

    useEffect(() => {
        const element = container.current;
        if (!element) return;

        const measure = () => {
            const row = element.firstElementChild;
            const stamp = row?.firstElementChild;
            if (!(stamp instanceof HTMLElement) || !row || !element.clientWidth) return;
            const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
            setCapacity(Math.max(1, Math.floor((element.clientWidth + gap) / (stamp.offsetWidth + gap))));
        };

        const observer = new ResizeObserver(measure);
        measure();
        observer.observe(element);
        return () => observer.disconnect();
    }, []);

    const rowCount = Math.ceil(goal / capacity);
    const stampsPerRow = Math.floor(goal / rowCount);
    const extraStamps = goal % rowCount;

    return (
        <div ref={container} className="flex w-full min-w-0 flex-col gap-2 py-6" aria-hidden="true">
            {Array.from({ length: rowCount }, (_, rowIndex) => {
                const start = rowIndex * stampsPerRow + Math.min(rowIndex, extraStamps);
                const length = stampsPerRow + (rowIndex < extraStamps ? 1 : 0);

                return (
                    <div key={rowIndex} className="flex justify-center gap-2">
                        {Array.from({ length }, (_, index) => {
                            const position = start + index + 1;
                            const filled = position <= current;

                            return (
                                <div
                                    key={position}
                                    className={`flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                                        filled
                                            ? "scale-110 border-[var(--im-menu-action,#f14400)] bg-[var(--im-menu-action,#f14400)] text-white"
                                            : "border-[var(--im-menu-border,#e5e7eb)] text-[var(--im-menu-subtle,#e5e7eb)]"
                                    }`}
                                >
                                    <FontAwesomeIcon icon={faStar} className="text-xs" />
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
}

export default function HistoryModal({
    open,
    onClose,
    restaurantId,
    offer,
}: Props) {
    const {
        step,
        customer_phone,
        loyaltyBalance,
        program: loadedOffer,
        restaurantId: loadedRestaurantId,
        orders,
        loading,
        error,
        setPhone,
        fetchHistory,
        reset,
    } = useHistoryStore();

    const cartItems = useCartStore((state) => state.items);
    const addRewards = useCartStore(
        (state) => state.addRewards
    );

    const [toast, setToast] =
        useState<ToastState | null>(null);

    useEffect(() => {
        if (open) {
            setToast(null);
        }
    }, [open]);

    const rewardAlreadyInCart = useMemo(
        () => cartItems.some((item) => item.is_reward),
        [cartItems]
    );

    const handleFetch = async () => {
        await fetchHistory(restaurantId);
    };

    const program = loadedRestaurantId === restaurantId ? loadedOffer : offer;
    const visibleStep = loadedRestaurantId === restaurantId ? step : "input_phone";

    const handleRedeem = () => {
        if (!program || !canRedeem) return;

        if (rewardAlreadyInCart) {
            setToast({
                message:
                    "Uma recompensa já está na sua sacola.",
                type: "info",
            });
            return;
        }

        addRewards(program.rewards.map(reward => ({
            id: crypto.randomUUID(),
            base_item_id: reward.id,
            name: `(PRÊMIO) ${reward.name}`,
            total_cents: 0,
            qty: 1,
            image: reward.image,
            selectedSubitems: reward.complements,
            unit_price_cents: 0,
            is_reward: true,
        })));

        setToast({
            message:
                "Recompensa adicionada à sacola!",
            type: "success",
        });

        window.setTimeout(() => {
            onClose();
        }, 1200);
    };

    const goal = Math.max(
        1,
        Number(program?.goal_count) || 10
    );
    const current = Math.max(
        0,
        Number(loadedRestaurantId === restaurantId ? loyaltyBalance?.current_count : 0) || 0
    );
    const canRedeem =
        program?.active === true &&
        current >= goal &&
        visibleStep === "view_history" && program.rewards.length > 0;

    const renderProgress = () => {
        return (
            <div className="flex flex-col items-center">
                <LoyaltyStampRows goal={goal} current={current} />

                {canRedeem ? (
                    <div className="w-full animate-fadeUp">
                        <p className="mb-3 font-bold text-[var(--im-menu-success-text,#16a34a)]">
                            🎉 Meta atingida! Você ganhou um
                            prêmio.
                        </p>

                        <Button variant="primary" onClick={handleRedeem} className="w-full">
                            <FontAwesomeIcon icon={faTrophy} className="mr-2" />
                            Resgatar recompensa
                        </Button>

                        <p className="mt-2 text-[10px] text-[var(--im-menu-subtle,#9ca3af)]">
                            A recompensa será adicionada à sua sacola
                            gratuitamente.
                        </p>
                    </div>
                ) : (
                    <p className="mt-2 text-xs text-[var(--im-menu-subtle,#9ca3af)]">
                        Faltam{" "}
                        {Math.max(goal - current, 0)}{" "}
                        pedidos para sua recompensa.
                    </p>
                )}
            </div>
        );
    };

    return (
        <ModalMobile
            open={open}
            onClose={onClose}
            title={program ? "Peça e Ganhe com Fidelidade" : "Histórico"}
            height={0.85}
        >
            <div className="relative space-y-6 p-4">
                {toast && (
                    <div className="absolute left-0 right-0 top-0 z-50 flex justify-center">
                        <Toast
                            message={toast.message}
                            type={toast.type}
                            onClose={() =>
                                setToast(null)
                            }
                        />
                    </div>
                )}

                {program && (
                    <h2 className="text-[22px]/7 font-semibold text-[var(--im-menu-text,#111827)]">Peça e Ganhe com Fidelidade</h2>
                )}

                {program && (
                    <div className="space-y-3 rounded-xl border border-[var(--im-menu-border,#e5e7eb)] bg-[var(--im-menu-soft,#f9fafb)] p-4">
                        <h3 className="font-semibold">Como funciona</h3>
                        <p className="text-sm">
                            Ganhe 1 selo por pedido concluído{program.min_order_value_cents > 0
                                ? ` a partir de ${formatPrice(program.min_order_value_cents)}` : ""}.
                            {" "}Junte {goal} {goal === 1 ? "selo" : "selos"} e ganhe a recompensa completa.
                        </p>
                        <ul className="space-y-2">
                            {program.rewards.map(reward => (
                                <li key={reward.id} className="flex items-center gap-3 text-sm font-medium">
                                    {reward.image && <img src={reward.image} alt="" className="size-10 shrink-0 rounded-lg object-cover" />}
                                    {reward.name}{reward.complements.length > 0 ? " + Complementos" : ""}
                                </li>
                            ))}
                        </ul>
                    </div>
                )}

                {visibleStep === "input_phone" && (
                    <div className="space-y-4">
                        <p className="text-center font-medium text-[var(--im-menu-muted,#4b5563)]">
                            {program ? "Use seu WhatsApp para consultar seus selos." : "Digite seu WhatsApp para consultar seus pedidos."}
                        </p>

                        <Input
                            placeholder="(00) 00000-0000"
                            value={customer_phone}
                            onChange={(event) =>
                                setPhone(
                                    formatPhone(
                                        event.target.value
                                    )
                                )
                            }
                            onKeyDown={(event) => {
                                if (
                                    event.key === "Enter" &&
                                    phoneIsValid(
                                        customer_phone
                                    )
                                ) {
                                    event.preventDefault();
                                    void handleFetch();
                                }
                            }}
                            type="tel"
                            inputMode="tel"
                            autoComplete="tel"
                            maxLength={15}
                            className="text-center text-lg tracking-widest"
                        />

                        {error && (
                            <p className="text-center text-sm text-[var(--im-menu-error-text,#ef4444)]">
                                {error}
                            </p>
                        )}

                        <Button
                            onClick={handleFetch}
                            loading={loading}
                            disabled={
                                !phoneIsValid(
                                    customer_phone
                                )
                            }
                            className="mt-4 w-full"
                        >
                            {program ? "Consultar meus selos" : "Consultar pedidos"}
                        </Button>

                        <p className="px-4 text-center text-xs text-[var(--im-menu-subtle,#9ca3af)]">
                            O número é usado somente para
                            localizar seus pedidos e seu saldo
                            neste restaurante.
                        </p>
                    </div>
                )}

                {visibleStep === "view_history" && (
                    <div className="space-y-8 animate-fadeIn">
                        {program && (
                            <div className="rounded-xl border border-[var(--im-menu-border,#e5e7eb)] p-4 text-center">
                                <h3 className="font-semibold">Seus selos · {current}/{goal}</h3>
                                {renderProgress()}
                            </div>
                        )}

                        <div>
                            <h3 className="mb-3 ml-1 text-sm font-bold uppercase tracking-wider text-[var(--im-menu-subtle,#9ca3af)]">
                                Histórico recente
                            </h3>

                            {orders.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-[var(--im-menu-border,#e5e7eb)] bg-[var(--im-menu-soft,#f9fafb)] py-8 text-center">
                                    <p className="text-sm text-[var(--im-menu-subtle,#9ca3af)]">
                                        Nenhum pedido pontuado
                                        ainda.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map((order) => (
                                        <div
                                            key={order.id}
                                            className="flex items-center justify-between border-b border-[var(--im-menu-border,#f9fafb)] pb-3 last:border-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`h-2 w-2 rounded-full ${
                                                        order.loyalty_points_used >
                                                        0
                                                            ? "bg-blue-500"
                                                            : order.loyalty_credited
                                                              ? "bg-green-500"
                                                              : "bg-[var(--im-menu-raised,#d1d5db)]"
                                                    }`}
                                                />

                                                <div>
                                                    <p className="text-sm font-medium text-[var(--im-menu-text-soft,#1f2937)]">
                                                        Pedido #
                                                        {order.display_id ??
                                                            order.id.slice(0, 4)}
                                                    </p>
                                                    <p className="text-xs text-[var(--im-menu-subtle,#9ca3af)]">
                                                        {new Date(
                                                            order.created_at
                                                        ).toLocaleDateString(
                                                            "pt-BR"
                                                        )}
                                                    </p>
                                                </div>
                                            </div>

                                            {order.loyalty_points_used >
                                            0 ? (
                                                <span className="rounded-full bg-[var(--im-menu-info-bg,#dbeafe)] px-2 py-1 text-xs font-bold text-[var(--im-menu-info-text,#2563eb)]">
                                                    Trocou{" "}
                                                    {
                                                        order.loyalty_points_used
                                                    }{" "}
                                                    pts
                                                </span>
                                            ) : order.loyalty_credited ? (
                                                <span className="rounded-full bg-[var(--im-menu-accent-soft,#f144001a)] px-2 py-1 text-xs font-bold text-[var(--im-menu-link,#f14400)]">
                                                    +1 Selo
                                                </span>
                                            ) : (
                                                <span className="text-xs text-[var(--im-menu-subtle,#9ca3af)]">
                                                    Não pontuou
                                                </span>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <Button
                            variant="secondary"
                            onClick={reset}
                            className="w-full text-xs text-[var(--im-menu-subtle,#9ca3af)] hover:text-[var(--im-menu-muted,#4b5563)]"
                        >
                            Sair / Trocar número
                        </Button>
                    </div>
                )}
            </div>
        </ModalMobile>
    );
}
