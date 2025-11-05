"use client";

import { useTransition, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

interface OrderItem {
    id: string;
    order_id: string;
    name: string;
    quantity: number;
    price_cents: number;
}

interface OrderItemSubitem {
    id: string;
    order_item_id: string;
    subitem_id?: string | null;
    name: string;
    price_cents: number;
    quantity: number;
    created_at: string;
}

interface Order {
    id: string;
    customer_name: string;
    customer_address?: string;
    created_at: string;
    delivery_cents: number;
    total_cents: number;
    status: string;
}

export default function PanelClient({
    menuName,
    orders = [],
    orderItems = [],
    orderItemSubitems = [], // novo prop
}: {
    menuName: string;
    orders: Order[];
    orderItems: OrderItem[];
    orderItemSubitems: OrderItemSubitem[]; // novo prop
}) {
    const [isPending, startTransition] = useTransition();
    const [formatted, setFormatted] = useState<Record<string, string>>({});

    // Estados do filtro de data
    const [startDate, setStartDate] = useState<string>("");
    const [endDate, setEndDate] = useState<string>("");
    const [showFiltered, setShowFiltered] = useState(false);

    useEffect(() => {
        const f = (orders || []).reduce((acc: Record<string, string>, o: Order) => {
            acc[o.id] = new Date(o.created_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
            });
            return acc;
        }, {});
        setFormatted(f);
    }, [orders]);

    async function changeStatus(orderId: string, status: string) {
        await supabase.from("orders").update({ status }).eq("id", orderId);
    }

    const today = new Date();
    const yesterday = new Date();
    yesterday.setDate(today.getDate() - 1);

    function isSameDay(dateA: Date, dateB: Date) {
        return (
            dateA.getFullYear() === dateB.getFullYear() &&
            dateA.getMonth() === dateB.getMonth() &&
            dateA.getDate() === dateB.getDate()
        );
    }

    const todayOrders = orders.filter((o) => isSameDay(new Date(o.created_at), today));
    const yesterdayOrders = orders.filter((o) => isSameDay(new Date(o.created_at), yesterday));

    let olderOrders = orders.filter(
        (o) =>
            !isSameDay(new Date(o.created_at), today) &&
            !isSameDay(new Date(o.created_at), yesterday)
    );

    // Aplicar filtro de datas somente nos pedidos antigos
    if (startDate) {
        const s = new Date(startDate);
        olderOrders = olderOrders.filter((o) => new Date(o.created_at) >= s);
    }

    if (endDate) {
        const e = new Date(endDate);
        e.setHours(23, 59, 59, 999); // incluir o dia completo
        olderOrders = olderOrders.filter((o) => new Date(o.created_at) <= e);
    }

    function renderOrders(sectionTitle: string, data: Order[]) {
        if (!data.length) return null;

        return (
            <>
                <h2 className="text-xl font-bold mt-6 mb-3">{sectionTitle}</h2>

                <div className="grid gap-4">
                    {data.map((order) => {
                        // obter order_items deste pedido (dados históricos já em orderItems)
                        const items = (orderItems || []).filter((i) => i.order_id === order.id);

                        return (
                            <div
                                key={order.id}
                                className="bg-white p-4 shadow rounded border flex flex-col md:flex-row justify-between"
                            >
                                <div className="w-full md:w-2/3">
                                    <h2 className="font-semibold text-lg">{order.customer_name}</h2>
                                    <p className="text-sm text-gray-500">
                                        Criado: {formatted[order.id]}
                                    </p>

                                    {order.customer_address && (
                                        <p className="text-sm text-gray-600 mt-1">
                                            {order.customer_address}
                                        </p>
                                    )}

                                    <div className="mt-3 text-sm">
                                        {items.length === 0 ? (
                                            <p className="text-gray-500">— Nenhum item —</p>
                                        ) : (
                                            // Lista de itens principais e seus subitens (usando somente order_items + order_item_subitems)
                                            items.map((item) => {
                                                // subitens relativos a este order_item
                                                const subs = (orderItemSubitems || []).filter(
                                                    (s) => s.order_item_id === item.id
                                                );

                                                return (
                                                    <div key={item.id} className="mb-3">
                                                        {/* Item principal */}
                                                        <div className="flex justify-between border-b border-gray-200 py-1">
                                                            <span>
                                                                {item.quantity}x {item.name}
                                                            </span>
                                                            <span>
                                                                R$ {(item.price_cents / 100).toFixed(2)}
                                                            </span>
                                                        </div>

                                                        {/* Subitens do item */}
                                                        {subs.length > 0 && (
                                                            <div className="mt-1 ml-4">
                                                                {subs.map((s) => (
                                                                    <div key={s.id} className="flex justify-between border-b border-gray-200 py-1 text-sm text-gray-700">
                                                                        <span>
                                                                            {s.quantity}x {s.name}
                                                                        </span>
                                                                        <span>
                                                                            R$ {(s.price_cents / 100).toFixed(2)}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })
                                        )}

                                        <div className="flex justify-between border-b border-gray-300 py-1 mt-1">
                                            <span>Taxa de entrega</span>
                                            <span>R$ {(order.delivery_cents / 100).toFixed(2)}</span>
                                        </div>

                                        <div className="flex justify-between mt-2 text-lg font-bold text-black">
                                            <span>Total</span>
                                            <span>
                                                R$ {(order.total_cents / 100).toFixed(2)}
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-3 md:mt-0 md:ml-4 flex md:items-start">
                                    <select
                                        className="border p-2 rounded"
                                        defaultValue={order.status}
                                        onChange={(e) =>
                                            startTransition(() =>
                                                changeStatus(order.id, e.target.value)
                                            )
                                        }
                                    >
                                        <option value="pending_payment">Aguardando pagamento</option>
                                        <option value="paid">Pago</option>
                                        <option value="preparing">Preparando</option>
                                        <option value="done">Pronto</option>
                                    </select>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </>
        );
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Painel do Menu: {menuName}</h1>

            {renderOrders("Hoje", todayOrders)}
            {renderOrders("Ontem", yesterdayOrders)}

            {/* FILTRO DE DATAS */}
            <div className="mt-8 mb-4 p-4 bg-gray-100 rounded shadow">
                <h2 className="font-bold mb-3">Filtrar pedidos antigos</h2>

                <div className="flex flex-col md:flex-row md:items-end gap-2 flex-wrap">
                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">Data inicial</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setStartDate(e.target.value)}
                            className="border p-2 rounded"
                        />
                    </div>

                    <div className="flex flex-col">
                        <label className="text-sm font-medium mb-1">Data final</label>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="border p-2 rounded"
                        />
                    </div>

                    {/* Botão aplicar */}
                    <button
                        onClick={() => setShowFiltered(true)}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-3 py-2 rounded h-fit"
                        disabled={!startDate && !endDate}
                    >
                        Aplicar filtro
                    </button>

                    {/* Botão limpar */}
                    <button
                        onClick={() => {
                            setStartDate("");
                            setEndDate("");
                            setShowFiltered(false);
                        }}
                        className="bg-gray-300 hover:bg-gray-400 text-black px-3 py-2 rounded h-fit"
                    >
                        Limpar
                    </button>
                </div>
            </div>

            {showFiltered && renderOrders("Histórico de pedidos", olderOrders)}
        </div>
    );
}
