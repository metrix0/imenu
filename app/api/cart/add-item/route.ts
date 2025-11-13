// app/api/cart/add-item/route.ts
import { query } from "@/lib/sql";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const {
        restaurantSlug,
        draftOrderId,
        item,
        quantity,
        subitemsPriceCents,
        descriptiveName,
        uniqueCartItemId,
        selectedSubitems,
    } = await req.json();

    if (!restaurantSlug || !item || !quantity) {
        return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }

    try {
        let orderId = draftOrderId;
        let restaurantId = null;

        // --- 1. Encontrar o Restaurante ---
        const { rows: restRows } = await query(
            `SELECT id FROM restaurants WHERE url_slug = $1`,
            [restaurantSlug]
        );
        if (restRows.length === 0) throw new Error("Restaurante não encontrado.");
        restaurantId = restRows[0].id;

        // --- 2. Garantir que temos um Pedido (Ordem) ---
        if (!orderId) {
            const { rows: newOrderRows } = await query(
                `INSERT INTO orders (restaurant_id, status, subtotal_cents, delivery_cents, total_cents)
                 VALUES ($1, 'pending_payment', 0, 0, 0)
                 RETURNING id`,
                [restaurantId]
            );
            if (newOrderRows.length === 0) throw new Error("Falha ao criar rascunho do pedido.");
            orderId = newOrderRows[0].id;
        }

        // --- 3. Adicionar o Item ao Pedido (CORRIGIDO) ---
        // Removemos 'image_path' da query
        const totalItemPrice = (item.price_cents + subitemsPriceCents);
        const { rows: newOrderItemRows } = await query(
            `INSERT INTO order_items (order_id, item_id, name, price_cents, quantity)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id`,
            [
                orderId,
                item.id, // O ID base do item (para buscar a imagem depois)
                descriptiveName,
                totalItemPrice,
                quantity
                // 'image_path' foi removido
            ]
        );
        if (newOrderItemRows.length === 0) throw new Error("Falha ao adicionar item ao pedido.");
        const newOrderItemId = newOrderItemRows[0].id;
        // --- FIM DA CORREÇÃO ---
        
        // (O restante do código, 'Salvar Subitens', 'Recalcular Total' e 'Retornar'
        // permanece o mesmo)
        // ... (Salvar Subitens)
        if (selectedSubitems && Object.keys(selectedSubitems).length > 0) {
             const subitemsToInsert: any[] = [];
             const valueChunks: string[] = [];
             let i = 1;
             for (const catId in selectedSubitems) {
                 const category = selectedSubitems[catId];
                 for (const subitemId in category) {
                     const qty = category[subitemId];
                     if (qty > 0) {
                         valueChunks.push(`($${i++}, $${i++}, $${i++})`);
                         subitemsToInsert.push(newOrderItemId, subitemId, qty);
                     }
                 }
             }
             if (subitemsToInsert.length > 0) {
                 await query(
                     `INSERT INTO order_item_subitems (order_item_id, subitem_id, quantity)
                      VALUES ${valueChunks.join(", ")}`,
                     subitemsToInsert
                 );
             }
         }
        // ... (Recalcular Total)
         const { rows: itemRows } = await query(
            `SELECT price_cents, quantity FROM order_items WHERE order_id = $1`,
            [orderId]
        );
         const newSubtotal = (itemRows || []).reduce((sum, it) => sum + (it.price_cents * it.quantity), 0);
         await query(
            `UPDATE orders SET subtotal_cents = $1, total_cents = $1 WHERE id = $2`,
            [newSubtotal, orderId]
        );
        // ... (Retornar)
        return NextResponse.json({ orderId: orderId, restaurantSlug: restaurantSlug });

    } catch (error) {
        console.error("Erro em /api/cart/add-item:", error);
        return NextResponse.json({ error: (error as Error).message }, { status: 500 });
    }
}