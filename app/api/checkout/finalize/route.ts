// app/api/checkout/finalize/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/sql";
import { MercadoPagoConfig, Preference } from "mercadopago";

// (Configuração do MercadoPago - sem mudança)
if (!process.env.MERCADO_PAGO_ACCESS_TOKEN)
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN missing");
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

export async function POST(req: Request) {
    const body = await req.json();
    const {
        orderId,
        customer_name,
        customer_phone,
        customer_address,
        delivery_fee_cents,
        paymentMethod,
        isDelivery,
    }: {
        orderId: string;
        customer_name: string;
        customer_phone: string;
        customer_address: string | null;
        delivery_fee_cents: number;
        paymentMethod: "machine" | "online";
        isDelivery: boolean;
    } = body;

    if (!orderId || !customer_name || !customer_phone || !paymentMethod)
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });

    try {
        // --- CORREÇÃO AQUI ---
        // 1. Pega o subtotal do pedido (buscando pelo status correto)
        const { rows: orderRows } = await query(
            `SELECT subtotal_cents, restaurant_id FROM orders WHERE id = $1 AND status = 'pending_payment'`, // <-- MUDADO DE 'draft'
            [orderId]
        );
        // --- FIM DA CORREÇÃO ---

        if (orderRows.length === 0) {
            return NextResponse.json({ error: "Pedido não encontrado ou já finalizado" }, { status: 404 });
        }
        
        const subtotal = orderRows[0].subtotal_cents;
        const restaurant_id = orderRows[0].restaurant_id;

        // (2. Calcula o total - sem mudança)
        const total = subtotal + delivery_fee_cents;

        // (3. Define o status - sem mudança)
        const orderStatus = paymentMethod === "machine" ? "created" : "pending_payment";

        // (4. Atualiza o Pedido - sem mudança)
        await query(
            `UPDATE orders SET
                status = $1, subtotal_cents = $2, delivery_cents = $3,
                total_cents = $4, customer_name = $5, customer_phone = $6,
                customer_address = $7, is_delivery = $8
            WHERE id = $9`,
            [
                orderStatus, subtotal, delivery_fee_cents, total,
                customer_name, customer_phone, customer_address,
                isDelivery, orderId
            ]
        );

        // (5. Se for "Levar Maquininha" - sem mudança)
        if (paymentMethod === "machine") {
            return NextResponse.json({ 
                order_id: orderId,
                payment_type: 'machine' 
            });
        }

        // (6. Se for "Online" - sem mudança)
        const { rows: dbItems } = await query(
            `SELECT id, name, price_cents, quantity FROM order_items WHERE order_id = $1`,
            [orderId]
        );

        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

        const preference = await new Preference(client).create({
            body: {
                items: dbItems.map((s) => ({
                    id: s.id,
                    title: s.name,
                    quantity: s.quantity,
                    currency_id: "BRL",
                    unit_price: s.price_cents / 100,
                })),
                shipments: {
                    cost: delivery_fee_cents / 100,
                },
                external_reference: orderId,
                back_urls: {
                    success: `${baseUrl}/pedido/${orderId}?status=success`,
                    failure: `${baseUrl}/pedido/${orderId}?status=failure`,
                    pending: `${baseUrl}/pedido/${orderId}?status=pending`,
                },
                notification_url: `${baseUrl}/api/webhooks/mercadopago`,
                auto_return: "approved",
            },
        });

        const init_point = preference.init_point || preference.sandbox_init_point;
        await query(`UPDATE orders SET payment_ref = $1 WHERE id = $2`, [preference.id ?? null, orderId]);

        return NextResponse.json({ 
            order_id: orderId, 
            init_point,
            payment_type: 'online'
        });

    } catch (error) {
        console.error("Erro em /api/checkout/finalize:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}