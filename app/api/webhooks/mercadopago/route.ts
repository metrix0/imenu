import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { MercadoPagoConfig, Payment } from "mercadopago";

// ✅ create Mercado Pago client
const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic") || undefined;
    let body: any = {};

    try {
        body = await req.json();
    } catch {
        // ignore empty body
    }

    // ✅ detect payment ID from multiple possible fields
    const paymentId =
        body?.data?.id ||
        body?.resource ||
        searchParams.get("id") ||
        searchParams.get("data.id");

    console.log("Webhook received:", { topic, paymentId, raw: body });

    if (topic === "payment" && paymentId) {
        try {
            const paymentClient = new Payment(client);
            const payment = await paymentClient.get({ id: paymentId.toString() });

            const orderId = payment.external_reference;
            const status = payment.status;

            console.log("Fetched payment:", {
                id: payment.id,
                status,
                external_reference: orderId,
            });

            if (status === "approved" && orderId) {
                await query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [
                    orderId,
                ]);
                console.log("✅ Order marked paid:", orderId);
            }
        } catch (err) {
            console.error("❌ Payment lookup failed:", err);
        }
    }

    return NextResponse.json({ ok: true });
}
