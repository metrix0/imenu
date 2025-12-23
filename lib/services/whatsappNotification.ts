import { query } from "@/lib/database/sql";
import { sendWhatsAppMessage } from "@/lib/api/whatsapp";

export async function notifyOrderStatusUpdate(orderId: string, newStatus: string) {
    try {
        // 1. Buscar dados do pedido e do cliente
        // CORREÇÃO: Usando 'customer_' (do banco) e não 'costumer_'
        const result = await query(
            `SELECT 
                o.id, 
                o.customer_phone, 
                o.customer_name,
                r.name as restaurant_name
             FROM orders o
             JOIN restaurants r ON o.restaurant_id = r.id
             WHERE o.id = $1`,
            [orderId]
        );

        if (result.rows.length === 0) return;

        const order = result.rows[0];
        
        // Verifica se tem telefone (usando o nome correto da coluna do banco)
        if (!order.customer_phone) {
             console.log(`[WhatsApp Service] Pedido ${orderId} sem telefone (customer_phone).`);
             return;
        }

        // 2. Traduzir status
        const statusMessages: Record<string, string> = {
            "preparing": "está sendo preparado 👨‍🍳",
            "delivering": "saiu para entrega 🛵",
            "done": "foi entregue. Bom apetite! 😋",
            "canceled": "foi cancelado ❌"
        };

        const friendlyStatus = statusMessages[newStatus];
        if (!friendlyStatus) return;

        // 3. Montar a mensagem
        const message = `Olá ${order.customer_name || "Cliente"}! \n\nAtualização do *${order.restaurant_name}*: \nSeu pedido *#${order.id.slice(0, 4)}* ${friendlyStatus}`;

        console.log(`[WhatsApp Service] Notificando ${order.customer_phone} sobre status '${newStatus}'`);

        // 4. Enviar
        await sendWhatsAppMessage(order.customer_phone, message);

    } catch (error) {
        console.error("[WhatsApp Service] Erro ao processar notificação:", error);
    }
}