import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";

function formatMoney(value: unknown): string {
    const cents = Number(value);
    const safeCents = Number.isFinite(cents) ? cents : 0;

    return `R$ ${(safeCents / 100).toFixed(2).replace(".", ",")}`;
}

function formatDateTime(value: unknown): string {
    const date = new Date(String(value ?? ""));
    if (Number.isNaN(date.getTime())) return "";

    return new Intl.DateTimeFormat("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
    }).format(date);
}

function normalizeWhatsAppPhone(value: unknown): string {
    const digits = String(value ?? "").replace(/\D/g, "");
    if (!digits) return "";

    if (
        digits.startsWith("55") &&
        (digits.length === 12 || digits.length === 13)
    ) {
        return digits;
    }

    if (digits.length === 10 || digits.length === 11) {
        return `55${digits}`;
    }

    return "";
}

function isTableOrder(value: unknown): boolean {
    return String(value ?? "").trim().toLowerCase() === "mesa";
}

function isPickupOrder(value: unknown): boolean {
    const normalized = String(value ?? "").trim().toLowerCase();
    return ["retirada", "pickup", "balcao", "balcão", "false", "0"].includes(
        normalized,
    );
}

function paymentLabel(value: unknown): string {
    const method = String(value ?? "");
    const labels: Record<string, string> = {
        dinheiro: "Dinheiro",
        "pix-entrega": "Pix na entrega",
        "trazer-maquininha": "Maquininha",
        pix: "Pix (pago online)",
        cartao: "Cartão (pago online)",
    };

    return labels[method] ?? method;
}

type OrderRow = {
    id: string;
    display_id: number | null;
    created_at: string;
    scheduled_for: string | null;
    customer_name: string | null;
    customer_phone: string | null;
    customer_address: string | null;
    payment_method: string | null;
    status: string;
    is_delivery: string | boolean | null;
    table_name_snapshot: string | null;
    subtotal_cents: number | null;
    delivery_cents: number | null;
    coupon_discount_cents: number | null;
    total_cents: number | null;
    store_whatsapp: string | null;
    restaurant_phone: string | null;
    force_whatsapp_order_confirmation: boolean;
};

type OrderItemRow = {
    id: string;
    name: string;
    quantity: number;
    observation: string | null;
    price_cents: number | null;
    total_cents: number | null;
};

type SubitemRow = {
    order_item_id: string;
    name: string;
    quantity: number;
    price_cents: number | null;
};

function buildComanda(
    order: OrderRow,
    items: OrderItemRow[],
    subitems: SubitemRow[],
): string {
    const tableOrder = isTableOrder(order.is_delivery);
    const pickup = isPickupOrder(order.is_delivery);
    const separator = "--------------------------------";
    const subitemsByOrderItem = new Map<string, SubitemRow[]>();

    for (const subitem of subitems) {
        const current = subitemsByOrderItem.get(subitem.order_item_id) || [];
        current.push(subitem);
        subitemsByOrderItem.set(subitem.order_item_id, current);
    }

    const lines: string[] = [
        `🧾 *PEDIDO #${order.display_id ?? order.id.slice(0, 8).toUpperCase()}*`,
    ];

    if (order.scheduled_for) {
        const scheduledLabel = formatDateTime(order.scheduled_for);
        if (scheduledLabel) {
            lines.push(
                separator,
                "📅 *AGENDADO*",
                `⏰ *${pickup ? "RETIRADA" : "ENTREGA"}: ${scheduledLabel}*`,
                separator,
            );
        }
    }

    lines.push(
        `🕐 Hora: ${formatDateTime(order.created_at)}`,
        `📦 Tipo: ${tableOrder ? "Mesa" : pickup ? "Retirada" : "Entrega"}`,
    );

    if (tableOrder) {
        lines.push(`🪑 Mesa: ${order.table_name_snapshot || "Mesa"}`);
    }

    if (order.customer_name) {
        lines.push(`👤 Cliente: ${order.customer_name}`);
    }

    if (!tableOrder && order.customer_phone) {
        lines.push(`📱 Telefone: ${order.customer_phone}`);
    }

    if (!tableOrder && !pickup && order.customer_address) {
        lines.push(`📍 Endereço: ${order.customer_address}`);
    }

    if (!tableOrder && order.payment_method) {
        lines.push(`💳 Pagamento: ${paymentLabel(order.payment_method)}`);
    }

    lines.push(separator);

    for (const item of items) {
        const quantity = Math.max(1, Number(item.quantity) || 1);
        const fallbackTotal = (Number(item.price_cents) || 0) * quantity;
        const itemTotal = Number.isFinite(Number(item.total_cents))
            ? Number(item.total_cents)
            : fallbackTotal;

        lines.push(`🍽️ *${quantity}x ${item.name}* — ${formatMoney(itemTotal)}`);

        for (const selected of subitemsByOrderItem.get(item.id) || []) {
            const selectedQuantity = Math.max(
                1,
                Number(selected.quantity) || 1,
            );
            const selectedPrice = Number(selected.price_cents) || 0;
            const priceText =
                selectedPrice > 0
                    ? ` — +${formatMoney(selectedPrice * selectedQuantity)}`
                    : "";

            lines.push(
                `  ↳ ${selectedQuantity}x ${selected.name}${priceText}`,
            );
        }

        if (item.observation) {
            lines.push(`  📝 Obs: ${item.observation}`);
        }
    }

    const subtotal = Number(order.subtotal_cents) || 0;
    const delivery =
        pickup || tableOrder ? 0 : Number(order.delivery_cents) || 0;
    const storedDiscount = Number(order.coupon_discount_cents) || 0;
    const total = Number(order.total_cents) || 0;
    const discount =
        storedDiscount > 0
            ? storedDiscount
            : Math.max(subtotal + delivery - total, 0);

    lines.push(separator, `💰 Subtotal: ${formatMoney(subtotal)}`);

    if (delivery > 0) {
        lines.push(`🛵 Entrega: ${formatMoney(delivery)}`);
    }

    if (discount > 0) {
        lines.push(`🏷️ Desconto: -${formatMoney(discount)}`);
    }

    lines.push(`💵 *TOTAL: ${formatMoney(total)}*`);

    return lines.join("\n");
}

