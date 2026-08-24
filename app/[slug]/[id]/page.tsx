"use client";

import { use, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/database/supabaseClient";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { icons } from "@/lib/utils/fontawesome";
import { faPix, faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import { faChair } from "@fortawesome/free-solid-svg-icons";
import ListLoader from "@/components/ui/ListLoader";
import { formatPrice, promotionPrice } from "@/lib/utils/formatPrice";

export default function PedidoPage({
    params,
}: {
    params: Promise<{ slug: string; id: string }>;
}) {
    const { id } = use(params);
    const router = useRouter();
    const didRunClearOnce = useRef(false);

    const [status, setStatus] = useState<string>("pending_online_payment");
    const [order, setOrder] = useState<any>(null);
    const [restaurantName, setRestaurantName] = useState("");
    const [restaurantPhone, setRestaurantPhone] = useState("");
    const [restaurantLogo, setRestaurantLogo] = useState("");
    const [restaurantId, setRestaurantId] = useState<string | null>(null);
    const [copiedPix, setCopiedPix] = useState(false);

    useEffect(() => {
        if (id.length < 10) {
            router.push("/404");
            return;
        }

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
                    setOrder((previous: any) => ({ ...(previous ?? {}), ...(next ?? {}) }));
                }
            )
            .subscribe();

        (async () => {
            try {
                const orderResponse = await fetch(`/api/orders/${id}`);
                const orderData = await orderResponse.json();

                if (orderData && typeof orderData === "object" && "status" in orderData) {
                    setStatus(orderData.status);
                }
                setOrder(orderData);

                const currentRestaurantId =
                    orderData?.restaurant_id ||
                    orderData?.restaurantId ||
                    orderData?.restaurant_id_fk;

                setRestaurantId(currentRestaurantId);
                if (!currentRestaurantId) return;

                const restaurantResponse = await fetch(`/api/restaurants/${currentRestaurantId}`);
                const restaurantData = await restaurantResponse.json();
                if (restaurantData) {
                    setRestaurantName(restaurantData.name ?? "");
                    setRestaurantPhone(restaurantData.phone ?? "");
                    const logoPath = String(restaurantData.logo_url ?? "");
                    const logoUrl = /^https?:\/\//i.test(logoPath)
                        ? logoPath
                        : logoPath
                            ? supabase.storage.from("restaurant-logos").getPublicUrl(logoPath).data?.publicUrl ?? ""
                            : "";
                    setRestaurantLogo(logoUrl);
                }
            } catch (error) {
                console.error("Erro ao carregar pedido:", error);
            }
        })();

        return () => {
            try {
                supabase.removeChannel(channel);
            } catch {}
        };
    }, [id, router]);

    useEffect(() => {
        if (!restaurantId || restaurantPhone === null || !status) return;

        const shouldClear = [
            "paid",
            "pending_physical_payment",
            "preparing",
            "delivering",
            "done",
        ].includes(status);

        if (shouldClear && !didRunClearOnce.current) {
            didRunClearOnce.current = true;
            try {
                localStorage.removeItem("cart-storage");
            } catch (error) {
                console.error("[CART] Failed to clear cart-storage:", error);
            }

            try {
                document.cookie = `order_page_entered_id_${restaurantId}=${id}; path=/; max-age=${60 * 60 * 5}`;
            } catch (error) {
                console.error("[COOKIE] Failed to set order_page_entered cookie:", error);
            }
        }
    }, [id, restaurantId, restaurantPhone, status]);

    useEffect(() => {
        if (!status || status === "done" || status === "canceled") return;

        const intervalTime = status === "delivering" ? 30000 : status === "preparing" ? 13000 : 7000;
        const interval = window.setInterval(() => {
            fetch(`/api/orders/${id}/status`)
                .then((response) => response.json())
                .then((data) => {
                    if (data?.status && data.status !== status) {
                        setStatus(data.status);
                    }
                })
                .catch((error) => console.error("[Polling] ERROR:", error));
        }, intervalTime);

        return () => window.clearInterval(interval);
    }, [id, status]);

    if (!order) {
        return (
            <main className="p-6 max-w-xl mx-auto min-h-screen flex flex-col gap-8">
                <section className="p-5">
                    <ListLoader lines={1} />
                    <div className="mt-4 w-2/3"><ListLoader lines={1} /></div>
                </section>
                <section className="p-5 flex items-center gap-6">
                    <div className="flex-1"><ListLoader lines={1} /></div>
                </section>
                <section className="bg-white rounded-xl p-5 shadow space-y-3">
                    <ListLoader lines={1} />
                    <ListLoader lines={2} />
                </section>
                <section className="bg-white rounded-xl p-5 shadow space-y-4">
                    <ListLoader lines={1} />
                    <div className="space-y-4 mt-3">
                        <ListLoader lines={2} />
                        <ListLoader lines={2} />
                    </div>
                </section>
                <div className="mt-auto flex justify-center pt-8 pb-6">
                    <div className="w-[30%] h-6 bg-gray-200 rounded" />
                </div>
            </main>
        );
    }

    const isTableOrder = order.is_delivery === "mesa";
    const isPickup = isTableOrder || order.is_delivery === "retirada";
    const paymentMethod = order.payment_method ?? order.paymentMethod;

    const iconMap: Record<string, any> = {
        pix: faPix,
        "pix-entrega": faPix,
        cartao: icons.faCreditCard,
        dinheiro: icons.faMoneyBill,
        "trazer-maquininha": icons.faPersonBiking,
    };

    const statusMap: Record<string, any> = {
        pending_online_payment: "Aguardando pagamento",
        pending_physical_payment: "Aguardando confirmação do restaurante",
        paid: <><b>Pagamento aprovado</b>, aguardando confirmação do restaurante</>,
        preparing: "Preparando pedido",
        delivering: isTableOrder ? "Pedido pronto" : isPickup ? "Pedido pronto para retirada" : "Pedido a caminho",
        done: isTableOrder ? "Pedido concluído, bom apetite!" : isPickup ? "Pedido retirado, bom apetite!" : "Pedido entregue, bom apetite!",
        canceled: (
            <>
                Pedido cancelado pelo restaurante.
                {paymentMethod === "pix" && (
                    <><br />Seu dinheiro foi reembolsado.</>
                )}
            </>
        ),
    };

    const readableStatus = statusMap[status] ?? status;

    function formatEtaFromTimestamp(iso: string | null | undefined) {
        if (!iso) return "Calculando...";
        const center = new Date(iso);
        if (Number.isNaN(center.getTime())) return "Calculando...";

        const start = new Date(center.getTime() - 10 * 60_000);
        const end = new Date(center.getTime() + 10 * 60_000);
        const now = new Date();
        const isSameDay = (first: Date, second: Date) =>
            first.getFullYear() === second.getFullYear() &&
            first.getMonth() === second.getMonth() &&
            first.getDate() === second.getDate();

        let label: string;
        if (isSameDay(start, now)) {
            label = "Hoje";
        } else {
            const tomorrow = new Date(now);
            tomorrow.setDate(now.getDate() + 1);
            label = isSameDay(start, tomorrow)
                ? "Amanhã"
                : start.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
        }

        const formatTime = (date: Date) =>
            date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });

        return `${label}, ${formatTime(start)} - ${formatTime(end)}`;
    }

    function formatWhatsapp(value: string) {
        const digits = value.replace(/\D/g, "");
        const local = digits.startsWith("55") ? digits.slice(2) : digits;

        if (local.length === 11) {
            return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
        }
        if (local.length === 10) {
            return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
        }
        return value;
    }

    const eta = formatEtaFromTimestamp(order.delivery_eta);
    const paymentIcon = iconMap[paymentMethod];
    const paymentText =
        paymentMethod === "pix"
            ? "Pix"
            : paymentMethod === "pix-entrega"
                ? isPickup ? "Pix na retirada" : "Pix na entrega"
                : paymentMethod === "cartao"
                    ? "Cartão"
                    : paymentMethod === "dinheiro"
                        ? "Dinheiro"
                        : "Maquininha";

    const totalDisplay =
        typeof order.total_cents === "number"
            ? `R$ ${(order.total_cents / 100).toFixed(2).replace(".", ",")}`
            : "...";

    return (
        <main className="p-6 max-w-xl mx-auto min-h-screen flex flex-col">
            <section className="p-5">
                <h2 className="text-gray-500 text-lg 2xl:text-xl">
                    {isTableOrder ? "Mesa" : isPickup ? "Previsão de retirada" : "Previsão de entrega"}
                </h2>
                <p className="flex items-center gap-2 font-semibold text-text text-2xl 2xl:text-3xl 2xl:mt-3 mt-1">
                    {isTableOrder && <FontAwesomeIcon icon={faChair} className="text-brand" />}
                    {isTableOrder ? order.table_name_snapshot || "Mesa" : eta}
                </p>
            </section>

            {status === "canceled" ? (
                <div className="flex gap-2 w-[94%] ml-[3%] h-1 rounded-full overflow-hidden relative mt-2 mb-2">
                    <div className="relative inset-0 bg-red-500 rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0" />
                    <div className="relative inset-0 bg-red-500 rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0" />
                </div>
            ) : !status.includes("pending") && status !== "paid" ? (
                <div className="flex gap-2 w-[94%] ml-[3%] h-1 rounded-full overflow-hidden relative mt-2 mb-2">
                    {status === "preparing" ? (
                        <div className="relative inset-0 bg-gray-200 overflow-hidden rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0">
                            <div className="absolute inset-0 animate-[sweep_1.5s_linear_infinite] bg-gradient-to-r from-green/0 via-green to-green/0" />
                        </div>
                    ) : (
                        <div className="relative inset-0 bg-green rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0" />
                    )}
                    {status === "done" ? (
                        <div className="relative inset-0 bg-green overflow-hidden rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0" />
                    ) : (
                        <div className="relative inset-0 bg-gray-200 overflow-hidden rounded-full min-w-[25%] w-full max-w-[50%] border-white left-0">
                            {status === "delivering" && (
                                <div className="absolute inset-0 animate-[sweep_1.5s_linear_infinite] bg-gradient-to-r from-green/0 via-green to-green/0" />
                            )}
                        </div>
                    )}
                </div>
            ) : (
                <div className="w-[94%] ml-[3%] h-1 bg-gray-200 rounded-full overflow-hidden relative mt-2 mb-2">
                    <div className="absolute inset-0 animate-[sweep_1.5s_linear_infinite] bg-gradient-to-r from-green/0 via-green to-green/0" />
                </div>
            )}

            <section className="p-5 flex items-center gap-6">
                <div className="relative">
                    <div className={`w-3 h-3 rounded-full ${status === "canceled" ? "bg-red-500" : "bg-green"}`} />
                    <div className={`absolute inset-0 rounded-full opacity-40 animate-[pulseHalo_2s_ease-out_infinite] ${status === "canceled" ? "bg-red-500" : "bg-green"}`} />
                </div>
                <div>
                    <p className="font-medium text-[15px] 2xl:text-lg leading-tight">{readableStatus}</p>
                </div>
            </section>

            {paymentMethod === "pix" && status === "pending_online_payment" && (
                <section className="bg-white rounded-xl p-5 pb-7 shadow space-y-3 mt-3 mb-3">
                    <p className="font-semibold text-lg text-center">Pix</p>
                    {order?.pix_qr_base64 && (
                        <img
                            className="w-[50vw] md:w-64 mx-auto"
                            src={`data:image/png;base64,${order.pix_qr_base64}`}
                            alt="QR Code Pix"
                        />
                    )}
                    {order?.pix_copia_cola && (
                        <div
                            className="cursor-pointer"
                            onClick={async () => {
                                try {
                                    await navigator.clipboard.writeText(order.pix_copia_cola);
                                } catch {
                                    const element = document.createElement("textarea");
                                    element.value = order.pix_copia_cola;
                                    document.body.appendChild(element);
                                    element.select();
                                    document.execCommand("copy");
                                    document.body.removeChild(element);
                                }
                                setCopiedPix(true);
                                window.setTimeout(() => setCopiedPix(false), 1200);
                            }}
                        >
                            <p className="text-gray-500 text-sm mb-3 mt-4">
                                Copia e cola <FontAwesomeIcon icon={icons.faCopy} />
                            </p>
                            <div className="relative">
                                <textarea
                                    className="w-full p-3 rounded text-sm border-gray-200 border overflow-hidden focus:outline-none focus:ring-0"
                                    readOnly
                                    value={order.pix_copia_cola}
                                />
                                {copiedPix && (
                                    <div className="absolute inset-0 flex items-center justify-center rounded bg-black/10">
                                        <span className="text-sm font-semibold text-gray-700 bg-white px-3 py-1 rounded">Copiado</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </section>
            )}

            {!isTableOrder && <section className="bg-white rounded-xl p-5 shadow space-y-3 mt-5">
                <p className="text-gray-500 text-sm 2xl:text-lg">
                    {paymentMethod === "pix" || paymentMethod === "cartao"
                        ? "Pago pelo site"
                        : isPickup ? "Pagamento na retirada" : "Pagamento na entrega"}
                </p>
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 2xl:text-lg">
                        <FontAwesomeIcon icon={paymentIcon} />
                        <span className="font-medium">{paymentText}</span>
                    </div>
                    <span className="font-semibold text-lg 2xl:text-lg">{totalDisplay}</span>
                </div>
            </section>}

            <section className="bg-white rounded-xl p-5 shadow space-y-4 mt-6">
                <h3 className="font-semibold text-lg text-gray-700">
                    Itens do Pedido <span className="text-sm font-normal text-gray-500 2xl:text-lg">{restaurantName}</span>
                </h3>
                {!order.items || order.items.length === 0 ? (
                    <p className="text-gray-400 text-sm 2xl:text-lg">Carregando itens...</p>
                ) : (
                    order.items.map((item: any) => (
                        <div key={item.id} className="pb-3 mb-3">
                            <div className="flex justify-between 2xl:text-lg">
                                <p className="font-medium">{item.quantity}× {item.name}</p>
                                <p className="font-semibold">{formatPrice(promotionPrice(item) || item.total_cents)}</p>
                            </div>
                            {item.observation && (
                                <p className="text-sm 2xl:text-lg text-gray-600 mt-1">
                                    <span className="font-medium">Obs:</span> {item.observation}
                                </p>
                            )}
                            {item.subitems?.length > 0 && (
                                <ul className="ml-4 mt-2 space-y-1">
                                    {item.subitems.map((subitem: any) => (
                                        <li key={subitem.id} className="text-sm text-gray-600 flex justify-between">
                                            <span>- {subitem.subitem_name}</span>
                                            <span>+R$ {(subitem.price_cents / 100).toFixed(2).replace(".", ",")}</span>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    ))
                )}
                {isTableOrder && (
                    <div className="flex items-center justify-between border-t border-gray-200 pt-4 text-lg font-semibold">
                        <span>Total</span>
                        <span>{totalDisplay}</span>
                    </div>
                )}
            </section>

            {restaurantPhone && (
                <div className="mt-6 mb-3 mx-1 flex justify-center">
                    <a
                        href={`https://wa.me/${restaurantPhone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`Abrir WhatsApp da loja no número ${formatWhatsapp(restaurantPhone)}`}
                        className="inline-flex items-center gap-3 rounded-full border border-gray-200 bg-gray-50 py-1.5 pl-4 pr-1.5 text-sm font-medium text-gray-700 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700 2xl:text-lg"
                    >
                        <FontAwesomeIcon icon={faWhatsapp} className="text-lg text-green-600 2xl:text-xl" />
                        <span>{formatWhatsapp(restaurantPhone)}</span>
                        {restaurantLogo && (
                            <img
                                src={restaurantLogo}
                                alt=""
                                className="h-10 w-10 rounded-full border border-gray-200 bg-white object-cover 2xl:h-12 2xl:w-12"
                            />
                        )}
                    </a>
                </div>
            )}

            <div className="mt-auto flex justify-center pt-8 pb-6">
                <button
                    type="button"
                    onClick={() => router.push("/")}
                    aria-label="Conhecer o iMenu"
                    className="inline-flex cursor-pointer items-center gap-2 text-xs text-gray-400 transition hover:opacity-70 2xl:text-base"
                >
                    <span>Criado com</span>
                    <img
                        src="/logos/CombinationMarkLogo_Black.png"
                        alt="iMenu"
                        className="h-5 w-auto opacity-35 2xl:h-7"
                    />
                </button>
            </div>
        </main>
    );
}
