// app/api/orders/route.ts
import { NextResponse } from "next/server";

import {
    query,
    withTransaction,
} from "@/lib/database/sql";
import { createPayZuPixCharge } from "@/lib/payzu";
import { promotionPrice } from "@/lib/utils/formatPrice";

export const dynamic = "force-dynamic";

class OrderRequestError extends Error {
    status: number;

    constructor(message: string, status = 400) {
        super(message);
        this.name = "OrderRequestError";
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

function parseIdArray(value: unknown): string[] {
    if (Array.isArray(value)) {
        return value
            .map((item) => String(item))
            .filter(Boolean);
    }

    if (typeof value === "string") {
        try {
            const parsed = JSON.parse(value);

            return Array.isArray(parsed)
                ? parsed
                      .map((item) => String(item))
                      .filter(Boolean)
                : [];
        } catch {
            return [];
        }
    }

    return [];
}

function getCartItemId(item: any): string {
    return String(
        item?.item_id || item?.base_item_id || ""
    );
}

function getSelectedSubitems(item: any): any[] {
    return Array.isArray(item?.selectedSubitems)
        ? item.selectedSubitems
        : [];
}

async function cancelUnpaidOnlineOrder(
    orderId: string
): Promise<void> {
    await withTransaction(async (client) => {
        const orderResult = await client.query(
            `
                SELECT
                    id,
                    restaurant_id,
                    customer_phone,
                    status,
                    payment_ref,
                    loyalty_points_used
                FROM orders
                WHERE id = $1
                FOR UPDATE
            `,
            [orderId]
        );

        const order = orderResult.rows[0];

        if (
            !order ||
            order.status !==
                "pending_online_payment" ||
            order.payment_ref
        ) {
            return;
        }

        const orderItemsResult =
            await client.query(
                `
                    SELECT item_id, quantity
                    FROM order_items
                    WHERE order_id = $1
                `,
                [orderId]
            );

        for (const orderItem of orderItemsResult.rows) {
            await client.query(
                `
                    UPDATE items
                    SET
                        stock_quantity =
                            stock_quantity + $1,
                        is_available = true
                    WHERE id = $2
                      AND stock_enabled = true
                `,
                [
                    Number(orderItem.quantity) || 0,
                    orderItem.item_id,
                ]
            );
        }

        const pointsUsed =
            Number(order.loyalty_points_used) || 0;
        const cleanPhone = normalizePhone(
            order.customer_phone
        );

        if (
            pointsUsed > 0 &&
            (cleanPhone.length === 10 ||
                cleanPhone.length === 11)
        ) {
            const phoneCandidates = [
                cleanPhone,
                `55${cleanPhone}`,
            ];

            const balanceResult =
                await client.query(
                    `
                        SELECT customer_phone
                        FROM loyalty_balances
                        WHERE restaurant_id = $1
                          AND customer_phone =
                              ANY($2::text[])
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
                        order.restaurant_id,
                        phoneCandidates,
                        cleanPhone,
                    ]
                );

            const storedPhone =
                balanceResult.rows[0]
                    ?.customer_phone ||
                cleanPhone;

            await client.query(
                `
                    INSERT INTO loyalty_balances (
                        restaurant_id,
                        customer_phone,
                        current_count,
                        total_lifetime_count,
                        last_order_at
                    )
                    VALUES ($1, $2, $3, 0, NOW())
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
                [
                    order.restaurant_id,
                    storedPhone,
                    pointsUsed,
                ]
            );
        }

        await client.query(
            `
                UPDATE orders
                SET
                    status =
                        'canceled'::public.order_status,
                    loyalty_points_used = 0,
                    updated_at = NOW()
                WHERE id = $1
            `,
            [orderId]
        );
    });
}

export async function POST(request: Request) {
    let body: any;

    try {
        body = await request.json();
    } catch {
        return NextResponse.json(
            { error: "Invalid JSON" },
            { status: 400 }
        );
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
            coupon_discount_cents,
            coupon_type,
            is_delivery,
            scheduled_for,
        } = body;

        if (
            !Array.isArray(items) ||
            items.length === 0 ||
            !restaurantId ||
            !paymentMethod
        ) {
            throw new OrderRequestError(
                "Campos obrigatórios incompletos."
            );
        }

        let scheduledFor: Date | null = null;
        if (scheduled_for) {
            const parsedScheduledFor = new Date(scheduled_for);
            if (
                Number.isNaN(parsedScheduledFor.getTime()) ||
                parsedScheduledFor.getTime() <= Date.now()
            ) {
                throw new OrderRequestError(
                    "Horário de agendamento inválido."
                );
            }
            scheduledFor = parsedScheduledFor;
        }

        const isPickup =
            is_delivery === "retirada";
        const safeDeliveryFeeCents = isPickup
            ? 0
            : Math.max(
                  Number(delivery_fee_cents) || 0,
                  0
              );

        const subtotal = items.reduce(
            (totalValue: number, item: any) =>
                totalValue +
                (promotionPrice(item) ||
                    Number(item?.total_cents) ||
                    0),
            0
        );

        const safeCouponDiscount =
            coupon_type === "delivery" &&
            isPickup
                ? 0
                : Number(coupon_discount_cents) >
                    0
                  ? Math.min(
                        Number(
                            coupon_discount_cents
                        ),
                        subtotal
                    )
                  : 0;

        const total = Math.max(
            subtotal +
                safeDeliveryFeeCents -
                safeCouponDiscount,
            0
        );

        const programResult = await query(
            `
                SELECT
                    goal_count,
                    reward_item_id,
                    reward_subitem_ids
                FROM loyalty_programs
                WHERE restaurant_id = $1
                  AND active = true
                LIMIT 1
            `,
            [restaurantId]
        );

        const program =
            programResult.rows[0] || null;

        const rewardItems = items.filter(
            (item: any) => {
                const itemId = getCartItemId(item);
                const matchesConfiguredReward =
                    program &&
                    String(itemId) ===
                        String(
                            program.reward_item_id
                        ) &&
                    Number(item.total_cents) === 0;

                return (
                    item?.is_reward === true ||
                    matchesConfiguredReward
                );
            }
        );

        if (rewardItems.length > 1) {
            throw new OrderRequestError(
                "Apenas uma recompensa pode ser usada por pedido."
            );
        }

        const rewardItem =
            rewardItems[0] || null;
        const cleanPhone = normalizePhone(
            customer_phone
        );
        let pointsToDeduct = 0;
        let rewardSubitemIds = new Set<string>();

        if (rewardItem) {
            if (!program) {
                throw new OrderRequestError(
                    "Programa de fidelidade inativo."
                );
            }

            if (
                cleanPhone.length !== 10 &&
                cleanPhone.length !== 11
            ) {
                throw new OrderRequestError(
                    "Telefone necessário para resgate."
                );
            }

            const rewardItemId =
                getCartItemId(rewardItem);

            if (
                String(program.reward_item_id) !==
                rewardItemId
            ) {
                throw new OrderRequestError(
                    "Item inválido para resgate."
                );
            }

            if (
                Number(rewardItem.qty) !== 1 ||
                Number(rewardItem.total_cents) !==
                    0 ||
                Number(
                    rewardItem.unit_price_cents
                ) !== 0
            ) {
                throw new OrderRequestError(
                    "A recompensa deve ter quantidade 1 e valor zero."
                );
            }

            rewardSubitemIds = new Set(
                parseIdArray(
                    program.reward_subitem_ids
                )
            );

            const selectedRewardSubitems =
                getSelectedSubitems(rewardItem);
            const selectedRewardIds =
                selectedRewardSubitems.map(
                    (subitem: any) =>
                        String(
                            subitem?.subitemId || ""
                        )
                );

            if (
                new Set(selectedRewardIds).size !==
                selectedRewardIds.length
            ) {
                throw new OrderRequestError(
                    "A recompensa possui complementos duplicados."
                );
            }

            const invalidRewardSubitem =
                selectedRewardIds.some(
                    (subitemId: string) =>
                        !rewardSubitemIds.has(
                            subitemId
                        )
                );

            if (invalidRewardSubitem) {
                throw new OrderRequestError(
                    "A recompensa contém um complemento não configurado."
                );
            }

            pointsToDeduct = Math.max(
                1,
                Math.round(
                    Number(program.goal_count) ||
                        10
                )
            );
        }

        const deliveryTime = Math.max(
            Number(delivery_time_minutes) || 40,
            0
        );
        const eta = scheduledFor ?? new Date(
            Date.now() +
                deliveryTime * 60_000
        );
        const isOnlinePix =
            paymentMethod === "pix" &&
            total > 0;
        const orderStatus = isOnlinePix
            ? "pending_online_payment"
            : "pending_physical_payment";

        const transactionResult =
            await withTransaction(
                async (client) => {
                    const lockedItems =
                        new Map<string, any>();
                    const requestedQuantities =
                        new Map<string, number>();

                    for (const cartItem of items) {
                        const itemId =
                            getCartItemId(cartItem);
                        const requestedQuantity =
                            Number(cartItem?.qty);

                        if (!itemId) {
                            throw new OrderRequestError(
                                "Um item do pedido não foi identificado."
                            );
                        }

                        if (
                            !Number.isInteger(
                                requestedQuantity
                            ) ||
                            requestedQuantity <= 0
                        ) {
                            throw new OrderRequestError(
                                `Quantidade inválida para ${
                                    cartItem?.name ||
                                    "um item"
                                }.`
                            );
                        }

                        requestedQuantities.set(
                            itemId,
                            (requestedQuantities.get(
                                itemId
                            ) || 0) +
                                requestedQuantity
                        );
                    }

                    for (const [
                        itemId,
                        requestedQuantity,
                    ] of requestedQuantities) {
                        const itemResult =
                            await client.query(
                                `
                                    SELECT
                                        id,
                                        restaurant_id,
                                        name,
                                        stock_enabled,
                                        stock_quantity,
                                        is_available
                                    FROM items
                                    WHERE id = $1
                                    FOR UPDATE
                                `,
                                [itemId]
                            );

                        const databaseItem =
                            itemResult.rows[0];

                        if (
                            !databaseItem ||
                            String(
                                databaseItem.restaurant_id
                            ) !==
                                String(
                                    restaurantId
                                )
                        ) {
                            throw new OrderRequestError(
                                "Um item não pertence a este restaurante."
                            );
                        }

                        if (
                            databaseItem.is_available ===
                            false
                        ) {
                            throw new OrderRequestError(
                                `${databaseItem.name} não está disponível.`
                            );
                        }

                        if (
                            databaseItem.stock_enabled ===
                                true &&
                            Number(
                                databaseItem.stock_quantity
                            ) <
                                requestedQuantity
                        ) {
                            throw new OrderRequestError(
                                `Estoque insuficiente para ${databaseItem.name}. Disponível: ${Number(
                                    databaseItem.stock_quantity
                                ) || 0}.`
                            );
                        }

                        lockedItems.set(
                            itemId,
                            databaseItem
                        );
                    }

                    if (rewardItem) {
                        const phoneCandidates = [
                            cleanPhone,
                            `55${cleanPhone}`,
                        ];

                        const balanceResult =
                            await client.query(
                                `
                                    SELECT customer_phone
                                    FROM loyalty_balances
                                    WHERE restaurant_id = $1
                                      AND customer_phone =
                                          ANY($2::text[])
                                      AND current_count >= $3
                                    ORDER BY
                                        CASE
                                            WHEN customer_phone =
                                                $4
                                                THEN 0
                                            ELSE 1
                                        END
                                    LIMIT 1
                                    FOR UPDATE
                                `,
                                [
                                    restaurantId,
                                    phoneCandidates,
                                    pointsToDeduct,
                                    cleanPhone,
                                ]
                            );

                        const balancePhone =
                            balanceResult.rows[0]
                                ?.customer_phone;

                        if (!balancePhone) {
                            throw new OrderRequestError(
                                "Saldo de fidelidade insuficiente para este prêmio."
                            );
                        }

                        const deductionResult =
                            await client.query(
                                `
                                    UPDATE loyalty_balances
                                    SET current_count =
                                        current_count - $1
                                    WHERE restaurant_id = $2
                                      AND customer_phone = $3
                                      AND current_count >= $1
                                    RETURNING current_count
                                `,
                                [
                                    pointsToDeduct,
                                    restaurantId,
                                    balancePhone,
                                ]
                            );

                        if (
                            deductionResult.rowCount ===
                            0
                        ) {
                            throw new OrderRequestError(
                                "Saldo de fidelidade insuficiente para este prêmio."
                            );
                        }
                    }

                    const orderResult =
                        await client.query(
                            `
                                INSERT INTO orders (
                                    restaurant_id,
                                    status,
                                    subtotal_cents,
                                    delivery_cents,
                                    total_cents,
                                    customer_name,
                                    customer_phone,
                                    customer_address,
                                    delivery_eta,
                                    scheduled_for,
                                    payment_method,
                                    is_delivery,
                                    loyalty_points_used
                                )
                                VALUES (
                                    $1,
                                    $2,
                                    $3,
                                    $4,
                                    $5,
                                    $6,
                                    $7,
                                    $8,
                                    $9,
                                    $10,
                                    $11,
                                    $12,
                                    $13
                                )
                                RETURNING id
                            `,
                            [
                                restaurantId,
                                orderStatus,
                                subtotal,
                                safeDeliveryFeeCents,
                                total,
                                customer_name ?? null,
                                customer_phone ?? null,
                                isPickup
                                    ? null
                                    : customer_address ??
                                      null,
                                eta,
                                scheduledFor,
                                paymentMethod,
                                isPickup
                                    ? "retirada"
                                    : is_delivery ??
                                      null,
                                pointsToDeduct,
                            ]
                        );

                    const orderId =
                        orderResult.rows[0].id;

                    for (const cartItem of items) {
                        const itemId =
                            getCartItemId(cartItem);
                        const selectedSubitems =
                            getSelectedSubitems(
                                cartItem
                            );
                        const isRewardItem =
                            rewardItem === cartItem;

                        const orderItemResult =
                            await client.query(
                                `
                                    INSERT INTO order_items (
                                        order_id,
                                        item_id,
                                        name,
                                        price_cents,
                                        quantity,
                                        observation,
                                        total_cents,
                                        original_value
                                    )
                                    VALUES (
                                        $1,
                                        $2,
                                        $3,
                                        $4,
                                        $5,
                                        $6,
                                        $7,
                                        $8
                                    )
                                    RETURNING id
                                `,
                                [
                                    orderId,
                                    itemId,
                                    cartItem.name,
                                    isRewardItem
                                        ? 0
                                        : promotionPrice(
                                              cartItem,
                                              false
                                          ) ||
                                          Number(
                                              cartItem.unit_price_cents
                                          ) ||
                                          0,
                                    Number(
                                        cartItem.qty
                                    ),
                                    cartItem.observation ??
                                        null,
                                    isRewardItem
                                        ? 0
                                        : promotionPrice(
                                              cartItem
                                          ) ||
                                          Number(
                                              cartItem.total_cents
                                          ) ||
                                          0,
                                    isRewardItem
                                        ? 0
                                        : Number(
                                              cartItem.unit_price_cents
                                          ) ||
                                          0,
                                ]
                            );

                        const orderItemId =
                            orderItemResult.rows[0].id;

                        for (const subitem of selectedSubitems) {
                            const subitemId = String(
                                subitem?.subitemId ||
                                    ""
                            );

                            if (!subitemId) {
                                throw new OrderRequestError(
                                    "Um complemento do pedido não foi identificado."
                                );
                            }

                            await client.query(
                                `
                                    INSERT INTO order_item_subitems (
                                        order_item_id,
                                        subitem_id,
                                        name,
                                        price_cents,
                                        quantity
                                    )
                                    VALUES (
                                        $1,
                                        $2,
                                        $3,
                                        $4,
                                        1
                                    )
                                `,
                                [
                                    orderItemId,
                                    subitemId,
                                    subitem.subitemName,
                                    isRewardItem
                                        ? 0
                                        : Number(
                                              subitem.price_cents
                                          ) ||
                                          0,
                                ]
                            );
                        }

                        const lockedItem =
                            lockedItems.get(itemId);

                        if (
                            lockedItem?.stock_enabled ===
                            true
                        ) {
                            await client.query(
                                `
                                    UPDATE items
                                    SET
                                        stock_quantity =
                                            GREATEST(
                                                stock_quantity -
                                                    $1,
                                                0
                                            ),
                                        is_available =
                                            CASE
                                                WHEN
                                                    stock_quantity -
                                                        $1 <=
                                                    0
                                                    THEN false
                                                ELSE
                                                    is_available
                                            END
                                    WHERE id = $2
                                `,
                                [
                                    Number(
                                        cartItem.qty
                                    ),
                                    itemId,
                                ]
                            );
                        }
                    }

                    const restaurantResult =
                        await client.query(
                            `
                                SELECT url_slug
                                FROM restaurants
                                WHERE id = $1
                            `,
                            [restaurantId]
                        );

                    return {
                        orderId,
                        slug:
                            restaurantResult.rows[0]
                                ?.url_slug,
                    };
                }
            );

        const {
            orderId,
            slug,
        } = transactionResult;

        if (!isOnlinePix) {
            return NextResponse.json({
                order_id: orderId,
                payment_type: "offline",
                redirect: `/${slug}/${orderId}`,
            });
        }

        let payment;

        try {
            payment = await createPayZuPixCharge({
                amount: total / 100,
                callbackUrl: new URL(
                    "/api/webhooks/payzu",
                    request.url
                ).toString(),
                clientReference: orderId.toString(),
            });
        } catch (paymentError) {
            try {
                await cancelUnpaidOnlineOrder(
                    orderId
                );
            } catch (compensationError) {
                console.error(
                    "[FIDELIDADE] Falha ao restaurar pedido após erro no PIX:",
                    compensationError
                );
            }

            throw paymentError;
        }

        const pixQrBase64 =
            payment.qrCodeBase64 ?? null;
        const pixCopyPaste =
            payment.qrCodeText ?? null;

        await query(
            `
                UPDATE orders
                SET
                    payment_ref = $1,
                    pix_qr_base64 = $2,
                    pix_copia_cola = $3
                WHERE id = $4
            `,
            [
                payment.id?.toString() ?? null,
                pixQrBase64,
                pixCopyPaste,
                orderId,
            ]
        );

        return NextResponse.json({
            id: orderId,
            payment_type: "pix",
        });
    } catch (error) {
        console.error(
            "[ORDERS] Falha ao criar pedido:",
            error
        );

        if (error instanceof OrderRequestError) {
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
                        : "Erro interno",
            },
            { status: 500 }
        );
    }
}
