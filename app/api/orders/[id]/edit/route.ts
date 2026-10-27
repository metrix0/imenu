import { NextResponse } from "next/server";
import { withTransaction } from "@/lib/database/sql";
import { requireRestaurantOwner, RestaurantOwnerAuthError } from "@/lib/auth/restaurantOwner";
import { pricePizzaOrderItems } from "@/lib/pizza/orderPricing";
import { PizzaPricingError, pizzaStockItemIds } from "@/lib/pizza/pricing";
import { automaticOrderPricing, PromotionPricingError } from "@/lib/promotions/orderPricing";
import { promotionPrice } from "@/lib/utils/formatPrice";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

class EditOrderError extends Error {
    constructor(message: string, public status = 400) {
        super(message);
    }
}

export async function PUT(request: Request, context: { params: Promise<{ id: string }> }) {
    try {
        const { id } = await context.params;
        const body = await request.json().catch(() => null);
        const restaurantId = body?.restaurantId;
        if (!UUID.test(id) || typeof restaurantId !== "string" || !UUID.test(restaurantId)) {
            throw new EditOrderError("Pedido inválido.");
        }
        await requireRestaurantOwner(request, restaurantId);

        const requestedItems: any[] = body?.items;
        if (!Array.isArray(requestedItems) || requestedItems.length < 1 || requestedItems.length > 100) {
            throw new EditOrderError("Adicione ao menos um item válido.");
        }
        if (typeof body.customer_name !== "string" || !body.customer_name.trim()) {
            throw new EditOrderError("Informe o nome do cliente.");
        }
        const deliveryFee = Number(body.delivery_fee_cents);
        if (!Number.isSafeInteger(deliveryFee) || deliveryFee < 0 || deliveryFee > 10000000) {
            throw new EditOrderError("Taxa de entrega inválida.");
        }

        await withTransaction(async (client) => {
            const currentResult = await client.query(
                "SELECT * FROM orders WHERE id = $1 AND restaurant_id = $2 FOR UPDATE",
                [id, restaurantId]
            );
            const current = currentResult.rows[0];
            if (!current) throw new EditOrderError("Pedido não encontrado.", 404);
            if (current.status === "pending_online_payment") {
                throw new EditOrderError("Aguarde a confirmação do pagamento antes de editar este pedido.", 409);
            }
            if (current.coupon_code || Number(current.loyalty_points_used) > 0 || current.loyalty_credited) {
                throw new EditOrderError("Pedidos com cupom ou fidelidade não podem ser alterados por este editor.", 409);
            }

            const restaurant = (await client.query(
                "SELECT automatic_promotions, pizza_settings FROM restaurants WHERE id = $1",
                [restaurantId]
            )).rows[0];
            if (!restaurant) throw new EditOrderError("Restaurante não encontrado.", 404);

            const oldItems = (await client.query(
                "SELECT item_id, quantity, pizza FROM order_items WHERE order_id = $1",
                [id]
            )).rows;
            const previousStock = new Map<string, number>();
            for (const item of oldItems) {
                for (const stockId of pizzaStockItemIds(item)) {
                    previousStock.set(stockId, (previousStock.get(stockId) || 0) + Number(item.quantity));
                }
            }

            for (const item of requestedItems) {
                if (!UUID.test(String(item?.base_item_id || "")) ||
                    !Number.isInteger(item.qty) || item.qty < 1 || item.qty > 99 ||
                    !Array.isArray(item.selectedSubitems) || item.selectedSubitems.length > 100) {
                    throw new EditOrderError("Um item do pedido é inválido.");
                }
            }

            const itemIds = [...new Set(requestedItems.map(i => String(i.base_item_id)))];
            const products = (await client.query(
                "SELECT id, name, price_cents, is_available FROM items WHERE restaurant_id = $1 AND id = ANY($2::uuid[])",
                [restaurantId, itemIds]
            )).rows;
            if (products.length !== itemIds.length) throw new EditOrderError("Um produto não pertence mais ao restaurante.", 409);

            const subitemIds = [...new Set(requestedItems.flatMap(i => i.selectedSubitems.map((s: any) => String(s.subitemId))))];
            if (subitemIds.some(subId => !UUID.test(subId))) throw new EditOrderError("Complemento inválido.");
            const subitems = subitemIds.length ? (await client.query(
                "SELECT s.id, s.name, s.price_cents, s.is_available, g.item_id FROM subitems s JOIN item_subcategories g ON g.id = s.item_subcategory_id JOIN items i ON i.id = g.item_id WHERE i.restaurant_id = $1 AND s.id = ANY($2::uuid[])",
                [restaurantId, subitemIds]
            )).rows : [];

            let items = requestedItems.map((item) => {
                const product = products.find(p => p.id === item.base_item_id);
                if (!product) throw new EditOrderError("Produto indisponível.", 409);
                const selectedSubitems = item.selectedSubitems.map((entry: any) => {
                    const sub = subitems.find(s => s.id === entry.subitemId && s.item_id === product.id);
                    if (!sub || !sub.is_available) throw new EditOrderError("Um complemento não está disponível.", 409);
                    const quantity = Number(entry.quantity ?? 1);
                    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 99) {
                        throw new EditOrderError("Quantidade de complemento inválida.");
                    }
                    return {
                        subitemId: sub.id, subitemName: sub.name,
                        price_cents: Number(sub.price_cents), quantity
                    };
                });
                const extras = selectedSubitems.reduce((total: number, s: any) => total + s.price_cents * s.quantity, 0);
                const unit = Number(product.price_cents) + extras;
                return {
                    id: String(item.id || ""), base_item_id: product.id, name: product.name,
                    qty: item.qty, selectedSubitems, pizza: item.pizza || undefined,
                    unit_price_cents: item.pizza ? Number(item.unit_price_cents) : unit,
                    total_cents: item.pizza ? Number(item.total_cents) : unit * item.qty,
                    observation: typeof item.observation === "string" ? item.observation.slice(0, 140) : null,
                };
            });
            items = await pricePizzaOrderItems(client, restaurantId, restaurant.pizza_settings, items);

            const subtotal = items.reduce((sum: number, item: any) => sum + Number(item.total_cents), 0);
            const requestedTableId = body.table_id || null;
            let table: { id: string; name: string } | null = null;
            if (requestedTableId) {
                if (!UUID.test(String(requestedTableId))) throw new EditOrderError("Mesa inválida.");
                table = (await client.query(
                    "SELECT id, name FROM restaurant_tables WHERE id = $1 AND restaurant_id = $2 AND is_active = true",
                    [requestedTableId, restaurantId]
                )).rows[0] || null;
                if (!table) throw new EditOrderError("Mesa não encontrada.", 409);
            }
            const destination = table ? "mesa" : body.is_delivery === "balcao" ? "balcao" :
                body.is_delivery === "retirada" ? "retirada" : ["entrega", "delivery"].includes(body.is_delivery) ? body.is_delivery : null;
            const paidOnline = current.payment_method === "pix" || current.payment_method === "cartao";
            if (paidOnline && (destination !== current.is_delivery ||
                (table?.id || null) !== (current.table_id || null))) {
                throw new EditOrderError("O destino de pedidos pagos online não pode ser alterado.", 409);
            }
            const paymentMethod = table ? null : paidOnline ? current.payment_method : body.paymentMethod;
            if (!table && !paidOnline &&
                !["dinheiro", "trazer-maquininha", "pix-entrega"].includes(paymentMethod)) {
                throw new EditOrderError("Forma de pagamento inválida.");
            }
            const fee = destination === "mesa" || destination === "balcao" || destination === "retirada" ? 0 : deliveryFee;
            const pricing = await automaticOrderPricing(client, {
                restaurantId, promotions: restaurant.automatic_promotions,
                items, subtotal_cents: subtotal, delivery_cents: fee,
                coupon_discount_cents: 0, channel: table || destination === "balcao" ? "mesa" : "delivery",
                pickup: destination === "retirada", at: new Date(),
            });
            if (pricing.result.promotion) items = pricing.items;
            const finalSubtotal = pricing.result.promotion ? pricing.subtotal_cents : subtotal;
            const finalTotal = pricing.result.promotion ? pricing.result.total_cents : subtotal + fee;
            const expected = body.expected_promotion;
            if (!expected || Number(expected.total_cents) !== finalTotal ||
                (expected.id || null) !== (pricing.result.promotion?.id || null)) {
                throw new EditOrderError("Os preços ou promoções mudaram. Confira o pedido novamente.", 409);
            }
            if (paidOnline && finalTotal !== Number(current.total_cents)) {
                throw new EditOrderError("Não é possível alterar o valor de um pedido pago online. O pagamento original deve ser preservado.", 409);
            }

            const neededStock = new Map<string, number>();
            for (const item of items) {
                for (const stockId of pizzaStockItemIds(item)) {
                    neededStock.set(stockId, (neededStock.get(stockId) || 0) + Number(item.qty));
                }
            }
            const allStockIds = [...new Set([...previousStock.keys(), ...neededStock.keys()])].sort();
            for (const stockId of allStockIds) {
                const stock = (await client.query(
                    "SELECT stock_enabled, stock_quantity, is_available, name FROM items WHERE id = $1 AND restaurant_id = $2 FOR UPDATE",
                    [stockId, restaurantId]
                )).rows[0];
                if (!stock) throw new EditOrderError("Um produto não está mais disponível.", 409);
                const delta = (neededStock.get(stockId) || 0) - (previousStock.get(stockId) || 0);
                if (delta > 0 && !stock.is_available) throw new EditOrderError("Produto indisponível: " + stock.name, 409);
                if (stock.stock_enabled && delta > Number(stock.stock_quantity)) {
                    throw new EditOrderError("Estoque insuficiente para " + stock.name, 409);
                }
                if (stock.stock_enabled && delta !== 0) {
                    await client.query(
                        "UPDATE items SET stock_quantity = stock_quantity - $1, is_available = CASE WHEN stock_quantity - $1 <= 0 THEN false ELSE is_available END WHERE id = $2",
                        [delta, stockId]
                    );
                }
            }
            const customerPhone = typeof body.customer_phone === "string" ? body.customer_phone.trim() || null : null;
            const customerAddress = destination === "mesa" || destination === "balcao" || destination === "retirada"
                ? null : typeof body.customer_address === "string" ? body.customer_address.trim() || null : null;
            await client.query(
                "UPDATE orders SET customer_name = $1, customer_phone = $2, customer_address = $3, subtotal_cents = $4, delivery_cents = $5, total_cents = $6, coupon_discount_cents = $7, applied_promotion = $8::jsonb, is_delivery = $9, table_id = $10, table_name_snapshot = $11, payment_method = $12, updated_at = NOW() WHERE id = $13 AND restaurant_id = $14",
                [body.customer_name.trim(), destination === "mesa" ? null : customerPhone, customerAddress,
                    finalSubtotal, fee, finalTotal,
                    pricing.result.promotion ? pricing.result.discount_cents : null,
                    pricing.result.promotion ? JSON.stringify(pricing.result.promotion) : null,
                    destination, table?.id || null, table?.name || null, paymentMethod, id, restaurantId]
            );

            await client.query("DELETE FROM order_items WHERE order_id = $1", [id]);
            for (const item of items) {
                const saved = await client.query(
                    "INSERT INTO order_items (order_id, item_id, name, price_cents, quantity, observation, total_cents, original_value, pizza) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb) RETURNING id",
                    [id, item.base_item_id, item.name,
                        promotionPrice(item, false) || Number(item.unit_price_cents),
                        item.qty, item.observation,
                        promotionPrice(item) || Number(item.total_cents), Number(item.unit_price_cents),
                        item.pizza ? JSON.stringify(item.pizza) : null]
                );
                for (const sub of item.selectedSubitems) {
                    await client.query(
                        "INSERT INTO order_item_subitems (order_item_id, subitem_id, name, price_cents, quantity) VALUES ($1,$2,$3,$4,$5)",
                        [saved.rows[0].id, sub.subitemId, sub.subitemName, item.pizza ? 0 : sub.price_cents, sub.quantity]
                    );
                }
            }
        });
        return NextResponse.json({ ok: true });
    } catch (error) {
        const status = error instanceof RestaurantOwnerAuthError ? error.status :
            error instanceof EditOrderError ? error.status :
                error instanceof PromotionPricingError || error instanceof PizzaPricingError ? 409 : 500;
        if (status === 500) console.error("[ORDERS] Erro ao editar pedido:", error);
        return NextResponse.json(
            { error: status === 500 ? "Não foi possível editar o pedido." : (error as Error).message },
            { status }
        );
    }
}
