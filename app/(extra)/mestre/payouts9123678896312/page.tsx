"use client";

import { useEffect, useMemo, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
    faCheck,
    faCopy,
    faLink,
    faLock,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import Loader from "@/components/ui/Loader";
import { supabase } from "@/lib/database/supabaseClient";

type RestaurantFinancial = {
    id: string;
    name: string;
    phone: string | null;
    payment_info: string | null;
    total_paid_cents: number;
    total_payouts_cents: number;
    value_to_pay_cents: number;
    overdue_to_pay_cents: number;
};

const ROW_VISIBILITY_STORAGE_KEY =
    "imenu:mestre-payouts:rows-visible-until";
const ROW_VISIBILITY_DURATION_MS = 24 * 60 * 60 * 1000;

const getOverdueCutoff = (now = new Date()) => {
    const sundayAtTwoPm = new Date(now);
    sundayAtTwoPm.setHours(14, 0, 0, 0);

    if (now.getDay() !== 0) {
        sundayAtTwoPm.setDate(sundayAtTwoPm.getDate() - now.getDay());
    }

    sundayAtTwoPm.setDate(sundayAtTwoPm.getDate() - 7);
    return sundayAtTwoPm;
};

const formatDateTime = (date: Date) =>
    date.toLocaleString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    });

const formatMoney = (cents: number) =>
    (cents / 100).toLocaleString("pt-BR", {
        style: "currency",
        currency: "BRL",
    });

const getWhatsAppNumber = (phone: string | null) => {
    let digits = String(phone ?? "").replace(/\D/g, "");

    digits = digits.replace(/^0+/, "");

    if (digits.length === 10 || digits.length === 11) {
        digits = `55${digits}`;
    }

    return digits.length === 12 || digits.length === 13 ? digits : null;
};

const getWhatsAppPayoutUrl = (restaurant: RestaurantFinancial) => {
    const phone = getWhatsAppNumber(restaurant.phone);
    if (!phone) return null;

    const message = `✅ Repasse iMenu Realizado - ${restaurant.name}: ${formatMoney(
        restaurant.value_to_pay_cents
    )}`;

    return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
};

