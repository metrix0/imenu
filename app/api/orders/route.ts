import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { MercadoPagoConfig, Preference } from "mercadopago";
export const dynamic = "force-dynamic";

if (!process.env.MERCADO_PAGO_ACCESS_TOKEN)
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN missing");

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

// -------------------------------
// Types (FIXED: added missing name: string)
// -------------------------------
type OrderItemInput = {
    item_id: string;
    name: string; // ✅ REQUIRED — your SQL uses this
    qty: number;
    unit_price_cents: number;
    total_cents: number;
    observation?: string;
    selectedSubitems: {
        subcategoryId: string;
        subcategoryName: string;
        subitemId: string;
        subitemName: string;
        price_cents: number;
    }[];
};

export async function POST(req: Request) {
    console.log("📩 [ORDERS] Incoming request...");

    let body: any = {};
    try {
        body = await req.json();
        console.log("📦 [ORDERS] BODY:", body);
    } catch (err) {
        console.error("❌ [ORDERS] Failed to parse JSON:", err);
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    try {
        const {
            restaurantId,
            customer_name,
            customer_phone,
            customer_address,
            items,
            delivery_fee_cents,
            delivery_time_minutes,
            paymentMethod,
        }: {
            restaurantId: string;
            customer_name?: string;
            customer_phone?: string;
            customer_address?: string;
            items: OrderItemInput[];
            delivery_fee_cents: number;
            delivery_time_minutes: number;
            paymentMethod: "pix" | "cartao" | "dinheiro" | "trazer-maquininha";
        } = body;

        console.log(body)

        console.log("🔍 Validating input...");

        if (!items?.length) console.log("❌ items missing");
        if (!restaurantId) console.log("❌ restaurantId missing");
        if (!paymentMethod) console.log("❌ paymentMethod missing");

        if (!items?.length || !restaurantId || !paymentMethod) {
            return NextResponse.json(
                { error: "Incomplete fields" },
                { status: 400 }
            );
        }

        // -------------------------------
        // Compute subtotal
        // -------------------------------
        console.log("🧮 Calculating subtotal...");

        let subtotal = 0;
        items.forEach((item) => {
            subtotal += item.total_cents;
        });

        console.log("💰 Subtotal:", subtotal);
        console.log("💰 Delivery Fee:", delivery_fee_cents);

        const total = subtotal + delivery_fee_cents;
        console.log("💰 TOTAL:", total);

        // -------------------------------
        // Delivery ETA
        // -------------------------------
        console.log("⏱ Calculating ETA...");

        const deliveryTime = delivery_time_minutes ?? 40;
        const eta = new Date(Date.now() + deliveryTime * 60000);


        console.log("📌 ETA =", eta);

        // -------------------------------
        // Payment logic
        // -------------------------------
        const isOfflinePayment =
            paymentMethod === "dinheiro" || paymentMethod === "trazer-maquininha";

        const orderStatus = isOfflinePayment
            ? "pending_physical_payment"
            : "pending_online_payment";

        console.log("📝 Creating order in DB...");

        // -------------------------------
        // Create order
        // -------------------------------
        const { rows: [order] } = await query<{ id: string }>(
            `INSERT INTO orders (
    restaurant_id, status, subtotal_cents, delivery_cents, total_cents,
    customer_name, customer_phone, customer_address,
    delivery_eta,
    payment_method      
)
VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
RETURNING id
`,
            [
                restaurantId,
                orderStatus,
                subtotal,
                delivery_fee_cents,
                total,
                customer_name ?? null,
                customer_phone ?? null,
                customer_address ?? null,
                eta,
                paymentMethod   // ✅ NEW
            ]

        );

        console.log("✅ Order created:", order);

        // -------------------------------
        // Insert ITEMS + SUBITEMS
        // -------------------------------
        console.log("📥 Inserting items + subitems...");

        for (const cartItem of items) {
            const { rows: [oi] } = await query(
                `INSERT INTO order_items (
                    order_id,
                    item_id,
                    name,
                    price_cents,
                    quantity,
                    observation,
                    total_cents
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7)
                RETURNING id`,
                [
                    order.id,
                    cartItem.item_id,
                    cartItem.name,
                    cartItem.unit_price_cents,
                    cartItem.qty,
                    cartItem.observation ?? null,
                    cartItem.total_cents,
                ]
            );

            console.log("🧩 Created order_item:", oi);

            // Subitems
// Subitems (correct schema)
            for (const sub of cartItem.selectedSubitems) {
                await query(
                    `INSERT INTO order_item_subitems (
            order_item_id,
            subitem_id,
            name,
            price_cents,
            quantity
        )
        VALUES ($1,$2,$3,$4,$5)`,
                    [
                        oi.id,
                        sub.subitemId,
                        sub.subitemName,
                        sub.price_cents,
                        1
                    ]
                );

                console.log("   ➕ Inserted subitem:", sub);
            }
        }

        // -------------------------------
        // Get restaurant slug
        // -------------------------------
        const { rows: [restaurantInfo] } = await query(
            `SELECT url_slug FROM restaurants WHERE id = $1`,
            [restaurantId]
        );

        const slug = restaurantInfo?.url_slug;
        console.log("🏪 Restaurant slug:", slug);

        // -------------------------------
        // OFFLINE PAYMENT
        // -------------------------------
        if (isOfflinePayment) {
            console.log("💵 Offline payment, redirecting...");
            return NextResponse.json({
                order_id: order.id,
                payment_type: "offline",
                redirect: `/${slug}/${order.id}`,
            });
        }

        // -------------------------------
        // Mercado Pago
        // -------------------------------
        console.log("💳 Creating Mercado Pago payment...");

        const baseUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/${slug}`;

        const preference = await new Preference(client).create({
            body: {
                items: items.map((s) => ({
                    id: s.item_id,
                    title: s.name,
                    quantity: s.qty,
                    currency_id: "BRL",
                    unit_price: s.unit_price_cents / 100,
                })),
                shipments: {
                    cost: delivery_fee_cents / 100,
                    mode: "not_specified",
                },
                external_reference: order.id.toString(),
                back_urls: {
                    success: `${baseUrl}/${order.id}`,
                    failure: `${baseUrl}/${order.id}`,
                    pending: `${baseUrl}/${order.id}`,
                },
                auto_return: "approved",
                notification_url: `${baseUrl}/api/mercadopago/webhook`,
            },
        });

        console.log("🔗 Preference created:", preference.id);

        const init_point =
            preference.init_point || preference.sandbox_init_point;

        await query(
            `UPDATE orders SET payment_ref = $1 WHERE id = $2`,
            [preference.id ?? null, order.id]
        );

        console.log("🔄 Updated order with payment_ref");

        return NextResponse.json({
            order_id: order.id,
            init_point,
            payment_type: "online",
        });

    } catch (err: any) {
        console.error("❌ FATAL ERROR /api/orders:", err);
        return NextResponse.json(
            { error: err.message || "Erro interno" },
            { status: 500 }
        );
    }
}
