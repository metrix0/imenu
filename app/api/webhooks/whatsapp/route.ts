import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/api/whatsapp";
import { query } from "@/lib/database/sql";
import { getOrCreateSession, updateSession } from "@/lib/services/whatsappSession";
import { sendCategoriesMenu, sendItemsMenu } from "@/lib/services/whatsappMenu";

const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

// GET: Verificação do Webhook pela Meta
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return new NextResponse(challenge, { status: 200 });
    } else {
      return new NextResponse(null, { status: 403 });
    }
  }
  return new NextResponse(null, { status: 400 });
}

// POST: Recebimento de Mensagens
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    if (body.object === "whatsapp_business_account") {
      const value = body.entry?.[0]?.changes?.[0]?.value;
      const messages = value?.messages;
      const statuses = value?.statuses; // <--- ONDE O ERRO VAI APARECER

      // 1. MONITORAMENTO DE STATUS (Para descobrir por que não chega)
      if (statuses && statuses.length > 0) {
          const status = statuses[0];
          console.log(`🔔 [STATUS UPDATE] ID: ${status.id} | Status: ${status.status}`);
          
          if (status.errors) {
              console.error("❌ [ERRO DE ENTREGA]:", JSON.stringify(status.errors, null, 2));
          }
          return new NextResponse("STATUS_RECEIVED", { status: 200 });
      }

      // 2. PROCESSAMENTO DE MENSAGENS
      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from; // Vamos confiar no from que vem (9 dígitos)
        
        if (message.type === "text") {
            const incomingText = message.text.body.trim();
            console.log(`🔍 [DEBUG] Texto de ${from}: "${incomingText}"`);

            const slugRegex = /(?:pedido:|ir para|#)\s*([\w-]+)/i;
            const match = incomingText.match(slugRegex);
            let restaurant = null;

            // Busca no Banco
            if (match && match[1]) {
                 const { rows } = await query(
                    `SELECT id, name, url_slug as slug, banner_url FROM restaurants WHERE url_slug = $1 LIMIT 1`, 
                    [match[1].toLowerCase()]
                );
                if (rows.length > 0) restaurant = rows[0];
            } else if (incomingText.length >= 3) {
                 const { rows } = await query(
                    `SELECT id, name, url_slug as slug, banner_url FROM restaurants WHERE url_slug = $1 OR name ILIKE $2 LIMIT 1`,
                    [incomingText.toLowerCase(), `%${incomingText}%`]
                );
                if (rows.length > 0) restaurant = rows[0];
            }

            if (restaurant) {
                console.log(`✅ Restaurante encontrado: ${restaurant.name}`);
                
                await getOrCreateSession(from, restaurant.id);
                await updateSession(from, { step: 'VIEW_MENU', restaurant_id: restaurant.id });

                // Tenta enviar o texto simples primeiro para garantir
                await sendWhatsAppMessage(from, `Olá! Bem-vindo ao *${restaurant.name}*!`);
                
                // Se o texto acima funcionar, descomente a linha abaixo para ligar o menu:
                // await sendCategoriesMenu(from, restaurant.id, restaurant.name);
                
            } else {
                await sendWhatsAppMessage(from, "Restaurante não encontrado.");
            }
        }

        // ---------------------------------------------------------
        // 2. TRATAMENTO DE INTERAÇÃO (Cliques em Botões/Listas)
        // ---------------------------------------------------------
        else if (message.type === "interactive") {
            const interaction = message.interactive;
            let buttonId = "";

            if (interaction.type === "list_reply") {
                buttonId = interaction.list_reply.id;
            } else if (interaction.type === "button_reply") {
                buttonId = interaction.button_reply.id;
            }

            console.log(`👆 Clique de ${from}: ID "${buttonId}"`);

            const session = await getOrCreateSession(from);
            
            if (!session || !session.restaurant_id) {
                await sendWhatsAppMessage(from, "Sua sessão expirou. Por favor, digite o nome do restaurante novamente.");
                return new NextResponse("SESSION_EXPIRED", { status: 200 });
            }

            // 2.1 CLIQUE EM CATEGORIA (Ex: cat_uuid-da-categoria)
            if (buttonId.startsWith("cat_")) {
                const categoryId = buttonId.replace("cat_", "");
                await updateSession(from, { step: 'VIEW_CATEGORY', metadata: { category_id: categoryId } });
                await sendItemsMenu(from, categoryId);
            }

            // 2.2 CLIQUE EM ITEM (Ex: itm_uuid-do-item)
            else if (buttonId.startsWith("itm_")) {
                const itemId = buttonId.replace("itm_", "");
                await updateSession(from, { step: 'VIEW_ITEM', metadata: { item_id: itemId } });
                await sendWhatsAppMessage(from, `✅ Você selecionou o item ID: ${itemId}.\n\n(A funcionalidade de adicionar ao carrinho virá no próximo update!)`);
            }
        }
      }
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("❌ [CRITICAL ERROR] Webhook:", error);
    return new NextResponse("Internal Server Error", { status: 200 });
  }
}