export async function GET(
    _request: Request,
    context: { params: Promise<{ id: string }> },
) {
    const { id } = await context.params;

    try {
        const orderResult = await query<OrderRow>(
            `
                SELECT
                    orders.id,
                    orders.display_id,
                    orders.created_at,
                    orders.scheduled_for,
                    orders.customer_name,
                    orders.customer_phone,
                    orders.customer_address,
                    orders.payment_method,
                    orders.status,
                    orders.is_delivery,
                    orders.table_name_snapshot,
                    orders.subtotal_cents,
                    orders.delivery_cents,
                    orders.coupon_discount_cents,
                    orders.total_cents,
                    restaurants.store_whatsapp,
                    restaurants.phone AS restaurant_phone,
                    restaurants.force_whatsapp_order_confirmation
                FROM orders
                JOIN restaurants
                  ON restaurants.id = orders.restaurant_id
                WHERE orders.id = $1
                LIMIT 1
            `,
            [id],
        );

        const order = orderResult.rows[0];
        if (!order) {
            return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
        }

        if (order.force_whatsapp_order_confirmation !== true) {
            return NextResponse.json({ enabled: false, url: null });
        }

        if (order.status === "pending_online_payment") {
            return NextResponse.json({
                enabled: true,
                pendingPayment: true,
                url: null,
            });
        }

        const whatsappPhone = normalizeWhatsAppPhone(
            order.store_whatsapp || order.restaurant_phone,
        );
        if (!whatsappPhone) {
            return NextResponse.json({ enabled: true, url: null });
        }

        const itemsResult = await query<OrderItemRow>(
            `
                SELECT
                    id,
                    name,
                    quantity,
                    observation,
                    price_cents,
                    total_cents
                FROM order_items
                WHERE order_id = $1
                ORDER BY id ASC
            `,
            [id],
        );

        const subitemsResult = await query<SubitemRow>(
            `
                SELECT
                    order_item_subitems.order_item_id,
                    order_item_subitems.name,
                    order_item_subitems.quantity,
                    order_item_subitems.price_cents
                FROM order_item_subitems
                JOIN order_items
                  ON order_items.id = order_item_subitems.order_item_id
                WHERE order_items.order_id = $1
                ORDER BY order_item_subitems.order_item_id ASC,
                         order_item_subitems.id ASC
            `,
            [id],
        );

        const message = buildComanda(
            order,
            itemsResult.rows,
            subitemsResult.rows,
        );

        return NextResponse.json({
            enabled: true,
            url: `https://wa.me/${whatsappPhone}?text=${encodeURIComponent(message)}`,
        });
    } catch (error) {
        console.error("[WHATSAPP_ORDER_CONFIRMATION] Failed:", error);
        return NextResponse.json(
            { error: "Não foi possível preparar a confirmação no WhatsApp." },
            { status: 500 },
        );
    }
}
