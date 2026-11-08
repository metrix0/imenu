import { query, withTransaction } from "@/lib/database/sql";
import { emptyDeliveryConfig, machinePayload, mapIfoodOrder, unseal, type DeliveryConfig } from "./providers";

export async function loadDeliveryConfig(restaurantId: string): Promise<DeliveryConfig> {
    const { rows } = await query("SELECT credentials FROM delivery_integrations WHERE restaurant_id=$1", [restaurantId]);
    return rows[0] ? unseal(rows[0].credentials) : structuredClone(emptyDeliveryConfig);
}
export async function dispatchCourier(orderId: string) {
    const { rows: [order] } = await query(`SELECT o.*, r.address->>'city' AS city, r.address->>'state' AS state,
        i.delivery_address, i.external_id AS ifood_id
        FROM orders o JOIN restaurants r ON r.id=o.restaurant_id
        LEFT JOIN delivery_imported_orders i ON i.order_id=o.id WHERE o.id=$1`, [orderId]);
    if (!order || order.is_delivery !== "entrega" || order.status !== "preparing") return null;
    // External delivery responsibility and payment collection stay with iFood.
    if (order.ifood_id) return null;
    const config = (await loadDeliveryConfig(order.restaurant_id)).machine;
    if (!config.enabled) return null;
    // Durable claim survives process crashes. Uncertain outcomes are not retried automatically.
    const claim = await query(`INSERT INTO delivery_dispatches(order_id,restaurant_id,state)
        VALUES($1,$2,'requesting') ON CONFLICT(order_id) DO UPDATE SET state='requesting', error=NULL, updated_at=now()
        WHERE delivery_dispatches.state='failed' RETURNING order_id`, [orderId, order.restaurant_id]);
    if (!claim.rowCount) return null;
    let sent = false;
    try {
        const payload = machinePayload(order, config);
        const base = process.env.MACHINE_API_ENVIRONMENT === "production"
            ? "https://api.taximachine.com.br" : "https://api-vendas.taximachine.com.br";
        sent = true;
        const response = await fetch(`${base}/api/v2/integracao/entregas`, {
            method: "POST", headers: { "Content-Type": "application/json", "api-key": config.apiKey,
                Authorization: `Basic ${Buffer.from(`${config.username}:${config.password}`).toString("base64")}` },
            body: JSON.stringify(payload), cache: "no-store", signal: AbortSignal.timeout(15000),
        });
        const data = await response.json();
        const externalId = data?.data?.id_mch;
        if (!response.ok || !data.success || !externalId) {
            // A duplicate external reference may mean an earlier request succeeded.
            const duplicate = JSON.stringify(data?.errors || []).includes('"code":8');
            sent = response.status >= 500 || duplicate;
            throw new Error(duplicate ? "Confira a solicitação na Machine antes de tentar novamente." : "A Machine recusou a solicitação. Confira os dados e a conta na central.");
        }
        await query("UPDATE delivery_dispatches SET state='requested',external_id=$2,error=NULL,updated_at=now() WHERE order_id=$1", [orderId, String(externalId)]);
        return null;
    } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao solicitar entregador.";
        const state = sent ? "uncertain" : "failed";
        await query("UPDATE delivery_dispatches SET state=$2,error=$3,updated_at=now() WHERE order_id=$1", [orderId, state, message]);
        return state === "uncertain" ? "Solicitação sem confirmação. Confira na Machine antes de solicitar outro entregador." : message;
    }
}
export async function importIfoodOrder(restaurantId: string, data: any) {
    const mapped = mapIfoodOrder(data);
    return withTransaction(async client => {
        // Serialize duplicate deliveries of the same event across server instances.
        await client.query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))", [`ifood:${data.id}`]);
        if ((await client.query("SELECT 1 FROM delivery_imported_orders WHERE external_id=$1", [data.id])).rowCount) return;
        const address = mapped.address;
        const { rows: [order] } = await client.query(`INSERT INTO orders
            (restaurant_id,status,subtotal_cents,delivery_cents,total_cents,customer_name,customer_phone,customer_address,payment_method,is_delivery)
            VALUES($1,'pending_physical_payment',$2,$3,$4,$5,$6,$7,'ifood',$8) RETURNING id`,
            [restaurantId,mapped.subtotal,mapped.delivery,mapped.total,data.customer?.name || "Cliente iFood",data.customer?.phone?.number || null,
                address ? `${address.rua}, ${address.numero} - ${address.bairro} - ${address.cidade}/${address.estado}${address.complemento ? ` (${address.complemento})` : ""}` : null,mapped.type]);
        for (const item of mapped.items) {
            await client.query(`INSERT INTO order_items(order_id,name,price_cents,quantity,total_cents,observation)
                VALUES($1,$2,$3,$4,$5,$6)`,[order.id,item.name,item.price,item.quantity,item.total,item.observation]);
        }
        await client.query(`INSERT INTO delivery_imported_orders(external_id,restaurant_id,order_id,delivery_address)
            VALUES($1,$2,$3,$4::jsonb)`,[data.id,restaurantId,order.id,JSON.stringify(address)]);
    });
}
