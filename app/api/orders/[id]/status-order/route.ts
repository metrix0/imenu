// app/api/orders/[id]/status/route.ts
import { NextResponse } from "next/server";
import { query } from "@/lib/database/sql";
import { notifyOrderStatusUpdate } from "@/lib/services/whatsappNotification"; 

// ================================
// PATCH — Update Order Status ONLY
// ================================
export async function PATCH(
    request: Request,
    context: { params: Promise<{ id: string }> }
) {
    try {
        const { id } = await context.params;
        const body = await request.json();
        const { status } = body;

        // Validação simples dos status permitidos
        const validStatuses = [
            "pending_online_payment",
            "pending_physical_payment",
            "preparing",
            "delivering",
            "done",
            "canceled"
        ];

        if (!status || !validStatuses.includes(status)) {
            return NextResponse.json(
                { error: "Invalid status provided" },
                { status: 400 }
            );
        }

        // Executa a query de atualização
        // CORREÇÃO: Adicionado cast explícito para resolver ambiguidade de tipos (ENUM vs TEXT)
        const { rowCount } = await query(
            `
                UPDATE orders
                SET
                    status = $1::public.order_status,
                    updated_at = NOW()
            WHERE id = $2
            `,
            [status, id]
        );

        if (rowCount === 0) {
            return NextResponse.json({ error: "Order not found" }, { status: 404 });
        }

        notifyOrderStatusUpdate(id, status);

        // ============================================================
        // 3. LÓGICA DE FIDELIDADE (Novo)
        // Só pontua se status for "done" (Concluído)
        // ============================================================
        if (status === "done") {
            try {
                // A. Busca dados do pedido para verificar elegibilidade
                const { rows: [order] } = await query(
                    `SELECT restaurant_id, customer_phone, loyalty_credited, total_cents 
                     FROM orders 
                     WHERE id = $1`, 
                    [id]
                );

                // Só prossegue se:
                // 1. O pedido existe
                // 2. Ainda não foi creditado
                // 3. Tem telefone do cliente
                if (order && !order.loyalty_credited && order.customer_phone) {
                    
                    // Limpa o telefone para garantir match no banco (apenas números)
                    const cleanPhone = order.customer_phone.replace(/\D/g, "");

                    if (cleanPhone.length >= 8) {
                        // B. Busca regra ativa E o valor mínimo
                        const { rows: [program] } = await query(
                            `SELECT id, min_order_value_cents 
                             FROM loyalty_programs 
                             WHERE restaurant_id = $1 AND active = true`,
                            [order.restaurant_id]
                        );

                        const minVal = program?.min_order_value_cents || 0;

                        if (program) {
                            // C. UPSERT no Saldo (Cria ou Incrementa)
                            await query(
                                `INSERT INTO loyalty_balances (
                                    restaurant_id, 
                                    customer_phone, 
                                    current_count, 
                                    total_lifetime_count, 
                                    last_order_at
                                )
                                VALUES ($1, $2, 1, 1, NOW())
                                ON CONFLICT (restaurant_id, customer_phone)
                                DO UPDATE SET
                                    current_count = loyalty_balances.current_count + 1,
                                    total_lifetime_count = loyalty_balances.total_lifetime_count + 1,
                                    last_order_at = NOW()`,
                                [order.restaurant_id, cleanPhone]
                            );

                            // D. Marca o pedido como creditado para evitar pontos duplos
                            await query(
                                `UPDATE orders SET loyalty_credited = true WHERE id = $1`,
                                [id]
                            );

                            console.log(`✅ Pontos creditados. Pedido R$${order.total_cents/100} >= Mínimo R$${minVal/100}`);
                        } else if (program) {
                            console.log(`⚠️ Pedido não pontuou: Valor R$${order.total_cents/100} menor que o mínimo R$${minVal/100}`);
                        }
                    }
                }
            } catch (loyaltyError) {
                // Não queremos quebrar a requisição se o sistema de fidelidade falhar, 
                // apenas logamos o erro. O status do pedido já foi atualizado com sucesso.
                console.error("❌ Erro ao processar fidelidade:", loyaltyError);
            }
        }
        // ============================================================

        return NextResponse.json({ ok: true, status });

    } catch (err: any) {
        console.error("❌ ERROR /api/orders/[id]/status PATCH:", err);
        return NextResponse.json(
            { error: err.message ?? "Internal error" },
            { status: 500 }
        );
    }
}