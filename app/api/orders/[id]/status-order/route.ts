// app/api/orders/[id]/status-order/route.ts
import { NextResponse } from "next/server";

import { withTransaction } from "@/lib/database/sql";
import { notifyOrderStatusUpdate } from "@/lib/services/whatsappNotification";
import { notifyWhatsAppAgentOrderStatus } from "@/lib/services/whatsappAgentEvents";

const VALID_STATUSES = [
    "pending_online_payment",
    "pending_physical_payment",
    "preparing",
    "delivering",
    "done",
    "canceled",
] as const;

class OrderStatusError extends Error {
    status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "OrderStatusError";
        this.status = status;
    }
}

function normalizePhone(value: unknown): string {
    let digits = String(value ?? "").replace(/\D/g, "");

    if (
        digits.startsWith("55") &&
        (digits.length === 12 || digits.length === 13)
    ) {
        digits = digits.slice(2);
    }

    return digits;
}

async function findBalancePhone(
    client: any,
    restaurantId: string,
    cleanPhone: string
): Promise<string | null> {
    const result = await client.query(
        `
            SELECT customer_phone
            FROM loyalty_balances
            WHERE restaurant_id = $1
              AND customer_phone = ANY($2::text[])
            ORDER BY
                CASE
                    WHEN customer_phone = $3
                        THEN 0
                    ELSE 1
                END
            LIMIT 1
            FOR UPDATE
        `,
        [
            restaurantId,
            [cleanPhone, `55${cleanPhone}`],
            cleanPhone,
        ]
    );

    return result.rows[0]?.customer_phone || null;
}