export default function AdminPayoutsPage() {
    const [restaurants, setRestaurants] = useState<RestaurantFinancial[]>([]);
    const [loading, setLoading] = useState(true);
    const [payingIds, setPayingIds] = useState<Set<string>>(new Set());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    const [copiedPixId, setCopiedPixId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const [rowsVisibleUntil, setRowsVisibleUntil] = useState<number | null>(null);

    const fetchData = async (showLoader = true) => {
        if (showLoader) setLoading(true);
        setErrorMessage(null);

        try {
            const response = await fetch("/api/mestre/payouts");

            if (!response.ok) {
                throw new Error("Não foi possível carregar os restaurantes.");
            }

            const restData = await response.json();

            if (!Array.isArray(restData)) {
                throw new Error("Resposta inválida ao carregar os restaurantes.");
            }

            const overdueCutoff = getOverdueCutoff();

            const results = await Promise.all(
                restData.map(async (restaurant: any) => {
                    const [ordersResult, payoutsResult] = await Promise.all([
                        supabase
                            .from("orders")
                            .select("total_cents, payment_method, created_at")
                            .eq("restaurant_id", restaurant.id)
                            .neq("status", "pending_online_payment")
                            .neq("status", "canceled")
                            .in("payment_method", ["cartao", "pix"]),
                        supabase
                            .from("payouts")
                            .select("amount_cents")
                            .eq("restaurant_id", restaurant.id),
                    ]);

                    if (ordersResult.error) throw ordersResult.error;
                    if (payoutsResult.error) throw payoutsResult.error;

                    const totalPaid =
                        ordersResult.data?.reduce((total, order: any) => {
                            let value = Number(order.total_cents) || 0;

                            if (order.payment_method === "cartao") {
                                value = Math.round(value * 0.97);
                            }

                            if (order.payment_method === "pix") {
                                value = Math.round(value * 0.99);
                            }

                            return total + value;
                        }, 0) || 0;

                    const totalPayouts =
                        payoutsResult.data?.reduce(
                            (total, payout) =>
                                total + (Number(payout.amount_cents) || 0),
                            0
                        ) || 0;

                    const totalPaidBeforeCutoff =
                        ordersResult.data?.reduce((total, order: any) => {
                            const createdAt = new Date(order.created_at).getTime();

                            if (
                                !Number.isFinite(createdAt) ||
                                createdAt >= overdueCutoff.getTime()
                            ) {
                                return total;
                            }

                            let value = Number(order.total_cents) || 0;

                            if (order.payment_method === "cartao") {
                                value = Math.round(value * 0.97);
                            }

                            if (order.payment_method === "pix") {
                                value = Math.round(value * 0.99);
                            }

                            return total + value;
                        }, 0) || 0;

                    return {
                        id: String(restaurant.id),
                        name: String(restaurant.name || "Restaurante"),
                        phone: restaurant.phone
                            ? String(restaurant.phone)
                            : null,
                        payment_info: restaurant.payment_info
                            ? String(restaurant.payment_info)
                            : null,
                        total_paid_cents: totalPaid,
                        total_payouts_cents: totalPayouts,
                        value_to_pay_cents: totalPaid - totalPayouts,
                        overdue_to_pay_cents: Math.max(
                            0,
                            totalPaidBeforeCutoff - totalPayouts
                        ),
                    } satisfies RestaurantFinancial;
                })
            );

            setRestaurants(results);
            setSelectedIds((current) => {
                const payableIds = new Set(
                    results
                        .filter((restaurant) => restaurant.value_to_pay_cents > 0)
                        .map((restaurant) => restaurant.id)
                );

                return new Set(
                    [...current].filter((restaurantId) =>
                        payableIds.has(restaurantId)
                    )
                );
            });
        } catch (error) {
            console.error("Erro ao carregar pagamentos:", error);
            setErrorMessage(
                error instanceof Error
                    ? error.message
                    : "Não foi possível carregar os pagamentos."
            );
        } finally {
            if (showLoader) setLoading(false);
        }
    };

    useEffect(() => {
        void fetchData();

        try {
            const storedVisibleUntil = Number(
                window.localStorage.getItem(ROW_VISIBILITY_STORAGE_KEY)
            );

            if (
                Number.isFinite(storedVisibleUntil) &&
                storedVisibleUntil > Date.now()
            ) {
                setRowsVisibleUntil(storedVisibleUntil);
            } else {
                window.localStorage.removeItem(ROW_VISIBILITY_STORAGE_KEY);
            }
        } catch (error) {
            console.error("Erro ao carregar confirmação do total:", error);
        }
    }, []);

    useEffect(() => {
        if (rowsVisibleUntil === null) return;

        const remainingTime = rowsVisibleUntil - Date.now();

        if (remainingTime <= 0) {
            setRowsVisibleUntil(null);
            setSelectedIds(new Set());

            try {
                window.localStorage.removeItem(ROW_VISIBILITY_STORAGE_KEY);
            } catch (error) {
                console.error("Erro ao limpar confirmação do total:", error);
            }

            return;
        }

        const timer = window.setTimeout(() => {
            setRowsVisibleUntil(null);
            setSelectedIds(new Set());

            try {
                window.localStorage.removeItem(ROW_VISIBILITY_STORAGE_KEY);
            } catch (error) {
                console.error("Erro ao limpar confirmação do total:", error);
            }
        }, remainingTime);

        return () => window.clearTimeout(timer);
    }, [rowsVisibleUntil]);

    const rowsVisible = rowsVisibleUntil !== null;

    const payableRestaurants = useMemo(
        () =>
            restaurants.filter(
                (restaurant) => restaurant.value_to_pay_cents > 0
            ),
        [restaurants]
    );

    const selectedRestaurants = useMemo(
        () =>
            payableRestaurants.filter((restaurant) =>
                selectedIds.has(restaurant.id)
            ),
        [payableRestaurants, selectedIds]
    );

    const totalToPayAll = payableRestaurants.reduce(
        (total, restaurant) => total + restaurant.value_to_pay_cents,
        0
    );

    const totalSelected = selectedRestaurants.reduce(
        (total, restaurant) => total + restaurant.value_to_pay_cents,
        0
    );

    const overdueCutoff = getOverdueCutoff();
    const totalOverdue = payableRestaurants.reduce(
        (total, restaurant) => total + restaurant.overdue_to_pay_cents,
        0
    );

    const allPayableSelected =
        payableRestaurants.length > 0 &&
        payableRestaurants.every((restaurant) => selectedIds.has(restaurant.id));

    const toggleRestaurant = (restaurantId: string) => {
        setSelectedIds((current) => {
            const next = new Set(current);

            if (next.has(restaurantId)) {
                next.delete(restaurantId);
            } else {
                next.add(restaurantId);
            }

            return next;
        });
    };

    const toggleAllPayable = () => {
        setSelectedIds(
            allPayableSelected
                ? new Set()
                : new Set(payableRestaurants.map((restaurant) => restaurant.id))
        );
    };

    const confirmTotal = () => {
        const visibleUntil = Date.now() + ROW_VISIBILITY_DURATION_MS;

        try {
            window.localStorage.setItem(
                ROW_VISIBILITY_STORAGE_KEY,
                String(visibleUntil)
            );
        } catch (error) {
            console.error("Erro ao salvar confirmação do total:", error);
        }

        setRowsVisibleUntil(visibleUntil);
    };

    const createPayouts = async (items: RestaurantFinancial[]) => {
        const payableItems = items.filter(
            (restaurant) => restaurant.value_to_pay_cents > 0
        );

        if (payableItems.length === 0) return;

        const ids = payableItems.map((restaurant) => restaurant.id);
        setPayingIds(new Set(ids));
        setErrorMessage(null);

        const createdAt = new Date().toISOString();
        const { error } = await supabase.from("payouts").insert(
            payableItems.map((restaurant) => ({
                restaurant_id: restaurant.id,
                amount_cents: restaurant.value_to_pay_cents,
                created_at: createdAt,
            }))
        );

        if (error) {
            console.error("Erro ao criar repasses:", error);
            setErrorMessage("Não foi possível registrar o pagamento.");
            setPayingIds(new Set());
            return;
        }

        setSelectedIds((current) => {
            const next = new Set(current);
            ids.forEach((id) => next.delete(id));
            return next;
        });

        await fetchData(false);
        setPayingIds(new Set());
    };

    const copyPix = async (restaurant: RestaurantFinancial) => {
        if (!restaurant.payment_info) return;

        try {
            await navigator.clipboard.writeText(restaurant.payment_info);
            setCopiedPixId(restaurant.id);
            window.setTimeout(() => {
                setCopiedPixId((current) =>
                    current === restaurant.id ? null : current
                );
            }, 1800);
        } catch (error) {
            console.error("Erro ao copiar PIX:", error);
            setErrorMessage("Não foi possível copiar a chave PIX.");
        }
    };

    if (loading) {
        return (
            <div className="flex h-64 items-center justify-center">
                <Loader />
            </div>
        );
    }

    return (
        <div className="mx-auto max-w-7xl px-6 py-10">
            <div className="mb-8 flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div>
                    <h1 className="text-3xl font-bold">Controle de Pagamentos</h1>
                    <p className="mt-2 text-sm text-gray-500">
                        Selecione os restaurantes para registrar vários repasses
                        de uma vez.
                    </p>
                </div>

                {rowsVisible && (
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 shadow-sm">
                            <input
                                type="checkbox"
                                checked={allPayableSelected}
                                onChange={toggleAllPayable}
                                disabled={payableRestaurants.length === 0}
                                className="h-4 w-4 cursor-pointer accent-green-600 disabled:cursor-not-allowed"
                            />
                            Selecionar todos
                        </label>

                        <Button
                            onClick={() =>
                                void createPayouts(selectedRestaurants)
                            }
                            disabled={
                                selectedRestaurants.length === 0 ||
                                payingIds.size > 0
                            }
                            loading={payingIds.size > 1}
                            className="min-w-52 bg-green-600 text-white hover:opacity-90 disabled:opacity-40"
                        >
                            Pagar selecionados ({selectedRestaurants.length}) —{" "}
                            {formatMoney(totalSelected)}
                        </Button>
                    </div>
                )}
            </div>

            <div className="mb-8 text-center text-2xl font-bold text-red-600">
                <FontAwesomeIcon icon={faLock} /> ANALISAR PAGAMENTOS CANCELADOS
                ANTES E DELETAR OS PEDIDOS.
            </div>

            {errorMessage && (
                <div className="mb-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                    {errorMessage}
                </div>
            )}

            <div className="mb-6">
                <div className="flex flex-col gap-4 rounded-xl border border-green-200 bg-green-50 p-6 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-center sm:text-left">
                        <p className="text-sm text-gray-500">
                            TOTAL A PAGAR (GERAL)
                        </p>
                        <p className="text-3xl font-bold text-green-700">
                            {formatMoney(totalToPayAll)}
                        </p>
                    </div>

                    <Button
                        onClick={confirmTotal}
                        disabled={rowsVisible}
                        className="shrink-0 bg-green-600 text-white hover:opacity-90 disabled:opacity-60"
                    >
                        {rowsVisible && (
                            <FontAwesomeIcon icon={faCheck} className="mr-2" />
                        )}
                        O total condiz
                    </Button>
                </div>

                {totalOverdue > 0 && (
                    <div className="mt-3 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                        ⚠️ Há {formatMoney(totalOverdue)} pendente de pedidos
                        anteriores ao corte de {formatDateTime(overdueCutoff)}.
                    </div>
                )}
            </div>

            {rowsVisible && (
                <div className="grid gap-6">
                    {[...restaurants]
                        .sort(
                            (first, second) =>
                                second.value_to_pay_cents -
                                first.value_to_pay_cents
                        )
                        .map((restaurant) => {
                            const canPay = restaurant.value_to_pay_cents > 0;
                            const isPaying = payingIds.has(restaurant.id);
                            const whatsappUrl =
                                getWhatsAppPayoutUrl(restaurant);

                            return (
                                <div
                                    key={restaurant.id}
                                    className={`flex flex-col gap-4 rounded-xl border bg-white p-6 shadow transition-colors ${
                                        selectedIds.has(restaurant.id)
                                            ? "border-green-400 ring-2 ring-green-100"
                                            : "border-gray-200"
                                    }`}
                                >
                                    <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="flex min-w-0 items-start gap-4">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.has(
                                                    restaurant.id
                                                )}
                                                onChange={() =>
                                                    toggleRestaurant(
                                                        restaurant.id
                                                    )
                                                }
                                                disabled={
                                                    !canPay || payingIds.size > 0
                                                }
                                                aria-label={`Selecionar ${restaurant.name}`}
                                                className="mt-1 h-5 w-5 shrink-0 cursor-pointer accent-green-600 disabled:cursor-not-allowed disabled:opacity-40"
                                            />

                                            <div className="min-w-0">
                                                <h2 className="text-xl font-bold">
                                                    {restaurant.name}
                                                </h2>
                                                <p className="text-sm text-gray-500">
                                                    📞 {restaurant.phone || "Sem telefone"}
                                                </p>

                                                <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-gray-500">
                                                    <span className="break-all">
                                                        💳 PIX:{" "}
                                                        {restaurant.payment_info ||
                                                            "Não cadastrado"}
                                                    </span>
                                                    <button
                                                        type="button"
                                                        onClick={() =>
                                                            void copyPix(
                                                                restaurant
                                                            )
                                                        }
                                                        disabled={
                                                            !restaurant.payment_info
                                                        }
                                                        className="inline-flex cursor-pointer items-center gap-1 rounded-md border border-gray-200 bg-gray-50 px-2 py-1 text-xs font-medium text-gray-700 transition-colors hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-40"
                                                        title="Copiar chave PIX"
                                                    >
                                                        <FontAwesomeIcon
                                                            icon={
                                                                copiedPixId ===
                                                                restaurant.id
                                                                    ? faCheck
                                                                    : faCopy
                                                            }
                                                        />
                                                        {copiedPixId ===
                                                        restaurant.id
                                                            ? "Copiado"
                                                            : "Copiar PIX"}
                                                    </button>
                                                </div>

                                                <p className="mt-1 break-all text-sm text-gray-500">
                                                    {restaurant.id}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex shrink-0 items-center gap-2 self-end lg:self-start">
                                            <Button
                                                onClick={() =>
                                                    void createPayouts([
                                                        restaurant,
                                                    ])
                                                }
                                                disabled={
                                                    !canPay || payingIds.size > 0
                                                }
                                                loading={isPaying}
                                                className="bg-green-600 text-white hover:opacity-90 disabled:opacity-40"
                                            >
                                                Pagar
                                            </Button>

                                            {whatsappUrl ? (
                                                <a
                                                    href={whatsappUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    aria-label={`Enviar comprovante de repasse para ${restaurant.name} pelo WhatsApp`}
                                                    title="Abrir mensagem de repasse no WhatsApp"
                                                    className="inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-md bg-gray-100 text-gray-800 transition-colors hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faLink}
                                                    />
                                                </a>
                                            ) : (
                                                <button
                                                    type="button"
                                                    disabled
                                                    title="Telefone inválido ou não cadastrado"
                                                    className="inline-flex h-10 w-10 cursor-not-allowed items-center justify-center rounded-md bg-gray-100 text-gray-400 opacity-50"
                                                >
                                                    <FontAwesomeIcon
                                                        icon={faLink}
                                                    />
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div>
                                            <p className="text-sm text-gray-500">
                                                Total Já Pago ao Restaurante
                                            </p>
                                            <p className="text-lg font-bold">
                                                {formatMoney(
                                                    restaurant.total_payouts_cents
                                                )}
                                            </p>
                                        </div>

                                        <div>
                                            <p className="text-sm text-gray-500">
                                                Valor a Pagar Agora
                                            </p>
                                            <p className="text-lg font-bold text-green-600">
                                                {formatMoney(
                                                    restaurant.value_to_pay_cents
                                                )}
                                            </p>
                                        </div>
                                    </div>

                                    {restaurant.overdue_to_pay_cents > 0 && (
                                        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                                            ⚠️ {formatMoney(
                                                restaurant.overdue_to_pay_cents
                                            )} deste saldo vem de pedidos anteriores
                                            ao corte de {formatDateTime(
                                                overdueCutoff
                                            )}.
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
