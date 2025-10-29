"use client";

import { use, useEffect, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

export default function PedidoPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params); // ✅ unwrap the Promise safely

    const [status, setStatus] = useState<string>("pending_payment");

    useEffect(() => {
        const channel = supabase
            .channel("orders-changes")
            .on(
                "postgres_changes",
                { event: "*", schema: "public", table: "orders", filter: `id=eq.${id}` },
                (payload) => {
                    const next = (payload.new as any)?.status;
                    if (next) setStatus(next);
                }
            )
            .subscribe();

        fetch(`/api/orders/${id}`)
            .then((r) => r.json())
            .then((d) => setStatus(d.status));

        return () => {
            supabase.removeChannel(channel);
        };
    }, [id]);

    return (
        <main className="p-4">
            <h1 className="text-2xl font-bold">Pedido #{id}</h1>
            <p className="mt-2">
                Status: <span className="font-mono">{status}</span>
            </p>
        </main>
    );
}