export async function PATCH(
    request: Request,
    context: {
        params: Promise<{ id: string }>;
    }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const status = String(body?.status || "");

        if (
            !VALID_STATUSES.includes(
                status as (typeof VALID_STATUSES)[number]
            )
        ) {
            throw new OrderStatusError("Invalid status provided", 400);
        }

        await withTransaction(async (client) => {
            const orderResult = await client.query(
                `
                        SELECT
                            id,
                            restaurant_id,
                            customer_phone,
                            loyalty_credited,
                            loyalty_points_used,
                            total_cents,
                            status
                        FROM orders
                        WHERE id = $1
                        FOR UPDATE
                    `,
                [id]
            );

            const order = orderResult.rows[0];

            if (!order) {
                throw new OrderStatusError("Order not found", 404);
            }

            const cleanPhone = normalizePhone(order.customer_phone);
            const hasValidPhone =
                cleanPhone.length === 10 || cleanPhone.length === 11;
            const pointsUsed = Number(order.loyalty_points_used) || 0;

            if (
                status === "done" &&
                order.status !== "done" &&
                hasValidPhone &&
                !order.loyalty_credited &&
                pointsUsed === 0
            ) {
                const programResult = await client.query(
                    `
                            SELECT
                                min_order_value_cents,
                                goal_count
                            FROM loyalty_programs
                            WHERE restaurant_id = $1
                              AND active = true
                            LIMIT 1
                        `,
                    [order.restaurant_id]
                );

                const program = programResult.rows[0];

                if (
                    program &&
                    Number(order.total_cents) >=
                        (Number(program.min_order_value_cents) || 0)
                ) {
                    const goal = Math.max(
                        1,
                        Number(program.goal_count) || 10
                    );

                    const storedPhone = await findBalancePhone(
                        client,
                        order.restaurant_id,
                        cleanPhone
                    );

                    if (storedPhone) {
                        const balanceResult = await client.query(
                            `
                                    SELECT current_count
                                    FROM loyalty_balances
                                    WHERE restaurant_id = $1
                                      AND customer_phone = $2
                                    FOR UPDATE
                                `,
                            [order.restaurant_id, storedPhone]
                        );

                        const currentCount =
                            Number(balanceResult.rows[0]?.current_count) || 0;

                        if (currentCount < goal) {
                            await client.query(
                                `
                                    UPDATE loyalty_balances
                                    SET
                                        current_count =
                                            current_count + 1,
                                        total_lifetime_count =
                                            total_lifetime_count + 1,
                                        last_order_at = NOW()
                                    WHERE restaurant_id = $1
                                      AND customer_phone = $2
                                `,
                                [order.restaurant_id, storedPhone]
                            );

                            await client.query(
                                `
                                    UPDATE orders
                                    SET loyalty_credited = true
                                    WHERE id = $1
                                `,
                                [id]
                            );
                        }
                    } else {
                        await client.query(
                            `
                                INSERT INTO loyalty_balances (
                                    restaurant_id,
                                    customer_phone,
                                    current_count,
                                    total_lifetime_count,
                                    last_order_at
                                )
                                VALUES (
                                    $1,
                                    $2,
                                    1,
                                    1,
                                    NOW()
                                )
                            `,
                            [order.restaurant_id, cleanPhone]
                        );

                        await client.query(
                            `
                                UPDATE orders
                                SET loyalty_credited = true
                                WHERE id = $1
                            `,
                            [id]
                        );
                    }
                }
            }

            if (status === "canceled" && hasValidPhone) {
                const storedPhone = await findBalancePhone(
                    client,
                    order.restaurant_id,
                    cleanPhone
                );
                const balancePhone = storedPhone || cleanPhone;

                if (order.loyalty_credited) {
                    if (storedPhone) {
                        await client.query(
                            `
                                UPDATE loyalty_balances
                                SET
                                    current_count =
                                        GREATEST(
                                            0,
                                            current_count - 1
                                        ),
                                    total_lifetime_count =
                                        GREATEST(
                                            0,
                                            total_lifetime_count - 1
                                        )
                                WHERE restaurant_id = $1
                                  AND customer_phone = $2
                            `,
                            [order.restaurant_id, storedPhone]
                        );
                    }

                    await client.query(
                        `
                            UPDATE orders
                            SET loyalty_credited = false
                            WHERE id = $1
                              AND loyalty_credited = true
                        `,
                        [id]
                    );
                }

                if (pointsUsed > 0) {
                    await client.query(
                        `
                            INSERT INTO loyalty_balances (
                                restaurant_id,
                                customer_phone,
                                current_count,
                                total_lifetime_count,
                                last_order_at
                            )
                            VALUES (
                                $1,
                                $2,
                                $3,
                                0,
                                NOW()
                            )
                            ON CONFLICT (
                                restaurant_id,
                                customer_phone
                            )
                            DO UPDATE SET
                                current_count =
                                    loyalty_balances.current_count +
                                    EXCLUDED.current_count,
                                last_order_at = NOW()
                        `,
                        [order.restaurant_id, balancePhone, pointsUsed]
                    );

                    await client.query(
                        `
                            UPDATE orders
                            SET loyalty_points_used = 0
                            WHERE id = $1
                              AND loyalty_points_used > 0
                        `,
                        [id]
                    );
                }
            }

            await client.query(
                `
                    UPDATE orders
                    SET
                        status =
                            $1::public.order_status,
                        updated_at = NOW()
                    WHERE id = $2
                `,
                [status, id]
            );
        });

        void notifyOrderStatusUpdate(id, status).catch((error) => {
            console.error(
                "[ORDERS] Falha ao enviar atualização de status:",
                error
            );
        });

        void notifyWhatsAppAgentOrderStatus(id, status).catch((error) => {
            console.error(
                "[ORDERS] Falha ao enviar evento ao agente do WhatsApp:",
                error
            );
        });

        return NextResponse.json({
            ok: true,
            status,
        });
    } catch (error) {
        console.error("[ORDERS] Erro ao atualizar status:", error);

        if (error instanceof OrderStatusError) {
            return NextResponse.json(
                { error: error.message },
                { status: error.status }
            );
        }

        return NextResponse.json(
            {
                error:
                    error instanceof Error
                        ? error.message
                        : "Internal error",
            },
            { status: 500 }
        );
    }
}
