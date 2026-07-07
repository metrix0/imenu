// app/api/orders/[id]/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";

// ================================
// GET — returns order + items + subitems
// ================================
export async function GET(
    _: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;

        // --------------------------
        // 1) Load order
        // --------------------------
        const { rows: [order] } = await query(
            `
    SELECT 
        id,
        status,
        subtotal_cents,
        delivery_cents,
        total_cents,
        delivery_eta,
        payment_method,
        is_delivery,
        customer_name,
        customer_phone,
        customer_address,
        restaurant_id,
        created_at,
        payment_ref,
        pix_qr_base64,
        pix_copia_cola
    FROM orders
    WHERE id = $1
    `,
            [id]
        );

        if (!order) {
            return NextResponse.json({ error: "Not found" }, { status: 404 });
        }

        // --------------------------
        // 2) Load items
        // --------------------------
        const { rows: orderItems } = await query(
            `
            SELECT
                oi.id,
                oi.item_id,
                oi.name,
                oi.price_cents,
                oi.quantity,
                oi.observation,
                oi.total_cents
            FROM order_items oi
            WHERE oi.order_id = $1
            ORDER BY oi.id ASC
            `,
            [id]
        );

        // --------------------------
        // 3) Load ALL subitems in one query
        // NOTE: use column 'name' from table and alias it to subitem_name
        // --------------------------
        const { rows: subitems } = await query(
            `
            SELECT
                ois.id,
                ois.order_item_id,
                ois.subitem_id,
                ois.name   AS subitem_name,
                ois.price_cents
            FROM order_item_subitems ois
            WHERE ois.order_item_id IN (
                SELECT id FROM order_items WHERE order_id = $1
            )
            ORDER BY ois.order_item_id ASC
            `,
            [id]
        );

        // --------------------------
        // 4) Attach subitems → items
        // --------------------------
        const itemsWithSubitems = orderItems.map((item) => ({
            ...item,
            subitems: subitems.filter((s) => s.order_item_id === item.id),
        }));

        // --------------------------
        // RETURN full order object
        // --------------------------
        return NextResponse.json({
            ...order,
            items: itemsWithSubitems,
        });
    } catch (err: any) {
        console.error("❌ FATAL /api/orders/[id] GET:", err);
        return NextResponse.json(
            { error: err.message ?? "Internal error" },
            { status: 500 }
        );
    }
}

// ================================
// PATCH — delivery_eta + total_cents support
// ================================
export async function PATCH(
    req: Request,
    context: { params: Promise<{ id: string }> }
) {
    const { id } = await context.params;
    const body = await req.json();

    const allowedFields: { [key: string]: string } = {
        status: "status",
        customer_name: "customer_name",
        customer_phone: "customer_phone",
        customer_address: "customer_address",
        delivery_cents: "delivery_cents",
        total_cents: "total_cents",
        delivery_eta: "delivery_eta",
        is_delivery: "is_delivery",
        user_id: "user_id",
    };

    const fieldsToUpdate: string[] = [];
    const values: any[] = [id]; // $1 = id
    let i = 2;

    for (const key in body) {
        if (allowedFields[key]) {
            let value = body[key];
            if (key.includes("_json")) value = JSON.stringify(value);

            fieldsToUpdate.push(`${allowedFields[key]} = $${i++}`);
            values.push(value);
        }
    }

    if (fieldsToUpdate.length === 0) {
        return NextResponse.json(
            { error: "Nenhum campo válido fornecido" },
            { status: 400 }
        );
    }

    try {
        await query(
            `UPDATE orders SET ${fieldsToUpdate.join(", ")} WHERE id = $1`,
            values
        );
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error(`Erro ao atualizar pedido ${id}:`, error);
        return NextResponse.json(
            { error: (error as Error).message },
            { status: 500 }
        );
    }
}
