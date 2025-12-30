import { query } from "@/lib/database/sql";

export type WhatsAppSessionStep = 
  | 'IDLE' 
  | 'VIEW_MENU' 
  | 'VIEW_CATEGORY' 
  | 'VIEW_ITEM' 
  | 'VIEW_CART';

export async function getOrCreateSession(phone: string, restaurantId?: string) {
  // 1. Tenta buscar sessão existente
  const { rows } = await query(
    `SELECT * FROM whatsapp_sessions WHERE customer_phone = $1`,
    [phone]
  );

  if (rows.length > 0) {
    const session = rows[0];
    
    // Se passamos um restaurantId novo e é diferente do atual, resetamos a sessão
    // (Caso o cliente clique no link de OUTRO restaurante no meio da conversa)
    if (restaurantId && session.restaurant_id !== restaurantId) {
       await updateSession(phone, { 
         restaurant_id: restaurantId, 
         step: 'IDLE', 
         metadata: {}, 
         cart: [] 
       });
       return { ...session, restaurant_id: restaurantId, step: 'IDLE' };
    }
    return session;
  }

  // 2. Se não existe e temos o ID do restaurante, cria nova
  if (restaurantId) {
    await query(
      `INSERT INTO whatsapp_sessions (customer_phone, restaurant_id, step)
       VALUES ($1, $2, 'IDLE')`,
      [phone, restaurantId]
    );
    return { customer_phone: phone, restaurant_id: restaurantId, step: 'IDLE', metadata: {}, cart: [] };
  }

  return null;
}

export async function updateSession(phone: string, data: {
  step?: WhatsAppSessionStep;
  metadata?: any;
  cart?: any[];
  restaurant_id?: string;
}) {
  // Construção dinâmica da query de update
  const fields: string[] = [];
  const values: any[] = [];
  let idx = 1;

  if (data.step) {
    fields.push(`step = $${idx++}`);
    values.push(data.step);
  }
  if (data.metadata) {
    fields.push(`metadata = $${idx++}`);
    values.push(JSON.stringify(data.metadata));
  }
  if (data.cart) {
    fields.push(`cart = $${idx++}`);
    values.push(JSON.stringify(data.cart));
  }
  if (data.restaurant_id) {
    fields.push(`restaurant_id = $${idx++}`);
    values.push(data.restaurant_id);
  }

  if (fields.length === 0) return;

  values.push(phone); // Último valor é o WHERE

  await query(
    `UPDATE whatsapp_sessions SET ${fields.join(", ")}, updated_at = NOW() WHERE customer_phone = $${idx}`,
    values
  );
}