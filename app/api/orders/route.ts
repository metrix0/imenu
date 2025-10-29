import { NextResponse } from "next/server";
import { query } from "@/lib/sql";
import { MercadoPagoConfig, Preference } from "mercadopago";
export const dynamic = "force-dynamic";

if (!process.env.MERCADO_PAGO_ACCESS_TOKEN)
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN missing");

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN,
});

type OrderItemInput = { itemId: string; qty: number };

export async function POST(req: Request) {
    const body = await req.json();
    const {
        customer_name,
        customer_phone,
        customer_address,
        items,
    }: {
        customer_name?: string;
        customer_phone?: string;
        customer_address?: string;
        items: OrderItemInput[];
    } = body;

    if (!items?.length)
        return NextResponse.json({ error: "Itens vazios" }, { status: 400 });

    // Fetch items snapshot & compute totals
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

    // Map quantity, build snapshot rows
    let subtotal = 0;
    const snapshot = items.map((i) => {
        const dbi = dbItems.find((d) => d.id === i.itemId);
        if (!dbi) throw new Error("Item inválido");
        subtotal += dbi.price_cents * i.qty;
        return { ...dbi, qty: i.qty };
    });

    const delivery = 0; // MVP: no delivery fee
    const total = subtotal + delivery;

    // Create order
    const { rows: [order] } = await query<{ id: string }>(
        `INSERT INTO orders (
        restaurant_id, status, subtotal_cents, delivery_cents, total_cents,
        customer_name, customer_phone, customer_address
      )
      VALUES (
        (SELECT id FROM restaurants LIMIT 1),
        'pending_payment', $1, $2, $3, $4, $5, $6
      )
      RETURNING id`,
        [
            subtotal,
            delivery,
            total,
            customer_name ?? null,
            customer_phone ?? null,
            customer_address ?? null,
        ]
    );

    // Insert order items snapshot
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

    // Base URL for callbacks
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

    // Create Mercado Pago preference (auto_return commented out for localhost)
    const preference = await new Preference(client).create({
        body: {
            items: snapshot.map((s) => ({
                title: s.name,
                quantity: s.qty,
                currency_id: "BRL",
                unit_price: s.price_cents / 100,
            })),
            external_reference: order.id,
            back_urls: {
                success: `${baseUrl}/pedido/${order.id}?status=success`,
                failure: `${baseUrl}/pedido/${order.id}?status=failure`,
                pending: `${baseUrl}/pedido/${order.id}?status=pending`,
            },
            notification_url: `${baseUrl}/api/webhooks/mercadopago`,
            auto_return: "approved", // ❌ Disabled for localhost (Mercado Pago rejects localhost URLs)
        },
    });

    const init_point = preference.init_point || preference.sandbox_init_point;

    // Save payment ref
    await query(`UPDATE orders SET payment_ref = $1 WHERE id = $2`, [
        preference.id ?? null,
        order.id,
    ]);

    return NextResponse.json({ order_id: order.id, init_point });
}
