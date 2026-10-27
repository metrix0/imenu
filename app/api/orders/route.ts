import { readCookie, checkoutCookie, structuredAddress, trustCustomer, trustedPhone } from "@/lib/services/checkoutCustomer";
import { normalizeCustomerPhone } from "@/lib/services/crmRules";
// app/api/orders/route.ts
import { after, NextResponse } from "next/server";

import {
    query,
    withTransaction,
} from "@/lib/database/sql";
import { createMercadoPagoPixCharge } from "@/lib/payments/mercadoPagoPix";
import { automaticOrderPricing, PromotionPricingError } from "@/lib/promotions/orderPricing";
import { pricePizzaOrderItems } from "@/lib/pizza/orderPricing";
import { PizzaPricingError, pizzaStockItemIds } from "@/lib/pizza/pricing";
import type { AppliedPromotion } from "@/lib/promotions/automatic";
import { promotionPrice } from "@/lib/utils/formatPrice";
import { notifyOrderReady } from "@/lib/push/server";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";

export const dynamic = "force-dynamic";

class OrderRequestError extends Error {
    status: number;
    details?: Record<string, unknown>;

    constructor(
        message: string,
        status = 400,
        details?: Record<string, unknown>
    ) {
        super(message);
        this.name = "OrderRequestError";
        this.status = status;
        this.details = details;
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
                    SELECT item_id, quantity, pizza
                    FROM order_items
                    WHERE order_id = $1
                `,
                [orderId]
            );

        for (const orderItem of orderItemsResult.rows) {
            for (const stockItemId of pizzaStockItemIds(orderItem)) {
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
                    stockItemId,
                ]
            );
            }
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
        const stockCheckOnly =
            new URL(request.url).searchParams.get("stock_check") === "1";

        const {
            restaurantId,
            customer_name,
            customer_phone,
            customer_address,
            items: requestedItems,
            delivery_fee_cents,
            delivery_time_minutes,
            paymentMethod,
            coupon_id,
            coupon_code,
            coupon_discount_cents,
            coupon_type,
            is_delivery,
            scheduled_for,
            table_token,
            table_id,
            expected_promotion,
            panel_order,
        } = body;

        let items = requestedItems;
        let appliedPromotion: AppliedPromotion | null = null;
        let promotionCouponDiscount: number | null = null;

        const isTableOrder =
            String(is_delivery || "").toLowerCase() === "mesa";
        const isCounterOrder = is_delivery === "balcao";

        if (
            !Array.isArray(items) ||
            items.length === 0 ||
            !restaurantId ||
            (!isTableOrder && !paymentMethod)
        ) {
            throw new OrderRequestError(
                "Campos obrigatórios incompletos."
            );
        }

        if (isTableOrder && !String(customer_name || "").trim()) {
            throw new OrderRequestError("Informe seu nome.");
        }

        if (panel_order === true) {
            await requireRestaurantOwner(request, restaurantId);
        }

        if (stockCheckOnly) {
            const requestedQuantities = new Map<string, number>();

            for (const cartItem of items) {
                const requestedQuantity = Number(cartItem?.qty);

                if (
                    !Number.isInteger(requestedQuantity) ||
                    requestedQuantity <= 0
                ) {
                    throw new OrderRequestError(
                        `Quantidade inválida para ${
                            cartItem?.name || "um item"
                        }.`
                    );
                }

                for (const stockItemId of pizzaStockItemIds(cartItem)) {
                    if (!stockItemId) {
                        throw new OrderRequestError(
                            "Um item do pedido não foi identificado."
                        );
                    }

                    requestedQuantities.set(
                        stockItemId,
                        (requestedQuantities.get(stockItemId) || 0) +
                            requestedQuantity
                    );
                }
            }

            for (const [itemId, requestedQuantity] of requestedQuantities) {
                const itemResult = await query(
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
                        LIMIT 1
                    `,
                    [itemId]
                );
                const databaseItem = itemResult.rows[0];

