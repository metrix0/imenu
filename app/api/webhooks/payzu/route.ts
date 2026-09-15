import { NextResponse } from "next/server";

import { query } from "@/lib/database/sql";
import { createSupabaseServerClient } from "@/lib/database/supabaseServerClient";
import { getPayZuPixCharge } from "@/lib/payzu";
import { notifyOrderReady } from "@/lib/push/server";

export async function POST(req: Request) {
    let body: any = {};

    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ ok: true });
    }

    const transactionId = String(body?.id ?? "");
    const clientReference = String(body?.clientReference ?? "");

    if (!transactionId || !clientReference) {
        return NextResponse.json({ ok: true });
    }

    try {
        const transaction = await getPayZuPixCharge({
            id: transactionId,
        });

        if (
            !transaction ||
            String(transaction.id) !== transactionId ||
            String(transaction.clientReference ?? "") !== clientReference ||
            String(transaction.type ?? "") !== "DEPOSIT"
        ) {
            console.error("[PAYZU] Callback não corresponde à cobrança:", {
                transactionId,
                clientReference,
            });
            return NextResponse.json({ ok: true });
        }

        const orderResult = await query(
            `
                SELECT id, status, total_cents, payment_ref
                FROM orders
                WHERE id = $1
                LIMIT 1
            `,
            [clientReference]
        );
        const order = orderResult.rows[0];

        if (!order) {
            return NextResponse.json({ ok: true });
        }

        if (
            order.payment_ref &&
            String(order.payment_ref) !== String(transaction.id)
        ) {
            console.error("[PAYZU] Referência de pagamento divergente:", {
                orderId: order.id,
                storedPaymentRef: order.payment_ref,
                transactionId: transaction.id,
            });
            return NextResponse.json({ ok: true });
        }

        const paidAmountCents = Math.round(
            Number(transaction.amount) * 100
        );

        if (
            !Number.isFinite(paidAmountCents) ||
            paidAmountCents !== Number(order.total_cents)
        ) {
            console.error("[PAYZU] Valor do callback divergente:", {
                orderId: order.id,
                expected: order.total_cents,
                received: transaction.amount,
            });
            return NextResponse.json({ ok: true });
        }

        const supabase = createSupabaseServerClient();

        if (transaction.status !== "COMPLETED") {
            if (order.status === "pending_online_payment") {
                const { error: printJobError } = await supabase
                    .from("print_jobs")
                    .update({ status: "canceled" })
                    .eq("order_id", order.id)
                    .eq("status", "queued");

                if (printJobError) throw printJobError;
            }

            return NextResponse.json({ ok: true });
        }

        const updateResult = await query(
            `
                UPDATE orders
                SET
                    status = 'paid',
                    payment_ref = COALESCE(payment_ref, $2),
                    updated_at = NOW()
                WHERE id = $1
                  AND status = 'pending_online_payment'
                RETURNING restaurant_id
            `,
            [order.id, transaction.id]
        );

        if (updateResult.rowCount > 0) {
            const restaurantId =
                updateResult.rows[0]?.restaurant_id;

            if (restaurantId) {
                const { data: existingJob, error: existingJobError } =
                    await supabase
                        .from("print_jobs")
                        .select("id")
                        .eq("order_id", order.id)
                        .in("status", ["queued", "printing", "printed"])
                        .limit(1)
                        .maybeSingle();

                if (existingJobError) throw existingJobError;

                if (!existingJob) {
                    const { error: printJobError } = await supabase
                        .from("print_jobs")
                        .insert({
                            restaurant_id: restaurantId,
                            order_id: order.id,
                        });

                    if (printJobError) throw printJobError;
                }
            }

            try {
                await notifyOrderReady(order.id);
            } catch (pushError) {
                console.error(
                    "[OWNER_PUSH] Failed after PayZu payment:",
                    pushError
                );
            }
        }
    } catch (error) {
        console.error("[PAYZU] Falha ao processar callback:", error);
    }

    return NextResponse.json({ ok: true });
}
