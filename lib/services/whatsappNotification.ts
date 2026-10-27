import { query } from "@/lib/database/sql";
import { hasIMenuPlusAccess } from "@/lib/addons/access";
import { getWahaPhoneLid, sendWahaOrderOptions, sendWahaText } from "@/lib/services/wahaClient";
import { buildRestaurantTemplateVariables, getRestaurantTemplateData, getWhatsAppTemplates, renderWhatsAppTemplate } from "@/lib/services/whatsappMessageTemplates";

export class OrderNotificationError extends Error {
    constructor(message: string, public status = 409) { super(message); }
}
export function normalizeNotificationPhone(value: unknown): string | null {
    let digits = String(value ?? "").replace(/\D/g, "");
    if (digits.startsWith("0055")) digits = digits.slice(2);
    if (digits.startsWith("055") && digits.length >= 13) digits = digits.slice(1);
    if (digits.length === 10 || digits.length === 11) digits = "55" + digits;
    return /^55\d{10,11}$/.test(digits) ? digits : null;
}
export function notificationKey(id: string, kind: "ready" | "arrival") { return "order:" + id + ":" + kind; }

export async function getOrderNotificationContext(id: string) {
    const { rows: [order] } = await query<{
        id: string; restaurant_id: string; display_id: number | null; customer_phone: string | null;
        customer_name: string | null; is_delivery: string; status: string; total_cents: number;
        session_name: string | null; connection_status: string | null; desired_state: string | null;
        enabled: boolean;
    }>(`SELECT o.id,o.restaurant_id,o.display_id,o.customer_phone,o.customer_name,o.is_delivery,o.status,o.total_cents,
        c.session_name,c.status connection_status,c.desired_state,
        COALESCE(s.automations->>'order_notifications_enabled','false')='true' enabled
        FROM orders o LEFT JOIN whatsapp_connections c ON c.restaurant_id=o.restaurant_id
        LEFT JOIN whatsapp_bot_settings s ON s.restaurant_id=o.restaurant_id
        WHERE o.id=$1`, [id]);
    if (!order) throw new OrderNotificationError("Pedido não encontrado.", 404);
    const plus = await hasIMenuPlusAccess(order.restaurant_id);
    const phone = normalizeNotificationPhone(order.customer_phone);
    const connected = !!order.session_name && order.connection_status === "WORKING" && order.desired_state === "connected";
    const chats = phone ? [phone + "@c.us", phone + "@s.whatsapp.net"] : [];
    if (phone && connected) {
        const lid = await getWahaPhoneLid(order.session_name!, phone);
        if (lid) chats.unshift(lid);
    }
    const { rows: [conversation] } = await query<{ chat_id: string }>(
        `SELECT chat_id FROM whatsapp_conversations WHERE restaurant_id=$1 AND chat_id=ANY($2::text[])
          AND last_inbound_at >= NOW()-INTERVAL '7 days' ORDER BY last_inbound_at DESC LIMIT 1`,
        [order.restaurant_id, chats]);
    const { rows: [existing] } = await query<{ status: string }>(
        "SELECT status FROM whatsapp_outbound_messages WHERE dedupe_key=$1", [notificationKey(id, "arrival")]);
    return { ...order, plus, phone, connected, recent: !!conversation,
        chatId: conversation?.chat_id || (phone ? phone + "@c.us" : null), arrivalStatus: existing?.status || null };
}

// A permanent unique claim is made before contacting WAHA. Even ambiguous failures are never resent automatically.
async function sendOnce(key: string, restaurantId: string, chatId: string, kind: "text" | "list", send: () => Promise<unknown>) {
    const claimed = await query(`INSERT INTO whatsapp_outbound_messages
        (dedupe_key,restaurant_id,chat_id,message_type,status,updated_at)
        VALUES ($1,$2,$3,$4,'sending',NOW()) ON CONFLICT (dedupe_key) DO NOTHING RETURNING dedupe_key`,
        [key, restaurantId, chatId, kind]);
    if (!claimed.rowCount) return false;
    let response: any;
    try { response = await send(); }
    catch (error) {
        await query("UPDATE whatsapp_outbound_messages SET status='unconfirmed',last_error=$2,updated_at=NOW() WHERE dedupe_key=$1",
            [key, error instanceof Error ? error.message.slice(0,500) : "Falha ao enviar"]);
        throw new OrderNotificationError("Não foi possível confirmar o envio. Para evitar duplicidade, ele não será repetido.", 502);
    }
    await query("UPDATE whatsapp_outbound_messages SET status='sent',provider_message_id=$2,sent_at=NOW(),updated_at=NOW() WHERE dedupe_key=$1",
        [key, typeof response?.id === "string" ? response.id : response?.id?._serialized || null]);
    return true;
}

