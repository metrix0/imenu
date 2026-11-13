import { query } from "@/lib/database/sql";
import { ifoodApi, updateIfood } from "./ifoodConnection";
import { importIfoodOrder } from "./integrations";
import { receiveIfoodStatus } from "./ifoodStatus";

export async function pollIfoodOrders(restaurantId: string) {
    // A durable lease prevents overlap without holding a DB connection during provider calls.
    const lease = Date.now() + 5 * 60000;
    const merchantId = await updateIfood(restaurantId, async config => {
        const connection = config.ifood.connection;
        if (!config.ifood.enabled || !config.ifood.merchantId || !connection?.refreshToken ||
            Date.now() - (connection.lastPollAt || 0) < 30000 || (connection.pollingUntil || 0) > Date.now()) return null;
        connection.lastPollAt = Date.now();
        connection.pollingUntil = lease;
        return config.ifood.merchantId;
    });
    if (!merchantId) return;
    let lastError = "";
    try {
        const response = await ifoodApi(restaurantId, "/events/v1.0/events:polling", { headers: { "x-polling-merchants": merchantId } });
        if (response.status === 204) return;
        const events = await response.json();
        if (!Array.isArray(events)) throw new Error("Resposta de eventos iFood inválida.");
        const acknowledged: { id: string }[] = [];
        const failedOrders = new Set<string>();
        // Preserve provider event order, including lifecycle changes arriving in the same batch.
        const sorted = [...events].sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
        let failed = false;
        for (const event of sorted) {
            if (event.merchantId !== merchantId || typeof event.id !== "string" || !event.id) { failed = true; continue; }
            if (failedOrders.has(event.orderId)) continue;
            try {
                if (event.code === "PLC" || event.fullCode === "PLACED") {
                    if (!/^[a-f0-9-]{36}$/i.test(event.orderId || "")) throw new Error("Pedido iFood inválido.");
                    const exists = await query("SELECT 1 FROM delivery_imported_orders WHERE external_id=$1 AND restaurant_id=$2", [event.orderId, restaurantId]);
                    if (!exists.rows.length) {
                        const details = await ifoodApi(restaurantId, `/order/v1.0/orders/${event.orderId}`);
                        const order = await details.json();
                        if (order.id !== event.orderId || order.merchant?.id !== merchantId) throw new Error("Loja iFood inválida.");
                        await importIfoodOrder(restaurantId, order);
                    }
                } else {
                    if (["CFM", "PRS", "RTP", "DSP", "CLT", "CON"].includes(event.code) ||
                        ["CONFIRMED", "PREPARATION_STARTED", "READY_TO_PICKUP", "DISPATCHED", "COLLECTED", "CONCLUDED"].includes(event.fullCode)) {
                        const local = await query("SELECT 1 FROM delivery_imported_orders WHERE external_id=$1 AND restaurant_id=$2", [event.orderId, restaurantId]);
                        if (!local.rows.length) throw new Error("Pedido iFood ainda não importado.");
                    }
                    await receiveIfoodStatus(restaurantId, event);
                }
                acknowledged.push({ id: event.id });
            } catch { failed = true; failedOrders.add(event.orderId); }
        }
        if (acknowledged.length) await ifoodApi(restaurantId, "/events/v1.0/events/acknowledgment", {
            method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(acknowledged),
        });
        if (failed) throw new Error("Alguns eventos iFood não foram processados e serão tentados novamente.");
    } catch (error) {
        lastError = "Não foi possível atualizar os pedidos do iFood. Se o problema persistir, reconecte sua loja.";
        throw error;
    } finally {
        await updateIfood(restaurantId, async config => {
            if (config.ifood.connection?.pollingUntil === lease) {
                config.ifood.connection.pollingUntil = 0;
                config.ifood.connection.lastError = lastError;
            }
        });
    }
}
