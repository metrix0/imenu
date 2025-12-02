"use client";

import {use, useEffect, useRef, useState} from "react";
import { supabase } from "@/lib/supabaseClient";
import {FontAwesomeIcon} from "@fortawesome/react-fontawesome";

import {
    faCreditCard,faMoneyBill,faPersonBiking
} from "@fortawesome/free-solid-svg-icons";
import {faPix} from "@fortawesome/free-brands-svg-icons"

export default function PedidoPage({
                                       params,
                                   }: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { id } = use(params);

    const [status, setStatus] = useState<string>("pending_online_payment");
    const [order, setOrder] = useState<any>(null);
    const didRunClearOnce = useRef(false);


    // --------------------------------------------------------------------
    // 🔵 REALTIME LISTENER (unchanged)
    // --------------------------------------------------------------------
    useEffect(() => {
        const channel = supabase
            .channel(`orders-${id}`)
            .on(
                "postgres_changes",
                {
                    event: "*",
                    schema: "public",
                    table: "orders",
                    filter: `id=eq.${id}`,
                },
                (payload) => {
                    const next = payload.new;

                    if (next && typeof next === "object" && "status" in next) {
                        setStatus(next.status as string);
                    }

                    setOrder((prev: any) => ({ ...(prev ?? {}), ...(next ?? {}) }));
                }
            )
            .subscribe();

        // Load initial order
        fetch(`/api/orders/${id}`)
            .then((r) => r.json())
            .then((d) => {
                if (d && typeof d === "object" && "status" in d) {
                    setStatus(d.status);
                }
                setOrder(d);
            })
            .catch(() => {});

        // FIX: cleanup must NOT return a promise
        return () => {
            try {
                supabase.removeChannel(channel);
            } catch (_) {}
        };
    }, [id]);

    // --------------------------------------------------------------------
// 🧹 AUTO CLEAR CART AFTER PAYMENT OR CONFIRMATION
// --------------------------------------------------------------------
// --------------------------------------------------------------------
// 🧹 AUTO CLEAR CART + SET COOKIE WHEN ORDER ENTERS CONFIRMED STATES
// --------------------------------------------------------------------
// --------------------------------------------------------------------
// 🧹 AUTO CLEAR CART + SET COOKIE — RUN ONLY ONCE PER PAGE LOAD
// --------------------------------------------------------------------
    useEffect(() => {
        if (!status) return;

        const shouldClear =
            status === "paid" ||
            status === "pending_physical_payment" ||
            status === "preparing" ||
            status === "delivering" ||
            status === "done";

        // 👇 Only run ONCE per page load
        if (shouldClear && !didRunClearOnce.current) {
            didRunClearOnce.current = true;

            console.log(
                `%c[CART] One-time clear triggered (status = ${status})`,
                "color:red;font-weight:bold"
            );

            // CLEAR CART
            try {
                localStorage.removeItem("cart-storage");
            } catch (err) {
                console.error("[CART] Failed to clear cart-storage:", err);
            }

            // SET COOKIE to remember user visited this page
            try {
                document.cookie = `order_page_entered=${id}; path=/; max-age=${60 * 60 * 5}`;
            } catch (err) {
                console.error("[COOKIE] Failed to set order_page_entered cookie:", err);
            }
        }
    }, [status]);



    // --------------------------------------------------------------------
    // 🟢 NEW: POLLING EVERY 7 SECONDS (MINIMUM CHANGE)
    // --------------------------------------------------------------------
// 🔄 POLLING (every 7s)
// --------------------------------------------------------------------
// 🟢 SMART POLLING (with STOP for done/canceled)
// --------------------------------------------------------------------
    useEffect(() => {
        if (!status) return;

        // Decide polling frequency
        let intervalTime = 7000; // default: normal speed

        if (status === "preparing") {
            intervalTime = 13000;
        }

        if (status === "delivering") {
            intervalTime = 30000;
        }

        // 🚫 STOP polling completely for FINAL states
        if (status === "done" || status === "canceled") {
            console.log(
                `%c[Polling] Disabled (final state: ${status})`,
                "color:red;font-weight:bold"
            );
            return; // <-- STOP: no interval created
        }

        console.log(
            `%c[Polling] Status=${status} → interval=${intervalTime / 1000}s`,
            "color:#09f;font-weight:bold"
        );

        const interval = setInterval(() => {
            console.log(
                `%c[Polling] GET /api/orders/${id} @ ${new Date().toLocaleTimeString()}`,
                "color:#888"
            );

            fetch(`/api/orders/${id}`)
                .then((res) => res.json())
                .then((data) => {
                    console.log(
                        "%c[Polling] Response:",
                        "color:#0a0;font-weight:bold",
                        data
                    );

                    if (!data) return;

                    // Update status
                    if (data.status && data.status !== status) {
                        console.log(
                            `%c[Polling] Status changed → ${data.status}`,
                            "color:orange;font-weight:bold"
                        );
                        setStatus(data.status);
                    }

                    // Update full order
                    setOrder(data);
                })
                .catch((err) => {
                    console.error("[Polling] ERROR:", err);
                });
        }, intervalTime);

        return () => clearInterval(interval);
    }, [id, status]);

    if (!order) {
        return (
            <main className="p-4 animate-pulse">
                <div className="h-6 bg-gray-300 w-1/3 rounded"></div>
                <div className="h-4 bg-gray-200 w-1/2 mt-4 rounded"></div>
            </main>
        );
    }

    // -----------------------------
    // STATUS LABEL
    // -----------------------------
    const iconMap: Record<string, any> = {
        pix: faPix,
        cartao: faCreditCard,
        dinheiro: faMoneyBill,
        maquininha: faPersonBiking
    }

    const statusMap: Record<string, any> = {
        pending_online_payment: "Aguardando pagamento",
        pending_physical_payment: "Aguardando confirmação do restaurante",
        paid: <><b>Pagamento aprovado</b>, aguardando confirmação do restaurante</>,
        preparing: "Preparando pedido",
        delivering: "Pedido a caminho",
        done: "Pedido entregue, bom apetite!",
        canceled: "Pedido cancelado",
    };
    const readableStatus = statusMap[status] ?? status;

    // -----------------------------
    // ETA FORMAT
    // -----------------------------
    function formatEtaFromTimestamp(iso: string | null | undefined) {
        if (!iso) return "Calculando...";

        const center = new Date(iso);
        if (Number.isNaN(center.getTime())) return "Calculando...";

        const start = new Date(center.getTime() - 10 * 60_000);
        const end = new Date(center.getTime() + 10 * 60_000);

        const now = new Date();
        const isSameDay =
            start.getFullYear() === now.getFullYear() &&
            start.getMonth() === now.getMonth() &&
            start.getDate() === now.getDate();

        const label = isSameDay ? "Hoje" : "Amanhã";

        const fmt = (d: Date) =>
            d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        return `${label}, ${fmt(start)} - ${fmt(end)}`;
    }

    const eta = formatEtaFromTimestamp(order.delivery_eta);

    // -----------------------------
    // PAYMENT TEXT
    // -----------------------------
    const pm = order.payment_method ?? order.paymentMethod;
    const paymentIcon = iconMap[pm];
    const paymentText =
        pm === "pix"
            ? "Pix"
            : pm === "cartao"
                ? "Cartão"
                : pm === "dinheiro"
                    ? "Dinheiro"
                    : "Maquininha";

    const totalDisplay =
        typeof order.total_cents === "number"
            ? `R$ ${(order.total_cents / 100)
                .toFixed(2)
                .replace(".", ",")}`
            : "...";

    return (
        <main className="p-6 max-w-xl mx-auto">

            {/* ------- everything below is untouched ------- */}

            {/* ETA */}
            <section className="p-5">
                <h2 className="text-gray-500 text-lg">Previsão de entrega</h2>
                <p className="font-semibold text-text text-2xl mt-1">{eta}</p>
            </section>

            {status === "preparing" || "delivering" || "done"
                ?
                <div className="flex gap-2 w-[94%] ml-[3%] h-1 rounded-full overflow-hidden relative mt-2 mb-2">

                    {status === "preparing" ?
                    <div className="relative inset-0 bg-gray-200 overflow-hidden rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0">
                        <div  className="absolute inset-0 animate-[sweep_1.5s_linear_infinite] bg-gradient-to-r from-green/0 via-green to-green/0" />
                    </div>
                        :
                    <div className="relative inset-0 bg-green rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0">
                    </div>
                    }
                    {status === "done" ?
                        <div className="relative inset-0 bg-green overflow-hidden rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0">
                        </div>
                        :
                    <div className="relative inset-0 bg-gray-200 overflow-hidden rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0">
                        {status === "delivering" &&
                        <div  className="absolute inset-0 animate-[sweep_1.5s_linear_infinite] bg-gradient-to-r from-green/0 via-green to-green/0" />
                        }
                    </div>
                    }

                </div>
                :
                <div className="w-[94%] ml-[3%] h-1 bg-gray-200 rounded-full overflow-hidden relative mt-2 mb-2">
                <div
                className="absolute inset-0 animate-[sweep_1.5s_linear_infinite]
                    bg-gradient-to-r from-green/0 via-green to-green/0" />
                </div>
            }


            <section className="p-5 flex items-center gap-6">
                <div className="relative">
                    <div className="w-3 h-3 bg-green rounded-full" />

                    {/* halo */}
                    <div className="
      absolute inset-0 rounded-full
      bg-green
      opacity-40
      animate-[pulseHalo_2s_ease-out_infinite]
  "></div>
                </div>                <div>
                    <p className="font-medium text-[15px] leading-tight">{readableStatus}</p>
                </div>
            </section>

            {/* PAYMENT */}
            <section className="bg-white rounded-xl p-5 shadow space-y-3 mt-6">
                <p className="text-gray-500 text-sm">
                    {paymentText === "Pix" || paymentText === "Cartão"
                        ? "Pago pelo site"
                        : "Pagamento na entrega"}
                </p>

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <FontAwesomeIcon icon={paymentIcon}/>
                        <span className="font-medium">{paymentText}</span>
                    </div>

                    <span className="font-semibold text-lg">{totalDisplay}</span>
                </div>
            </section>

            {/* ORDER ITEMS */}
            <section className="bg-white rounded-xl p-5 shadow space-y-4 mt-6">
                <h3 className="font-semibold text-lg text-gray-700">
                    Itens do Pedido
                </h3>

                {(!order.items || order.items.length === 0) ? (
                    <p className="text-gray-400 text-sm">Carregando itens...</p>
                ) : (
                    order.items.map((it: any) => (
                        <div
                            key={it.id}
                            className="border-b last:border-b-0 pb-3 mb-3"
                        >
                            <div className="flex justify-between">
                                <p className="font-medium">
                                    {it.quantity}× {it.name}
                                </p>
                                <p className="font-semibold">
                                    R$ {(it.total_cents / 100)
                                    .toFixed(2)
                                    .replace(".", ",")}
                                </p>
                            </div>

                            {it.observation && (
                                <p className="text-sm text-gray-600 mt-1">
                                    <span className="font-medium">Obs:</span>{" "}
                                    {it.observation}
                                </p>
                            )}

                            {it.subitems?.length > 0 && (
                                <ul className="ml-4 mt-2 space-y-1">
                                    {it.subitems.map((sub: any) => (
                                        <li
                                            key={sub.id}
                                            className="text-sm text-gray-600 flex justify-between"
                                        >
                                            <span>- {sub.subitem_name}</span>
                                            <span>
                                                +R$
                                                {(sub.price_cents / 100)
                                                    .toFixed(2)
                                                    .replace(".", ",")}
                                            </span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))
                )}
            </section>

            <p className="text-center text-gray-400 text-sm mt-6">Pedido #{id}</p>
        </main>
    );
}
