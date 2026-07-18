"use client";

import { useEffect, useMemo, useState } from "react";
import {
    faGift,
    faStar,
    faTrophy,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";

import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import ModalMobile from "@/components/ui/HybridModal";
import Toast from "@/components/ui/Toast";
import { useCartStore } from "@/lib/stores/costumer/cartStore";
import { useHistoryStore } from "@/lib/stores/costumer/historyStore";

type Props = {
    open: boolean;
    onClose: () => void;
    restaurantId: string;
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

export default function HistoryModal({
    open,
    onClose,
    restaurantId,
}: Props) {
    const {
        step,
        customer_phone,
        loyaltyBalance,
        program,
        orders,
        loading,
        error,
        setPhone,
        fetchHistory,
        reset,
    } = useHistoryStore();

    const cartItems = useCartStore((state) => state.items);
    const addToCart = useCartStore(
        (state) => state.addItem
    );

    const [toast, setToast] =
        useState<ToastState | null>(null);

    useEffect(() => {
        if (open) {
            reset();
            setToast(null);
        }
    }, [open, reset]);

    const rewardAlreadyInCart = useMemo(
        () => cartItems.some((item) => item.is_reward),
        [cartItems]
    );

    const handleFetch = async () => {
        await fetchHistory(restaurantId);
    };

    const handleRedeem = () => {
        if (
            !program?.active ||
            !program.reward_item_id
        ) {
            setToast({
                message:
                    "A recompensa ainda não está configurada.",
                type: "error",
            });
            return;
        }

        if (rewardAlreadyInCart) {
            setToast({
                message:
                    "Uma recompensa já está na sua sacola.",
                type: "info",
            });
            return;
        }

        const expandedSubitems = Array.isArray(
            (program as any).expanded_reward_subitems
        )
            ? (program as any).expanded_reward_subitems
            : [];

        const selectedSubitems = expandedSubitems.map(
            (subitem: any) => ({
                subcategoryId: subitem.subcategory_id,
                subcategoryName:
                    subitem.subcategory_name,
                subitemId: subitem.subitem_id,
                subitemName: subitem.subitem_name,
                price_cents: 0,
            })
        );

        addToCart({
            id: crypto.randomUUID(),
            base_item_id: program.reward_item_id,
            name: `(PRÊMIO) ${
                (program as any).reward_item_name ||
                program.reward_description ||
                "Recompensa"
            }`,
            total_cents: 0,
            qty: 1,
            image:
                (program as any).reward_item_image ||
                null,
            selectedSubitems,
            unit_price_cents: 0,
            is_reward: true,
        });

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
        Number(loyaltyBalance?.current_count) || 0
    );
    const canRedeem =
        program?.active === true &&
        current >= goal &&
        Boolean(program.reward_item_id);

    const renderProgress = () => {
        return (
            <div className="flex flex-col items-center">
                <div className="flex flex-wrap gap-2 justify-center py-6">
                    {Array.from(
                        { length: goal },
                        (_, index) => {
                            const position = index + 1;
                            const filled =
                                position <= current;

                            return (
                                <div
                                    key={position}
                                    className={`flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300 ${
                                        filled
                                            ? "scale-110 border-brand bg-brand text-white"
                                            : "border-gray-200 text-gray-200"
                                    }`}
                                >
                                    <FontAwesomeIcon
                                        icon={faStar}
                                        className="text-xs"
                                    />
                                </div>
                            );
                        }
                    )}
                </div>

                {canRedeem ? (
                    <div className="w-full animate-fadeUp">
                        <p className="mb-3 font-bold text-green-600">
                            🎉 Meta atingida! Você ganhou um
                            prêmio.
                        </p>

                        <Button
                            variant="primary"
                            onClick={handleRedeem}
                            className="w-full shadow-lg shadow-brand/20"
                        >
                            <FontAwesomeIcon
                                icon={faTrophy}
                                className="mr-2"
                            />
                            RESGATAR AGORA
                        </Button>

                        <p className="mt-2 text-[10px] text-gray-400">
                            O item será adicionado à sua sacola
                            gratuitamente.
                        </p>
                    </div>
                ) : (
                    <p className="mt-2 text-xs text-gray-400">
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
            title="Fidelidade"
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

                {step === "input_phone" && (
                    <div className="space-y-4 pt-10">
                        <div className="mb-4 flex justify-center">
                            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-2xl text-brand">
                                <FontAwesomeIcon
                                    icon={faGift}
                                />
                            </div>
                        </div>

                        <p className="text-center font-medium text-gray-600">
                            Digite seu WhatsApp para consultar
                            seus selos e pedidos.
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
                            <p className="text-center text-sm text-red-500">
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
                            Acessar fidelidade
                        </Button>

                        <p className="px-4 text-center text-xs text-gray-400">
                            O número é usado somente para
                            localizar seus pedidos e seu saldo
                            neste restaurante.
                        </p>
                    </div>
                )}

                {step === "view_history" && (
                    <div className="space-y-8 animate-fadeIn">
                        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white p-6 text-center shadow-sm">
                            <div className="absolute left-0 top-0 h-1 w-full bg-gradient-to-r from-brand/50 to-brand" />

                            <h3 className="mb-1 text-xl font-bold text-gray-900">
                                {program?.reward_description ||
                                    "Programa de Fidelidade"}
                            </h3>

                            {program?.active ? (
                                <>
                                    <p className="mb-2 text-sm text-gray-500">
                                        Complete a cartela para
                                        ganhar.
                                    </p>
                                    {renderProgress()}
                                </>
                            ) : (
                                <p className="py-4 text-sm text-gray-500">
                                    Este restaurante não possui
                                    programa ativo no momento.
                                </p>
                            )}
                        </div>

                        <div>
                            <h3 className="mb-3 ml-1 text-sm font-bold uppercase tracking-wider text-gray-400">
                                Histórico recente
                            </h3>

                            {orders.length === 0 ? (
                                <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50 py-8 text-center">
                                    <p className="text-sm text-gray-400">
                                        Nenhum pedido pontuado
                                        ainda.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {orders.map((order) => (
                                        <div
                                            key={order.id}
                                            className="flex items-center justify-between border-b border-gray-50 pb-3 last:border-0"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className={`h-2 w-2 rounded-full ${
                                                        order.loyalty_points_used >
                                                        0
                                                            ? "bg-blue-500"
                                                            : order.loyalty_credited
                                                              ? "bg-green-500"
                                                              : "bg-gray-300"
                                                    }`}
                                                />

                                                <div>
                                                    <p className="text-sm font-medium text-gray-800">
                                                        Pedido #
                                                        {
                                                            order.display_id
                                                        }
                                                    </p>
                                                    <p className="text-xs text-gray-400">
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
                                                <span className="rounded-full bg-blue-100 px-2 py-1 text-xs font-bold text-blue-600">
                                                    Trocou{" "}
                                                    {
                                                        order.loyalty_points_used
                                                    }{" "}
                                                    pts
                                                </span>
                                            ) : order.loyalty_credited ? (
                                                <span className="rounded-full bg-brand/10 px-2 py-1 text-xs font-bold text-brand">
                                                    +1 Selo
                                                </span>
                                            ) : (
                                                <span className="text-xs text-gray-400">
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
                            className="w-full text-xs text-gray-400 hover:text-gray-600"
                        >
                            Sair / Trocar número
                        </Button>
                    </div>
                )}
            </div>
        </ModalMobile>
    );
}
