import { query } from "@/lib/database/sql";
import { sendWhatsAppTemplate } from "@/lib/api/whatsapp";

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

        const statusText = statusMessages[newStatus];
        if (!statusText) return;

        // 3. Preparar variáveis para o template
        // Template: Olá {{1}}! Atualização do {{2}}: Seu pedido #{{3}} {{4}}
        
        const variables = [
            order.customer_name || "Cliente",  // {{1}}
            order.restaurant_name,             // {{2}}
            order.id.slice(0, 4),              // {{3}} (Apenas os 4 primeiros dígitos do UUID)
            statusText                         // {{4}}
        ];

        console.log(`[WhatsApp Service] Enviando template para ${order.customer_phone}`);

        // 4. Enviar usando o helper de template
        await sendWhatsAppTemplate(order.customer_phone, "order_status_update", variables);

        

    } catch (error) {
        console.error("[WhatsApp Service] Erro ao processar notificação:", error);
    }
}