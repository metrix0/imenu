// app/api/cart/clear/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const createSupabaseServerClient = () => {
    // ... (mesma função createSupabaseServerClient)
    const SUPABASE_URL = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
    const SUPABASE_SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
        return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE);
    }
    throw new Error("Missing Supabase configuration for server.");
};

export async function POST(req: Request) {
    const supabase = createSupabaseServerClient();
    const { orderId } = await req.json();

    if (!orderId) {
        return NextResponse.json({ error: "ID do Pedido é obrigatório" }, { status: 400 });
    }

    try {
        // Deleta todos os 'order_items' associados a este pedido
        await supabase.from("order_items").delete().eq("order_id", orderId);
        
        // Atualiza o pedido para R$ 0
        await supabase
            .from("orders")
            .update({ subtotal_cents: 0, total_cents: 0 })
            .eq("id", orderId);

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error("Erro em /api/cart/clear:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}