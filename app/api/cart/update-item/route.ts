// app/api/cart/update-item/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// (Usamos o Admin para garantir que podemos atualizar o pedido)
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
    const { orderId, orderItemId, newQuantity } = await req.json();

    if (!orderId || !orderItemId || newQuantity === undefined) {
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    try {
        if (newQuantity <= 0) {
            // Se a quantidade for 0 ou menos, remove o item
            await supabase.from("order_items").delete().eq("id", orderItemId);
        } else {
            // Senão, atualiza a quantidade
            await supabase
                .from("order_items")
                .update({ quantity: newQuantity })
                .eq("id", orderItemId);
        }

        // Recalcula o total do pedido
        const { data: items } = await supabase
            .from("order_items")
            .select("price_cents, quantity")
            .eq("order_id", orderId);

        const newSubtotal = (items || []).reduce((sum, it) => sum + (it.price_cents * it.quantity), 0);
        
        await supabase
            .from("orders")
            .update({
                subtotal_cents: newSubtotal,
                total_cents: newSubtotal // (Taxa será adicionada no checkout)
            })
            .eq("id", orderId);

        return NextResponse.json({ success: true, newSubtotal });

    } catch (error) {
        console.error("Erro em /api/cart/update-item:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}