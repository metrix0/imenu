// app/api/orders/[id]/status-order/route.ts
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
        // 3. LÓGICA DE FIDELIDADE (CENTRALIZADA E ROBUSTA)
        // ============================================================
        
        // Buscamos dados essenciais do pedido
        const { rows: [order] } = await query(
            `SELECT restaurant_id, customer_phone, loyalty_credited, total_cents, loyalty_points_used 
             FROM orders 
             WHERE id = $1`, 
            [id]
        );

        if (order && order.customer_phone) {
            const cleanPhone = order.customer_phone.replace(/\D/g, "");

            // ------------------------------------------------------------
            // CENÁRIO A: PEDIDO CONCLUÍDO (DAR PONTOS)
            // ------------------------------------------------------------
            if (status === "done") {
                try {
                    // Se já foi creditado, ignora
                    if (!order.loyalty_credited) {
                        const { rows: [program] } = await query(
                            `SELECT min_order_value_cents, goal_count 
                             FROM loyalty_programs 
                             WHERE restaurant_id = $1 AND active = true`,
                            [order.restaurant_id]
                        );

                        const minVal = program?.min_order_value_cents || 0;
                        const goal = program?.goal_count || 10;

                        if (program && order.total_cents >= minVal) {
                            
                            // Verifica saldo atual para não pontuar se já bateu a meta
                            const { rows: [balance] } = await query(
                                `SELECT current_count FROM loyalty_balances 
                                 WHERE restaurant_id = $1 AND customer_phone = $2`,
                                [order.restaurant_id, cleanPhone]
                            );

                            const currentCount = balance?.current_count || 0;

                            if (currentCount >= goal) {
                                console.log(`🛑 Cliente já atingiu a meta (${currentCount}/${goal}). Nenhum ponto adicionado.`);
                            } else {
                                // UPSERT no Saldo (Cria ou Incrementa)
                                await query(
                                    `INSERT INTO loyalty_balances (
                                        restaurant_id, customer_phone, current_count, total_lifetime_count, last_order_at
                                    ) VALUES ($1, $2, 1, 1, NOW())
                                    ON CONFLICT (restaurant_id, customer_phone)
                                    DO UPDATE SET
                                        current_count = loyalty_balances.current_count + 1,
                                        total_lifetime_count = loyalty_balances.total_lifetime_count + 1,
                                        last_order_at = NOW()`,
                                    [order.restaurant_id, cleanPhone]
                                );

                                // Marca como creditado
                                await query(`UPDATE orders SET loyalty_credited = true WHERE id = $1`, [id]);
                                console.log(`✅ Pontos creditados.`);
                            }
                        }
                    }
                } catch (loyaltyError) {
                    console.error("❌ Erro ao processar crédito fidelidade:", loyaltyError);
                }
            }

            // ------------------------------------------------------------
            // CENÁRIO B: PEDIDO CANCELADO (ESTORNO / ROLLBACK)
            // ------------------------------------------------------------
            if (status === "canceled") {
                try {
                    console.log(`🔄 [Fidelidade] Processando cancelamento para pedido ${id}...`);

                    // 1. REVERTER CRÉDITO INDEVIDO (Anti-Farm)
                    // Se o pedido estava "Done" (ganhou ponto) e virou "Canceled", removemos o ponto ganho.
                    if (order.loyalty_credited) {
                        await query(
                            `UPDATE loyalty_balances 
                             SET 
                                current_count = GREATEST(0, current_count - 1),
                                total_lifetime_count = GREATEST(0, total_lifetime_count - 1)
                             WHERE restaurant_id = $1 AND customer_phone = $2`,
                            [order.restaurant_id, cleanPhone]
                        );
                        
                        // Remove a flag para evitar dupla remoção
                        await query(`UPDATE orders SET loyalty_credited = false WHERE id = $1`, [id]);
                        console.log(`🔻 [Fidelidade] Ponto removido (ganho indevido cancelado).`);
                    }

                    // 2. DEVOLVER PONTOS GASTOS (RESGATE)
                    // Verifica se o pedido teve um custo em pontos registrado no snapshot
                    const pointsUsed = order.loyalty_points_used || 0;

                    if (pointsUsed > 0) {
                        await query(
                            `UPDATE loyalty_balances 
                             SET current_count = current_count + $1
                             WHERE restaurant_id = $2 AND customer_phone = $3`,
                            [pointsUsed, order.restaurant_id, cleanPhone]
                        );
                        console.log(`🎁 [Fidelidade] ${pointsUsed} pontos devolvidos ao cliente.`);
                    }

                } catch (refundError) {
                    console.error("❌ Erro ao processar estorno fidelidade:", refundError);
                }
            }
        }
        // ============================================================

        return NextResponse.json({ ok: true, status });


    } catch (err: any) {
        console.error("❌ ERROR /api/orders/[id]/status-order PATCH:", err);
        return NextResponse.json(
            { error: err.message ?? "Internal error" },
            { status: 500 }
        );
    }
}