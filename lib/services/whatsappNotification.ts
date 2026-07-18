import { sendWhatsAppTemplate } from "@/lib/api/whatsapp";
import { query } from "@/lib/database/sql";

export async function notifyOrderStatusUpdate(
    orderId: string,
    newStatus: string
) {
    try {
        const result = await query(
            `
                SELECT
                    orders.id,
                    orders.customer_phone,
                    orders.customer_name,
                    orders.is_delivery,
                    restaurants.name AS restaurant_name
                FROM orders
                JOIN restaurants
                  ON orders.restaurant_id = restaurants.id
                WHERE orders.id = $1
            `,
            [orderId]
        );

        if (result.rows.length === 0) return;

        const order = result.rows[0];
        const isPickup =
            order.is_delivery === "retirada";

        if (!order.customer_phone) {
            console.log(
                `[WhatsApp Service] Pedido ${orderId} sem telefone.`
            );
            return;
        }

        const statusMessages: Record<
            string,
            string
        > = isPickup
            ? {
                  preparing:
                      "está sendo preparado 👨‍🍳",
                  delivering:
                      "está pronto para retirada ✅",
                  done:
                      "foi retirado. Bom apetite! 😋",
                  canceled: "foi cancelado ❌",
              }
            : {
                  preparing:
                      "está sendo preparado 👨‍🍳",
                  delivering:
                      "saiu para entrega 🛵",
                  done:
                      "foi entregue. Bom apetite! 😋",
                  canceled: "foi cancelado ❌",
              };

        const statusText =
            statusMessages[newStatus];

        if (!statusText) return;

        const variables = [
            order.customer_name || "Cliente",
            order.restaurant_name,
            order.id.slice(0, 4),
            statusText,
        ];

        await sendWhatsAppTemplate(
            order.customer_phone,
            "order_status_update",
            variables
        );
    } catch (error) {
        console.error(
            "[WhatsApp Service] Erro ao processar notificação:",
            error
        );
    }
}
