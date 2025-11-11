// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/sql";
import { MercadoPagoConfig, Preference } from "mercadopago";
export const dynamic = "force-dynamic";

// (A configuração do client MercadoPago permanece a mesma)
if (!process.env.MERCADO_PAGO_ACCESS_TOKEN)
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN missing");
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

type OrderItemInput = { itemId: string; qty: number };

export async function POST(req: Request) {
    const body = await req.json();
    const {
        restaurantId, // <-- 1. PRECISAMOS SABER O RESTAURANTE
        customer_name,
        customer_phone,
        customer_address,
        items,
        delivery_fee_cents, // <-- 2. PRECISAMOS DA TAXA
        paymentMethod,    // <-- 3. PRECISAMOS SABER O MÉTODO
    }: {
        restaurantId: string;
        customer_name?: string;
        customer_phone?: string;
        customer_address?: string;
        items: OrderItemInput[];
        delivery_fee_cents: number;
        paymentMethod: "machine" | "online"; // 'machine' = Levar Maquininha
    } = body;

    if (!items?.length || !restaurantId || !paymentMethod)
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

    // --- Cálculo de Preço (O seu código estava perfeito) ---
    const ids = items.map((i) => i.itemId);
    const placeholders = ids.map((_, i) => `$${i + 1}`).join(",");
    const { rows: dbItems } = await query<{
        id: string;
        name: string;
        price_cents: number;
    }>(
        `SELECT id, name, price_cents FROM items WHERE id IN (${placeholders})`,
        ids
    );

    let subtotal = 0;
    const snapshot = items.map((i) => {
        const dbi = dbItems.find((d) => d.id === i.itemId);
        if (!dbi) throw new Error("Item inválido");
        subtotal += dbi.price_cents * i.qty;
        return { ...dbi, qty: i.qty };
    });

    // --- Correção da Lógica de Total ---
    const total = subtotal + delivery_fee_cents;

    // --- Lógica de Pagamento ---

    // Se for "Levar Maquininha", o status já começa como 'pending' (pendente de entrega)
    // Se for 'online', começa como 'pending_payment' (pendente de pagamento)
    const orderStatus = paymentMethod === "machine" ? "pending" : "pending_payment";

    // Create order
    const { rows: [order] } = await query<{ id: string }>(
        `INSERT INTO orders (
            restaurant_id, status, subtotal_cents, delivery_cents, total_cents,
            customer_name, customer_phone, customer_address
        )
        VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8
        )
        RETURNING id`,
        [
            restaurantId, // <-- CORRIGIDO
            orderStatus,
            subtotal,
            delivery_fee_cents, // <-- CORRIGIDO
            total,
            customer_name ?? null,
            customer_phone ?? null,
            customer_address ?? null,
        ]
    );

    // Insert order items snapshot (Seu código estava perfeito)
    const values: any[] = [];
    const chunks: string[] = [];
    snapshot.forEach((s, idx) => {
        const base = idx * 5;
        chunks.push(
            `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`
        );
        values.push(order.id, s.id, s.name, s.price_cents, s.qty);
    });

    await query(
        `INSERT INTO order_items (order_id, item_id, name, price_cents, quantity)
     VALUES ${chunks.join(",")}`,
        values
    );

    // --- LÓGICA CONDICIONAL DE PAGAMENTO ---
    
    // Se for "Levar Maquininha", nós terminamos.
    // Apenas retornamos o ID do pedido criado.
    if (paymentMethod === "machine") {
        return NextResponse.json({ 
            order_id: order.id,
            payment_type: 'machine' 
        });
    }

    // Se for "Online" (Mercado Pago), continuamos a criar a preferência
    // Base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    const preference = await new Preference(client).create({
        body: {
            items: snapshot.map((s) => ({
                id: s.id,
                title: s.name,
                quantity: s.qty,
                currency_id: "BRL",
                unit_price: s.price_cents / 100,
            })),
            // Adiciona a taxa de entrega como um item a mais
            shipments: {
                cost: delivery_fee_cents / 100,
            },
            external_reference: order.id,
            back_urls: {
                success: `${baseUrl}/pedido/${order.id}?status=success`,
                failure: `${baseUrl}/pedido/${order.id}?status=failure`,
                pending: `${baseUrl}/pedido/${order.id}?status=pending`,
            },
            notification_url: `${baseUrl}/api/webhooks/mercadopago`,
            auto_return: "approved",
        },
    });

    const init_point = preference.init_point || preference.sandbox_init_point;

    // Save payment ref
    await query(`UPDATE orders SET payment_ref = $1 WHERE id = $2`, [
        preference.id ?? null,
        order.id,
    ]);

    return NextResponse.json({ 
        order_id: order.id, 
        init_point,
        payment_type: 'online'
    });
}