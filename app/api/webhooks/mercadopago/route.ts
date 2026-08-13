import { NextResponse } from "next/server";
import { MercadoPagoConfig, Payment } from "mercadopago";

import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
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

            if (orderId) {
                const supabase = createSupabaseServerClient();

                if (status !== "approved") {
                    const { data: order, error: orderError } = await supabase
                        .from("orders")
                        .select("status")
                        .eq("id", orderId)
                        .maybeSingle();

                    if (orderError) throw orderError;

                    if (order?.status === "pending_online_payment") {
                        const { error: printJobError } = await supabase
                            .from("print_jobs")
                            .update({ status: "canceled" })
                            .eq("order_id", orderId)
                            .eq("status", "queued");

                        if (printJobError) throw printJobError;
                    }
                }

                if (status === "approved") {
                    const updateResult = await query(
                        `
                            UPDATE orders
                            SET status = 'paid', updated_at = NOW()
                            WHERE id = $1
                              AND status = 'pending_online_payment'
                            RETURNING restaurant_id
                        `,
                        [orderId]
                    );

                    if (updateResult.rowCount > 0) {
                        console.log("✅ Order marked paid:", orderId);

                        const restaurantId = updateResult.rows[0]?.restaurant_id;
                        if (restaurantId) {
                            const { data: existingJob, error: existingJobError } = await supabase
                                .from("print_jobs")
                                .select("id")
                                .eq("order_id", orderId)
                                .in("status", ["queued", "printing", "printed"])
                                .limit(1)
                                .maybeSingle();

                            if (existingJobError) throw existingJobError;

                            if (!existingJob) {
                                const { error: printJobError } = await supabase
                                    .from("print_jobs")
                                    .insert({
                                        restaurant_id: restaurantId,
                                        order_id: orderId,
                                    });

                                if (printJobError) throw printJobError;
                            }
                        }

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
                }
            }
        } catch (err) {
            console.error("❌ Payment lookup failed:", err);
        }
    }

    return NextResponse.json({ ok: true });
}
