import { query, withTransaction } from "@/lib/database/sql";
import { loadDeliveryConfig } from "./integrations";
import { ifoodRequest, type DeliveryConfig } from "./providers";

export class IfoodStatusError extends Error {
    status = 409;
}
type Progress = {
    orderType?: string; deliveredBy?: string; ready?: boolean; requestedStatus?: string;
    pendingAction?: string; sentAt?: number; eventAt?: string; eventRank?: number;
};
type Imported = { external_id: string; restaurant_id: string; order_id: string; sync_state: Progress };
async function send(config: DeliveryConfig["ifood"], order: Imported, action: "confirm" | "startPreparation" | "readyToPickup" | "dispatch") {
    try { await ifoodRequest(config, `/order/v1.0/orders/${encodeURIComponent(order.external_id)}/${action}`, action); }
    catch (error) { throw new IfoodStatusError(error instanceof Error ? error.message : "Não foi possível atualizar o iFood. O status anterior foi mantido."); }
}

// Called while the status route holds the order row lock. Only confirmed events change local status.
export async function requestIfoodStatus(orderId: string, current: string, target: string) {
    const { rows: [order] } = await query<Imported>("SELECT * FROM delivery_imported_orders WHERE order_id=$1", [orderId]);
    if (!order) throw new IfoodStatusError("Pedido iFood não encontrado.");
    const config = (await loadDeliveryConfig(order.restaurant_id)).ifood;
    if (!config.enabled || !config.clientId || !config.clientSecret || !config.merchantId) throw new IfoodStatusError("Configure e ative a integração iFood antes de atualizar o pedido.");
    const state = order.sync_state || {};
    let action: "confirm" | "startPreparation" | "readyToPickup" | "dispatch";
    if (["pending_physical_payment", "paid"].includes(current) && target === "preparing") action = "confirm";
    else if (current === "preparing" && target === "delivering") action = state.ready && state.deliveredBy === "MERCHANT" ? "dispatch" : "readyToPickup";
    else if (target === current) return;
    else throw new IfoodStatusError("Essa alteração não está disponível pelo iMenu. Conclusão, cancelamento e reembolso devem seguir o fluxo do iFood.");
    // A recent accepted command is awaiting its event; do not send it twice on double-click/retry.
    if (state.pendingAction === action && Date.now() - (state.sentAt || 0) < 60000) return;
    const details = await ifoodRequest(config, `/order/v1.0/orders/${encodeURIComponent(order.external_id)}`);
    if (details.id !== order.external_id || details.merchant?.id !== config.merchantId) throw new IfoodStatusError("O pedido não pertence à loja iFood configurada.");
    if (target === "delivering" && details.orderType === "DELIVERY" && !["MERCHANT", "IFOOD"].includes(details.delivery?.deliveredBy)) throw new IfoodStatusError("Não foi possível identificar o responsável pela entrega no iFood.");
    const next = { ...state, orderType: details.orderType, deliveredBy: details.delivery?.deliveredBy, requestedStatus: target, pendingAction: action, sentAt: Date.now() };
    await send(config, order, action);
    await query("UPDATE delivery_imported_orders SET sync_state=$2::jsonb WHERE order_id=$1", [orderId, JSON.stringify(next)]);
}

export async function receiveIfoodStatus(restaurantId: string, event: any) {
    const names: Record<string,string> = { CFM:"CONFIRMED", PRS:"PREPARATION_STARTED", RTP:"READY_TO_PICKUP", DSP:"DISPATCHED", CLT:"COLLECTED", CON:"CONCLUDED" };
    const name = names[event.code] || event.fullCode;
    const ranks: Record<string,number> = { CONFIRMED:1, PREPARATION_STARTED:2, READY_TO_PICKUP:3, DISPATCHED:4, COLLECTED:4, CONCLUDED:5 };
    if (!ranks[name]) return; // Cancellation/refund workflows remain outside this integration.
    if (!event.createdAt || !Number.isFinite(Date.parse(event.createdAt))) throw new IfoodStatusError("Evento iFood sem data válida.");
    await withTransaction(async client => {
        // Lock the order before its mapping, matching the owner status route's lock order.
        const { rows: [local] } = await client.query(`SELECT o.id,o.status FROM orders o JOIN delivery_imported_orders i ON i.order_id=o.id
            WHERE i.external_id=$1 AND i.restaurant_id=$2 FOR UPDATE OF o`, [event.orderId, restaurantId]);
        if (!local) return;
        const { rows: [imported] } = await client.query<Imported>("SELECT * FROM delivery_imported_orders WHERE order_id=$1 FOR UPDATE", [local.id]);
        const state = imported.sync_state || {};
        if (ranks[name] < (state.eventRank || 0) || (state.eventAt && Date.parse(event.createdAt) < Date.parse(state.eventAt))) return;
        if (ranks[name] === state.eventRank && event.createdAt === state.eventAt) return;
        if (["done", "canceled"].includes(local.status)) return;
        const config = (await loadDeliveryConfig(restaurantId)).ifood;
        const details = await ifoodRequest(config, `/order/v1.0/orders/${encodeURIComponent(imported.external_id)}`);
        if (details.id !== imported.external_id || details.merchant?.id !== config.merchantId) throw new IfoodStatusError("Loja do pedido iFood inválida.");
        const next: Progress = { ...state, orderType: details.orderType, deliveredBy: details.delivery?.deliveredBy, eventAt:event.createdAt, eventRank:ranks[name] };
        let status = local.status;
        if (name === "CONFIRMED" || name === "PREPARATION_STARTED") status = "preparing";
        if (name === "CONFIRMED") {
            // Immediate FOOD orders can start preparation after confirmation. Never start scheduled orders early.
            if (details.orderTiming !== "SCHEDULED" && state.pendingAction === "confirm") await send(config, imported, "startPreparation");
            next.pendingAction = undefined;
        }
        if (name === "PREPARATION_STARTED") next.pendingAction = undefined;
        if (name === "READY_TO_PICKUP") {
            next.ready = true;
            next.pendingAction = undefined;
            if (details.orderType === "TAKEOUT") status = "delivering";
            if (details.orderType === "DELIVERY" && details.delivery?.deliveredBy === "MERCHANT" && state.requestedStatus === "delivering") {
                await send(config, imported, "dispatch");
                next.pendingAction = "dispatch"; next.sentAt = Date.now();
            }
        }
        if (name === "DISPATCHED" || name === "COLLECTED") { status = "delivering"; next.pendingAction = undefined; }
        if (name === "CONCLUDED") { status = "done"; next.pendingAction = undefined; }
        await client.query("UPDATE delivery_imported_orders SET sync_state=$2::jsonb WHERE order_id=$1", [local.id,JSON.stringify(next)]);
        if (status !== local.status) await client.query("UPDATE orders SET status=$2::public.order_status,updated_at=now() WHERE id=$1", [local.id,status]);
    });
}
