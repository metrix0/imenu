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


// ---------------------------------------------------------
// 1. FUNÇÃO DE ENVIO DE TEXTO (OTP) - VERSÃO META API
// ---------------------------------------------------------
export async function sendWhatsAppMessage(phone: string, message: string) {
    try {
        console.log(`🔑 [DEBUG MOCK] Para: ${phone} | Mensagem: "${message}"`);
        const token = process.env.WHATSAPP_API_TOKEN;
        const phoneId = process.env.WHATSAPP_PHONE_ID;

        if (!token || !phoneId) {
            console.log(`📱 [OTP Mock - Falta Config] Para: ${phone} | Msg: ${message}`);
            return;
        }

        // Formatação do telefone para Meta (Geralmente 55 + DDD + Numero)
        let cleanPhone = phone.replace(/\D/g, "");
        if (!cleanPhone.startsWith("55") && cleanPhone.length <= 11) {
            cleanPhone = "55" + cleanPhone;
        }

        console.log(`📱 Enviando via Meta API para ${cleanPhone}...`);

        const url = `https://graph.facebook.com/v19.0/${phoneId}/messages`;

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                messaging_product: "whatsapp",
                recipient_type: "individual",
                to: cleanPhone,
                type: "text",
                text: { preview_url: false, body: message }
            }),
        });

        if (!res.ok) {
            const errorData = await res.json();
            console.error("❌ Erro Meta API:", JSON.stringify(errorData, null, 2));
            throw new Error("Falha ao enviar mensagem via Facebook/Meta");
        }

    } catch (error) {
        console.error("❌ Erro no envio de WhatsApp:", error);
    }
}