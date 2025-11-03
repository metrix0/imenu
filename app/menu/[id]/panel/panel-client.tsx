"use client";

import { useTransition, useEffect, useState } from "react";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function PanelClient({
    menuName,
    orders,
    orderItems = [],
}: any) {
    const [isPending, startTransition] = useTransition();
    const [formattedDates, setFormattedDates] = useState<Record<string, string>>({});

    // Formatar datas
    useEffect(() => {
        const formatted = (orders || []).reduce((acc: any, order: any) => {
            acc[order.id] = new Date(order.created_at).toLocaleString("pt-BR", {
                timeZone: "America/Sao_Paulo",
            });
            return acc;
        }, {});
        setFormattedDates(formatted);
    }, [orders]);

    async function changeStatus(orderId: string, status: string) {
        await supabase.from("orders").update({ status }).eq("id", orderId);
    }

    return (
        <div className="p-6">
            <h1 className="text-2xl font-bold mb-6">Painel do Menu: {menuName}</h1>

            <div className="grid gap-4">
                {(orders || []).map((order: any) => {
                    const items = (orderItems || []).filter((i: any) => i.order_id === order.id);

                    return (
                        <div key={order.id} className="bg-white p-4 shadow rounded border">
                            <h2 className="font-semibold">{order.customer_name}</h2>
                            <p className="text-sm text-gray-500">Criado: {formattedDates[order.id] ?? "..."}</p>

                            <ul className="mt-3 text-sm">
                                {items.length === 0 ? (
                                    <li className="text-gray-500">— Nenhum item —</li>
                                ) : (
                                    items.map((item: any) => (
                                        <li key={item.id}>
                                            • {item.name} — {item.quantity}x — R$ {(item.price_cents / 100).toFixed(2)}
                                        </li>
                                    ))
                                )}
                            </ul>

                            <p className="mt-3 font-semibold">Total: R$ {(order.total_cents / 100).toFixed(2)}</p>

                            <div className="mt-3">
                                <select
                                    className="border p-1 rounded"
                                    defaultValue={order.status}
                                    onChange={(e) =>
                                        startTransition(() => changeStatus(order.id, e.target.value))
                                    }
                                >
                                    <option value="created">Aguardando pagamento</option>
                                    <option value="paid">Pago</option>
                                    <option value="preparing">Preparando</option>
                                    <option value="ready">Pronto</option>
                                </select>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
