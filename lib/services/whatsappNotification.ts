import { query } from "@/lib/database/sql";
import { sendWahaText } from "@/lib/services/wahaClient";
import {
    buildRestaurantTemplateVariables,
    getRestaurantTemplateData,
    getWhatsAppTemplates,
    renderWhatsAppTemplate,
} from "@/lib/services/whatsappMessageTemplates";

type OrderNotificationRow = {
    id: string;
    restaurant_id: string;
    display_id: number | null;
    customer_phone: string | null;
    customer_name: string | null;
    is_delivery: string | boolean | null;
    restaurant_name: string;
    whatsapp_session_name: string | null;
    whatsapp_status: string | null;
    whatsapp_desired_state: string | null;
};

function normalizeBrazilianPhone(value: unknown): string | null {
    let digits = String(value ?? "").replace(/\D/g, "");

    // Remove common international-dial prefixes before normalizing.
    if (digits.startsWith("0055")) digits = digits.slice(2);
    if (digits.startsWith("055") && digits.length >= 13) digits = digits.slice(1);

    if (digits.startsWith("55") && (digits.length === 12 || digits.length === 13)) {
        return digits;
    }

    if (digits.length === 10 || digits.length === 11) {
        return `55${digits}`;
    }

    return null;
}

function isPickup(value: unknown): boolean {
    if (value === false) return true;

    const normalized = String(value ?? "")
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase()
        .trim();

    return ["retirada", "pickup", "false", "0"].includes(normalized);
}

function getStatusText(status: string, pickup: boolean): string | null {
    const deliveryMessages: Record<string, string> = {
        preparing: "está sendo preparado 👨‍🍳",
        delivering: "saiu para entrega 🛵",
        done: "foi entregue. Bom apetite! 😋",
        canceled: "foi cancelado ❌",
    };

    const pickupMessages: Record<string, string> = {
        preparing: "está sendo preparado 👨‍🍳",
        delivering: "está pronto para retirada ✅",
        done: "foi retirado. Bom apetite! 😋",
        canceled: "foi cancelado ❌",
    };

    return (pickup ? pickupMessages : deliveryMessages)[status] || null;
}

export async function notifyOrderStatusUpdate(
    orderId: string,
    newStatus: string
): Promise<void> {
    try {
        const result = await query<OrderNotificationRow>(
            `
                SELECT
                    orders.id,
                    orders.restaurant_id,
                    orders.display_id,
                    orders.customer_phone,
                    orders.customer_name,
                    orders.is_delivery,
                    restaurants.name AS restaurant_name,
                    whatsapp_connections.session_name AS whatsapp_session_name,
                    whatsapp_connections.status AS whatsapp_status,
                    whatsapp_connections.desired_state AS whatsapp_desired_state
                FROM orders
                JOIN restaurants
                  ON restaurants.id = orders.restaurant_id
                LEFT JOIN whatsapp_connections
                  ON whatsapp_connections.restaurant_id = orders.restaurant_id
                WHERE orders.id = $1
                LIMIT 1
            `,
            [orderId]
        );

        const order = result.rows[0];
        if (!order) return;

        const statusText = getStatusText(newStatus, isPickup(order.is_delivery));
        if (!statusText) return;

        const phone = normalizeBrazilianPhone(order.customer_phone);
        if (!phone) {
            console.warn(
                `[WHATSAPP_NOTIFICATION] Pedido ${orderId} sem telefone brasileiro válido.`
            );
            return;
        }

        if (
            !order.whatsapp_session_name ||
            order.whatsapp_status !== "WORKING" ||
            order.whatsapp_desired_state !== "connected"
        ) {
            console.warn(
                `[WHATSAPP_NOTIFICATION] WhatsApp do restaurante não está conectado; atualização do pedido ${orderId} não enviada.`
            );
            return;
        }

        const [restaurant, templates] = await Promise.all([
            getRestaurantTemplateData(order.restaurant_id),
            getWhatsAppTemplates(order.restaurant_id),
        ]);
        if (!restaurant) return;

        const customerName = order.customer_name?.trim() || "Cliente";
        const orderNumber =
            order.display_id ?? order.id.slice(0, 4).toUpperCase();
        const message = renderWhatsAppTemplate(
            templates.status_notification,
            buildRestaurantTemplateVariables(restaurant, {
                NOME_DO_CLIENTE: customerName,
                NUMERO_DO_PEDIDO: String(orderNumber),
                STATUS_DO_PEDIDO: statusText,
            })
        );

        await sendWahaText(
            order.whatsapp_session_name,
            `${phone}@c.us`,
            message
        );
    } catch (error) {
        // Status changes must still succeed if WhatsApp is temporarily unavailable.
        console.error(
            `[WHATSAPP_NOTIFICATION] Falha ao notificar o pedido ${orderId}:`,
            error
        );
    }
}
