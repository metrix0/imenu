// app/api/orders/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { MercadoPagoConfig, Preference } from "mercadopago";
import {promotionPrice} from "@/lib/utils/formatPrice";
export const dynamic = "force-dynamic";

if (!process.env.MERCADO_PAGO_ACCESS_TOKEN)
    throw new Error("MERCADO_PAGO_ACCESS_TOKEN missing");

const client = new MercadoPagoConfig({
    accessToken: process.env.MERCADO_PAGO_ACCESS_TOKEN!,
});

export async function POST(req: Request) {
    console.log("📩 [ORDERS] Recebendo requisição...");

    let body: any = {};
    try {
        body = await req.json();
    } catch (err) {
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
            coupon_discount_cents,
        } = body;

        // 1. Log inicial para debug
        console.log(`📦 [ORDERS] Payload recebido. Itens: ${items?.length}`);
        
        if (!items?.length || !restaurantId || !paymentMethod) {
            return NextResponse.json({ error: "Incomplete fields" }, { status: 400 });
        }

        // 2. Cálculo de totais
        let subtotal = 0;
        console.log(items)
        console.log(items)
        console.log(items)
        items.forEach((item: any) => { subtotal += ((promotionPrice(item) || item.total_cents) || 0); });
        console.log(subtotal)
        console.log(subtotal)
        console.log(subtotal)
        console.log(subtotal)
        console.log(subtotal)

        const safeCouponDiscount = coupon_discount_cents && coupon_discount_cents > 0
                ? Math.min(coupon_discount_cents, subtotal)
                : 0;

        const total = subtotal + delivery_fee_cents - safeCouponDiscount;
        
        // ============================================================
        // 🕵️ 3. FIDELIDADE (DETECÇÃO AVANÇADA & DEBUG)
        // ============================================================
        let pointsToDeduce = 0;
        
        // A. Busca regras do programa
        const { rows: [prog] } = await query(
            `SELECT goal_count, reward_item_id FROM loyalty_programs WHERE restaurant_id = $1 AND active = true`,
            [restaurantId]
        );

        if (prog) {
            console.log(`🎯 [FIDELIDADE] Programa Ativo. ID do Prêmio no Banco: ${prog.reward_item_id}`);
        } else {
            console.log(`⚠️ [FIDELIDADE] Nenhum programa ativo encontrado para restaurant_id: ${restaurantId}`);
        }

        // B. Tenta encontrar o item de prêmio
        // Normalizamos os dados (String/Number) para evitar erros bobos de comparação
        let rewardItemRequest = items.find((i: any) => {
            const isFlagged = i.is_reward === true;
            
            // Fallback robusto: Checa se ID bate e Preço é Zero
            // Usa 'base_item_id' se 'item_id' não existir (caso o frontend mande diferente)
            const itemId = i.item_id || i.base_item_id;
            const isIdMatch = prog && String(itemId) === String(prog.reward_item_id);
            const isFree = Number(i.total_cents) === 0;

            if (isIdMatch && isFree) {
                console.log(`✅ [FIDELIDADE] Item detectado pelo ID+Preço! (${i.name})`);
                return true;
            }
            if (isFlagged) {
                console.log(`✅ [FIDELIDADE] Item detectado pela flag 'is_reward'! (${i.name})`);
                return true;
            }
            
            // Log para entender por que falhou nos outros itens
            if (isFree) {
                console.log(`ℹ️ [FIDELIDADE] Item grátis ignorado (ID não bate): Item=${itemId} vs Esperado=${prog?.reward_item_id}`);
            }

            return false;
        });

        if (rewardItemRequest) {
            console.log("🔒 [FIDELIDADE] Iniciando processo de dedução de pontos...");

            if (!prog) {
                return NextResponse.json({ error: "Programa de fidelidade inativo." }, { status: 400 });
            }

            if (!customer_phone) {
                return NextResponse.json({ error: "Telefone necessário para resgate." }, { status: 400 });
            }
            const cleanPhone = customer_phone.replace(/\D/g, "");

            // Validação final de segurança
            const reqItemId = rewardItemRequest.item_id || rewardItemRequest.base_item_id;
            if (String(prog.reward_item_id) !== String(reqItemId)) {
                console.error(`🛑 [FIDELIDADE] Erro de Segurança: ID ${reqItemId} não é o prêmio oficial.`);
                return NextResponse.json({ error: "Item inválido para resgate." }, { status: 400 });
            }

            pointsToDeduce = prog.goal_count;

            // C. DEDUÇÃO NO BANCO
            const deductionResult = await query(
                `UPDATE loyalty_balances 
                 SET current_count = current_count - $1
                 WHERE restaurant_id = $2 
                   AND customer_phone = $3 
                   AND current_count >= $1`,
                [pointsToDeduce, restaurantId, cleanPhone]
            );

            if (deductionResult.rowCount === 0) {
                console.error(`🛑 [FIDELIDADE] Falha na dedução. Saldo insuficiente ou telefone não encontrado. Phone: ${cleanPhone}`);
                return NextResponse.json({ 
                    error: "Saldo de fidelidade insuficiente para este prêmio." 
                }, { status: 400 });
            }

            console.log(`✅ [FIDELIDADE] SUCESSO! ${pointsToDeduce} pontos deduzidos.`);
        } else {
            console.log("🤷‍♂️ [FIDELIDADE] Nenhum item de recompensa identificado neste pedido.");
        }

        // ============================================================
        // 4. CRIAÇÃO DO PEDIDO
        // ============================================================
        const deliveryTime = delivery_time_minutes ?? 40;
        const eta = new Date(Date.now() + deliveryTime * 60000);

        const isOfflinePayment = paymentMethod === "dinheiro" || paymentMethod === "trazer-maquininha";
        const orderStatus = isOfflinePayment ? "pending_physical_payment" : "pending_online_payment";

        const { rows: [order] } = await query<{ id: string }>(
            `INSERT INTO orders (
                restaurant_id, status, subtotal_cents, delivery_cents, total_cents,
                customer_name, customer_phone, customer_address, delivery_eta, payment_method,
                loyalty_points_used
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10, $11) RETURNING id`,
            [
                restaurantId, orderStatus, subtotal, delivery_fee_cents, total,
                customer_name ?? null, customer_phone ?? null, customer_address ?? null,
                eta, paymentMethod,
                pointsToDeduce // Salva no histórico
            ]
        );

        // 5. INSERÇÃO DE ITENS
        for (const cartItem of items) {
            // Garante que temos um item_id (fallback para base_item_id se necessário)
            const finalItemId = cartItem.item_id || cartItem.base_item_id;

            const { rows: [oi] } = await query(
                `INSERT INTO order_items (order_id, item_id, name, price_cents, quantity, observation, total_cents, original_value)
                 VALUES ($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
                [order.id, finalItemId, cartItem.name, (promotionPrice(cartItem, false) ||  cartItem.unit_price_cents), cartItem.qty, cartItem.observation ?? null, (promotionPrice(cartItem) ||  cartItem.total_cents), cartItem.unit_price_cents]
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

        if (isOfflinePayment) {
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
                items: items.map((s: any) => ({
                    id: s.item_id || s.base_item_id,
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

        await query(`UPDATE orders SET payment_ref = $1 WHERE id = $2`, [preference.id ?? null, order.id]);

        return NextResponse.json({
            order_id: order.id,
            init_point: preference.init_point || preference.sandbox_init_point,
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
