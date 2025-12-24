import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { sendWhatsAppTemplate } from "@/lib/api/whatsapp";

// Essa rota deve ser chamada a cada X minutos por um Cron Job externo ou Vercel Cron
export async function GET() {
    try {
        console.log("[Cron] Verificando pedidos pendentes atrasados...");

        // 1. Busca pedidos que:
        // - Estão com status 'pending_...'
        // - Foram criados há mais de 5 minutos
        // - O dono AINDA NÃO foi notificado (owner_notified = false)
        const { rows: pendingOrders } = await query(`
            SELECT 
                o.id, 
                o.total_cents,
                r.name as restaurant_name,
                r.phone
            FROM orders o
            JOIN restaurants r ON o.restaurant_id = r.id
            WHERE 
                (o.status = 'pending_online_payment' OR o.status = 'pending_physical_payment')
                AND o.created_at < (NOW() - INTERVAL '5 minutes')
                AND (o.owner_notified IS FALSE OR o.owner_notified IS NULL)
        `);

        if (pendingOrders.length === 0) {
            return NextResponse.json({ message: "Nenhum pedido atrasado encontrado." });
        }

        console.log(`[Cron] Encontrados ${pendingOrders.length} pedidos atrasados.`);

        // 2. Loop para notificar
        const results = await Promise.all(pendingOrders.map(async (order) => {
            if (!order.phone) return { id: order.id, status: "skipped_no_phone" };

            const totalFormatted = (order.total_cents / 100).toFixed(2).replace('.', ',');
            const variables = [
                order.restaurant_name,      // {{1}}
                order.id.slice(0, 4),       // {{2}}
                totalFormatted              // {{3}}
            ];

            // Envia WhatsApp
            //TO DO: CHECK IF new_order_alert was already analised by meta
            await sendWhatsAppTemplate(order.phone, "new_order_alert", variables);
            //await sendWhatsAppTemplate(order.phone, "hello_world", []);

            // Marca como notificado para não enviar de novo no próximo Cron
            await query(`UPDATE orders SET owner_notified = true WHERE id = $1`, [order.id]);

            return { id: order.id, status: "notified" };
        }));

        return NextResponse.json({ success: true, results });

    } catch (error: any) {
        console.error("Erro no Cron de Lembrete:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}