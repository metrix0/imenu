// app/api/cart/update-info/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/sql";
import { createClient } from "@supabase/supabase-js";

// Usamos o Admin para garantir que podemos atualizar o pedido
const createSupabaseServerClient = () => {
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
        return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    }
    throw new Error("Missing Supabase configuration for server.");
};

export async function POST(req: Request) {
    const supabase = createSupabaseServerClient();
    const {
        orderId,
        customer_name,
        customer_phone,
        customer_address,
        delivery_fee_cents,
        isDelivery,
    } = await req.json();

    if (!orderId || !customer_name || !customer_phone) {
        return NextResponse.json({ error: "Dados do cliente incompletos" }, { status: 400 });
    }
    
    if (isDelivery && !customer_address) {
        return NextResponse.json({ error: "Endereço é obrigatório para entrega" }, { status: 400 });
    }

    try {
        // 1. Pega o subtotal do pedido (que já existe)
        const { data: order, error: orderErr } = await supabase
            .from("orders")
            .select("subtotal_cents")
            .eq("id", orderId)
            .eq("status", "draft")
            .single();

        if (orderErr || !order) {
            return NextResponse.json({ error: "Pedido não encontrado ou não é um rascunho" }, { status: 404 });
        }

        const subtotal = order.subtotal_cents;
        const total = subtotal + delivery_fee_cents;

        // 2. Atualiza o Pedido com os dados do cliente e totais finais
        await supabase
            .from("orders")
            .update({
                // (O status permanece 'draft' por enquanto)
                subtotal_cents: subtotal,
                delivery_cents: delivery_fee_cents,
                total_cents: total,
                customer_name: customer_name,
                customer_phone: customer_phone,
                customer_address: isDelivery ? customer_address : null,
                is_delivery: isDelivery,
            })
            .eq("id", orderId);

        return NextResponse.json({ success: true, orderId: orderId });

    } catch (error) {
        console.error("Erro em /api/cart/update-info:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}