                if (
                    !databaseItem ||
                    String(databaseItem.restaurant_id) !==
                        String(restaurantId)
                ) {
                    throw new OrderRequestError(
                        "Um item não pertence a este restaurante."
                    );
                }

                const availableStock =
                    Number(databaseItem.stock_quantity) || 0;

                if (
                    databaseItem.stock_enabled === true &&
                    availableStock < requestedQuantity
                ) {
                    throw new OrderRequestError(
                        `Estoque insuficiente para ${databaseItem.name}.`,
                        409,
                        {
                            code: "INSUFFICIENT_STOCK",
                            item_name: databaseItem.name,
                            available_stock: availableStock,
                            requested_quantity: requestedQuantity,
                        }
                    );
                }

                if (databaseItem.is_available === false) {
                    throw new OrderRequestError(
                        `${databaseItem.name} não está disponível.`,
                        409
                    );
                }
            }

            return NextResponse.json({ ok: true });
        }

        const uuidPattern =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        const tableToken = String(table_token || "").trim();
        const selectedTableId = table_id ? String(table_id).trim() : null;
        if (
            isTableOrder &&
            (!uuidPattern.test(tableToken) ||
                (selectedTableId !== null &&
                    !uuidPattern.test(selectedTableId)))
        ) {
            throw new OrderRequestError("QR Code de mesa inválido.");
        }

        const preorderSettings = !isTableOrder
            ? (await query(
                "SELECT preorder_only, preorder_availability_json, preorder_min_days, delivery_disabled FROM public.restaurants WHERE id = $1 LIMIT 1",
                [restaurantId]
            )).rows[0]
            : null;
        if (preorderSettings?.delivery_disabled === true && is_delivery !== "retirada" && !isCounterOrder) {
            throw new OrderRequestError("Este restaurante aceita apenas retiradas.");
        }
        if (preorderSettings?.preorder_only === true && !scheduled_for && panel_order !== true) {
            throw new OrderRequestError("É obrigatório agendar a data e o horário da encomenda.");
        }

        let scheduledFor: Date | null = null;
        if (!isTableOrder && scheduled_for) {
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

        if (preorderSettings?.preorder_only === true && scheduledFor) {
            // Validate the same weekly schedule and minimum advance days used by the checkout.
            const timeFormatter = new Intl.DateTimeFormat("en-US", {
                timeZone: "America/Sao_Paulo",
                weekday: "short",
                year: "numeric",
                month: "2-digit",
                day: "2-digit",
                hour: "2-digit",
                minute: "2-digit",
                hourCycle: "h23",
            });
            const zonedParts = (date: Date) =>
                Object.fromEntries(timeFormatter.formatToParts(date).map(({ type, value }) => [type, value]));
            const nowParts = zonedParts(new Date());
            const scheduledParts = zonedParts(scheduledFor);
            const dateDay = (parts: Record<string, string>) =>
                Date.UTC(Number(parts.year), Number(parts.month) - 1, Number(parts.day));
            const daysAhead = (dateDay(scheduledParts) - dateDay(nowParts)) / 86_400_000;
            if (daysAhead < preorderSettings.preorder_min_days) {
                throw new OrderRequestError("A data não respeita a antecedência mínima para encomendas.");
            }

            const weekDay = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]
                .indexOf(scheduledParts.weekday);
            const requestedMinutes = Number(scheduledParts.hour) * 60 + Number(scheduledParts.minute);
            const windows = preorderSettings.preorder_availability_json?.[String(weekDay)];
            const minuteValue = (time: string) => {
                const parts = /^(\d{2}):(\d{2})$/.exec(time);
                if (!parts) return -1;
                return Number(parts[1]) * 60 + Number(parts[2]);
            };
            const validSlot = Array.isArray(windows) && windows.some((slot: { open?: string; close?: string }) => {
                const start = minuteValue(String(slot.open ?? ""));
                const end = slot.close === "00:00" || slot.close === "24:00"
                    ? 1439
                    : minuteValue(String(slot.close ?? ""));
                return start >= 0 && end >= start && requestedMinutes >= start &&
                    requestedMinutes <= end && (requestedMinutes - start) % 15 === 0;
            });
            if (!validSlot) {
                throw new OrderRequestError("Horário indisponível para encomendas. Selecione outro horário.");
            }
        }

        const isPickup =
            isTableOrder || is_delivery === "retirada";
        const safeDeliveryFeeCents = isPickup || isCounterOrder
            ? 0
            : Math.max(
                  Number(delivery_fee_cents) || 0,
                  0
              );

        let subtotal = items.reduce(
            (totalValue: number, item: any) =>
                totalValue +
                (promotionPrice(item) ||
                    Number(item?.total_cents) ||
                    0),
            0
        );

        let safeCouponDiscount = isTableOrder
            ? 0
            : coupon_type === "delivery" &&
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

        let total = Math.max(
            subtotal +
                safeDeliveryFeeCents -
                safeCouponDiscount,
            0
        );

        const programResult = isTableOrder
            ? { rows: [] }
            : await query(
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

        const deliveryTime = isTableOrder || isCounterOrder
            ? 0
            : Math.max(Number(delivery_time_minutes) || 40, 0);
        const eta = scheduledFor ?? new Date(
            Date.now() +
                deliveryTime * 60_000
        );
        let isOnlinePix = !isTableOrder &&
            paymentMethod === "pix" &&
            total > 0;
        let orderStatus = isOnlinePix
            ? "pending_online_payment"
            : "pending_physical_payment";

        const transactionResult =
            await withTransaction(
                async (client) => {
                    let validatedTable: {
                        id: string;
                        name: string;
                    } | null = null;

                    if (isTableOrder) {
                        const tableResult = await client.query(
                            `
                                SELECT table_entry.id, table_entry.name
                                FROM public.restaurant_tables AS table_entry
                                WHERE table_entry.restaurant_id = $1
                                  AND table_entry.is_active = true
                                  AND (
                                        (
                                            table_entry.id = $3::uuid
                                            AND (
                                                EXISTS (SELECT 1 FROM public.restaurant_qr_settings qr
                                                    WHERE qr.restaurant_id=$1 AND qr.universal_token=$2::uuid)
                                                OR EXISTS (SELECT 1 FROM public.restaurant_addons legacy
                                                    WHERE legacy.restaurant_id=$1
                                                      AND legacy.product_key IN ('qr_code_mesa','ia_plus')
                                                      AND legacy.universal_token=$2::uuid)
                                            )
                                        )
                                     OR (
                                            table_entry.public_token = $2::uuid
                                            AND (
                                                $3::uuid IS NULL
                                                OR table_entry.id = $3::uuid
                                            )
                                        )
                                  )
                                LIMIT 1
                            `,
                            [restaurantId, tableToken, selectedTableId]
                        );

                        validatedTable = tableResult.rows[0] || null;
                        if (!validatedTable) {
                            throw new OrderRequestError(
                                "Mesa inválida ou QR Code inativo."
                            );
                        }
                    }

                    const restaurantResult = await client.query(
                        "SELECT url_slug, automatic_promotions, pizza_settings FROM restaurants WHERE id = $1",
                        [restaurantId]
                    );
                    if (!restaurantResult.rows[0]) throw new OrderRequestError("Restaurante não encontrado.");
                    if (items.some((item: any) => item.pizza != null)) {
                        items = await pricePizzaOrderItems(client, restaurantId, restaurantResult.rows[0].pizza_settings, items);
                        subtotal = items.reduce((sum: number, item: any) => sum + (promotionPrice(item) || Number(item.total_cents) || 0), 0);
                        safeCouponDiscount = Math.min(safeCouponDiscount, subtotal);
                        total = Math.max(0, subtotal + safeDeliveryFeeCents - safeCouponDiscount);
                        isOnlinePix = !isTableOrder && paymentMethod === "pix" && total > 0;
                        orderStatus = isOnlinePix ? "pending_online_payment" : "pending_physical_payment";
                    }
                    const pricing = await automaticOrderPricing(client, {
                        restaurantId, promotions: restaurantResult.rows[0].automatic_promotions,
                        items: items.map((item: any) => item === rewardItem ? Object.assign(item, { is_reward: true }) : item),
                        subtotal_cents: subtotal, delivery_cents: safeDeliveryFeeCents,
                        coupon_discount_cents: safeCouponDiscount, coupon_type,
                        channel: isTableOrder || isCounterOrder ? "mesa" : "delivery", pickup: isPickup,
                        at: scheduledFor ?? new Date(),
                    });
                    if (expected_promotion && (pricing.result.promotion || expected_promotion.id) && (
                        expected_promotion.id !== (pricing.result.promotion?.id || null) ||
                        expected_promotion.total_cents !== pricing.result.total_cents
                    )) throw new OrderRequestError("A promoção ou os preços mudaram. Atualize a sacola e confira o total antes de confirmar novamente.", 409);
                    if (pricing.result.promotion) {
                        items = pricing.items;
                        subtotal = pricing.subtotal_cents;
                        appliedPromotion = pricing.result.promotion;
                        promotionCouponDiscount = pricing.result.coupon_discount_cents;
                        // Legacy printers read this field as the total discount.
                        // applied_promotion keeps the automatic/coupon breakdown.
                        safeCouponDiscount = pricing.result.discount_cents;
                        total = pricing.result.total_cents;
                        isOnlinePix = !isTableOrder && paymentMethod === "pix" && total > 0;
                        orderStatus = isOnlinePix ? "pending_online_payment" : "pending_physical_payment";
                    }

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

                        for (const stockItemId of pizzaStockItemIds(cartItem)) {
                            requestedQuantities.set(stockItemId, (requestedQuantities.get(stockItemId) || 0) + requestedQuantity);
                        }
                    }

                    for (const [
                        itemId,
                        requestedQuantity,
                    ] of [...requestedQuantities].sort(([a], [b]) => a.localeCompare(b))) {
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

                        const availableStock =
                            Number(
                                databaseItem.stock_quantity
                            ) || 0;

                        if (
                            databaseItem.stock_enabled ===
                                true &&
                            availableStock <
                                requestedQuantity
                        ) {
                            throw new OrderRequestError(
                                `Estoque insuficiente para ${databaseItem.name}.`,
                                409,
                                {
                                    code: "INSUFFICIENT_STOCK",
                                    item_name: databaseItem.name,
                                    available_stock: availableStock,
                                    requested_quantity: requestedQuantity,
                                }
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
                                    loyalty_points_used,
                                    coupon_id,
                                    coupon_code,
                                    coupon_discount_cents,
                                    table_id,
                                    table_name_snapshot,
                                    applied_promotion
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
                                    $13,
                                    $14,
                                    $15,
                                    $16,
                                    $17,
                                    $18,
                                    $19::jsonb
                                )
                                RETURNING id
                            `,
                            [
                                restaurantId,
                                orderStatus,
                                subtotal,
                                safeDeliveryFeeCents,
                                total,
                                String(customer_name || "").trim() || null,
                                isTableOrder ? null : customer_phone ?? null,
                                isPickup || isCounterOrder
                                    ? null
                                    : customer_address ??
                                      null,
                                eta,
                                scheduledFor,
                                isTableOrder ? null : paymentMethod,
                                isTableOrder
                                    ? "mesa"
                                    : isCounterOrder
                                      ? "balcao"
                                    : isPickup
                                      ? "retirada"
                                    : is_delivery ??
                                      null,
                                pointsToDeduct,
                                isTableOrder || promotionCouponDiscount === 0 ? null : coupon_id ?? null,
                                isTableOrder || promotionCouponDiscount === 0 ? null : coupon_code ?? null,
                                safeCouponDiscount > 0
                                    ? safeCouponDiscount
                                    : null,
                                validatedTable?.id ?? null,
                                validatedTable?.name ?? null,
                                appliedPromotion ? JSON.stringify(appliedPromotion) : null,
                            ]
                        );

                    const orderId =
                        orderResult.rows[0].id;

                    const crmPhone = normalizeCustomerPhone(customer_phone);
                    const crmAddress = isPickup || isCounterOrder || isTableOrder ? null : structuredAddress(body.customer_address_details);
                    if (crmPhone && !isTableOrder) {
                        await client.query(`UPDATE customers SET address=coalesce($3::jsonb,address), marketing_consent=marketing_consent OR $4::boolean,updated_at=now() WHERE restaurant_id=$1 AND phone=$2`,[restaurantId,crmPhone,crmAddress ? JSON.stringify(crmAddress) : null,body.marketing_consent===true]);
                    }
                    const crmSession = readCookie(request,checkoutCookie(restaurantId));
                    if (/^[0-9a-f-]{36}$/i.test(crmSession)) {
                        await client.query(`UPDATE checkout_sessions SET order_id=$1,completed_at=now(),items='[]',updated_at=now() WHERE id=$2 AND restaurant_id=$3 AND completed_at IS NULL`,[orderId,crmSession,restaurantId]);
                    }

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
                                        original_value,
                                        pizza
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
                                        $9::jsonb
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
                                    cartItem.pizza ? JSON.stringify(cartItem.pizza) : null,
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

                            const subitemQuantity = isRewardItem
                                ? 1
                                : Math.max(
                                      1,
                                      Math.min(
                                          99,
                                          Math.round(
                                              Number(subitem?.quantity) || 1
                                          )
                                      )
                                  );

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
                                        (SELECT id FROM subitems WHERE id = $2),
                                        $3,
                                        $4,
                                        $5
                                    )
                                `,
                                [
                                    orderItemId,
                                    subitemId,
                                    subitem.subitemName,
                                    isRewardItem || cartItem.pizza
                                        ? 0
                                        : Number(
                                              subitem.price_cents
                                          ) ||
                                          0,
                                    subitemQuantity,
                                ]
                            );
                        }

                        for (const stockItemId of pizzaStockItemIds(cartItem)) {
                        const lockedItem =
                            lockedItems.get(stockItemId);

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
                                    stockItemId,
                                ]
                            );
                        }
                        }
                    }

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
            after(async () => {
                try {
                    await notifyOrderReady(orderId);
                } catch (error) {
                    console.error("[ORDERS] Failed to send owner push:", error);
                }
            });
            return trustCustomer(NextResponse.json({
                order_id: orderId,
                payment_type: "offline",
                redirect: `/${slug}/${orderId}`,
            }),restaurantId,customer_phone,trustedPhone(request,restaurantId)===normalizeCustomerPhone(customer_phone) ? undefined : {name:String(customer_name || "").slice(0,100),address:structuredAddress(body.customer_address_details)});
        }

        let payment;

        try {
            payment = await createMercadoPagoPixCharge({
                amount: total / 100,
                notificationUrl: new URL(
                    "/api/webhooks/mercadopago",
                    process.env.NEXT_PUBLIC_BASE_URL || request.url
                ).toString(),
                externalReference: orderId.toString(),
                payerName: customer_name ?? null,
                payerEmail: `cliente_${orderId}@fake.com`,
                idempotencyKey: orderId.toString(),
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

        return trustCustomer(NextResponse.json({
            id: orderId,
            payment_type: "pix",
        }),restaurantId,customer_phone,trustedPhone(request,restaurantId)===normalizeCustomerPhone(customer_phone) ? undefined : {name:String(customer_name || "").slice(0,100),address:structuredAddress(body.customer_address_details)});
    } catch (error) {
        console.error(
            "[ORDERS] Falha ao criar pedido:",
            error
        );

        if (error instanceof PizzaPricingError) {
            return NextResponse.json({ error: error.message }, { status: 409 });
        }
        if (error instanceof PromotionPricingError) {
            return NextResponse.json({ error: error.message }, { status: 400 });
        }
        if (error instanceof RestaurantOwnerAuthError) {
            return NextResponse.json({ error: error.message }, { status: error.status });
        }
        if (error instanceof OrderRequestError) {
            return NextResponse.json(
                {
                    error: error.message,
                    ...(error.details || {}),
                },
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