export async function sendOrderNotification(id: string, kind: "ready" | "arrival", confirmed = false) {
    const order = await getOrderNotificationContext(id);
    if (!order.plus) throw new OrderNotificationError("Recurso exclusivo do iMenu Plus.", 402);
    if (!order.connected || !order.chatId) throw new OrderNotificationError("Conecte o WhatsApp e confira o telefone do cliente.");
    if (kind === "ready" && (!order.enabled || !order.recent)) return { skipped: true };
    if (kind === "arrival" && !order.recent && !confirmed) return { confirmationRequired: true };
    if (order.status !== "delivering" || order.is_delivery === "mesa" ||
        (kind === "arrival" && order.is_delivery !== "entrega")) throw new OrderNotificationError("Este pedido não está disponível para notificação.");
    const pickup = order.is_delivery !== "entrega";
    const [restaurant, templates, items] = await Promise.all([
        getRestaurantTemplateData(order.restaurant_id), getWhatsAppTemplates(order.restaurant_id),
        query<{name: string; quantity: number}>("SELECT name,quantity FROM order_items WHERE order_id=$1 ORDER BY id LIMIT 5", [id])
    ]);
    if (!restaurant) throw new OrderNotificationError("Restaurante não encontrado.", 404);
    const number = String(order.display_id ?? id.slice(0,8).toUpperCase());
    const statusText = kind === "arrival" ? "chegou! O entregador está aguardando você no local. 📍"
        : pickup ? "está pronto no balcão para você retirar! ✅" : "saiu para entrega! 🛵";
    const text = renderWhatsAppTemplate(templates.status_notification, buildRestaurantTemplateVariables(restaurant, {
        NOME_DO_CLIENTE: order.customer_name?.trim() || "Cliente", NUMERO_DO_PEDIDO: number, STATUS_DO_PEDIDO: statusText,
    })).slice(0,600) + "\n\nPedido #" + number + "\n" + items.rows.map(item => item.quantity + "x " + item.name.slice(0,48)).join("\n") +
        "\nTotal: " + (order.total_cents/100).toLocaleString("pt-BR", {style:"currency", currency:"BRL"});
    const action = kind === "arrival" ? "collected" : pickup ? "pickup" : "thanks";
    const rows = [{ title: kind === "arrival" ? "Já peguei o pedido" : pickup ? "Estou indo buscar" : "Ok, obrigado",
        rowId: "order_reply:" + id + ":" + kind + ":" + action }];
    const sent = await sendOnce(notificationKey(id,kind), order.restaurant_id, order.chatId, "list",
        () => sendWahaOrderOptions(order.session_name!, order.chatId!, text, rows));
    return { sent, duplicate: !sent };
}

export async function notifyOrderStatusUpdate(id: string, status: string): Promise<void> {
    if (status !== "delivering") return;
    try { await sendOrderNotification(id, "ready"); }
    catch (error) { console.error("[WHATSAPP_NOTIFICATION]", { id, error }); }
}
export async function handleOrderNotificationReply(restaurantId: string, sessionName: string, chatId: string, body: string, phone: string | null) {
    const match = /^order_reply:([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}):(ready|arrival):(thanks|pickup|collected)$/.exec(body);
    if (!match) return false;
    const [,id,kind,action] = match;
    const { rows: [sent] } = await query<{chat_id:string; customer_phone:string; is_delivery:string}>(
        `SELECT m.chat_id,o.customer_phone,o.is_delivery FROM whatsapp_outbound_messages m JOIN orders o ON o.id=$2
         WHERE m.dedupe_key=$1 AND m.restaurant_id=$3 AND o.restaurant_id=$3 AND m.status IN ('sent','sending','unconfirmed')`,
        [notificationKey(id,kind as "ready"|"arrival"), id,restaurantId]);
    if (!sent || (sent.chat_id !== chatId && (!phone || normalizeNotificationPhone(phone) !== normalizeNotificationPhone(sent.customer_phone)))) return true;
    if ((kind === "arrival" && action !== "collected") || (kind === "ready" && action !== (sent.is_delivery === "entrega" ? "thanks" : "pickup"))) return true;
    const text = action === "thanks" ? "Por nada! Seu pedido está a caminho e chega rapidinho. 🛵💛" :
        action === "pickup" ? "Obrigado por avisar! Seu pedido está esperando por você no balcão. 😊" :
        "Obrigado pela confirmação! Bom apetite e até o próximo pedido. 💛";
    await sendOnce(notificationKey(id,kind as "ready"|"arrival")+":reply",restaurantId,chatId,"text",
        ()=>sendWahaText(sessionName,chatId,text));
    return true;
}
