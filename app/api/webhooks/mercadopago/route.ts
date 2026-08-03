import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

import { query } from "@/lib/database/sql";
import { notifyOrderReady } from "@/lib/push/server";

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
        // Mercado Pago can send an empty body and put the ID in the query string.
    }

    const paymentId =
        body?.data?.id ||
        body?.resource ||
        searchParams.get("id") ||
        searchParams.get("data.id");

    console.log("Webhook received:", { topic, paymentId, raw: body });

    if (topic === "payment" && paymentId) {
        try {
            const paymentClient = new Payment(client);
            const payment = await paymentClient.get({
                id: paymentId.toString(),
            });

            const orderId = payment.external_reference;
            const status = payment.status;

            console.log("Fetched payment:", {
                id: payment.id,
                status,
                external_reference: orderId,
            });

            if (status === "approved" && orderId) {
                await query(
                    `
                        UPDATE orders
                        SET status = 'paid', updated_at = NOW()
                        WHERE id = $1
                    `,
                    [orderId]
                );
                console.log("✅ Order marked paid:", orderId);

                try {
                    await notifyOrderReady(orderId);
                } catch (pushError) {
                    // Payment confirmation must never be retried because push failed.
                    console.error(
                        "[OWNER_PUSH] Failed after approved payment:",
                        pushError
                    );
                }
            }
        } catch (err) {
            console.error("❌ Payment lookup failed:", err);
        }
    }

    return NextResponse.json({ ok: true });
}
