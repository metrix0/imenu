import { NextResponse } from "next/server";
import { query } from "@/lib/sql";
import MercadoPagoConfig, { Payment } from "mercadopago";

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(req: Request) {
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic") || undefined;
    let body: any = {};
    try {
        body = await req.json();
    } catch (_) {}

    // Try both query params and body
    let orderId =
        body?.external_reference ||
        body?.data?.id ||
        searchParams.get("external_reference");

    console.log("Webhook received:", { topic, orderId, raw: body });

    // If external_reference is missing but we got a payment id, fetch details
    if (topic === "payment" && !body?.external_reference && body?.data?.id) {
        try {
            const payment = await new Payment(client).get({ id: body.data.id });
            orderId = payment.external_reference;
            console.log("Fetched external_reference from API:", orderId);
        } catch (err) {
            console.error("Payment lookup failed:", err);
        }
    }

    if (topic === "payment" && orderId) {
        try {
            await query(`UPDATE orders SET status = 'paid' WHERE id = $1`, [orderId]);
            console.log("Order marked paid:", orderId);
        } catch (err) {
            console.error("DB error:", err);
        }
    }

    return NextResponse.json({ ok: true });
}
