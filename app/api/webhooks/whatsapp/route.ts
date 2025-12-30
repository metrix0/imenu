import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/api/whatsapp";
import { query } from "@/lib/database/sql";
import { getOrCreateSession, updateSession } from "@/lib/services/whatsappSession";
import { sendCategoriesMenu, sendItemsMenu } from "@/lib/services/whatsappMenu";

// Força a renderização dinâmica para evitar cache de respostas antigas no Vercel
export const dynamic = 'force-dynamic'; 

// ----------------------------------------------------------------------
// GET: Validação do Webhook (Meta Challenge)
// ----------------------------------------------------------------------
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const mode = searchParams.get("hub.mode");
    const token = searchParams.get("hub.verify_token");
    const challenge = searchParams.get("hub.challenge");

    const ENV_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN;

    console.log("--- TENTATIVA DE VERIFICAÇÃO ---");
    // Logs seguros (não expor o token real em logs de produção se possível, mas ok para debug inicial)
    console.log(`Mode: ${mode} | Token Recebido: ${token} | Esperado: ${ENV_TOKEN}`);

    if (mode === "subscribe" && token === ENV_TOKEN) {
      console.log("✅ SUCESSO: Webhook verificado!");
      
      // Retorna o challenge como texto puro e status 200 (Crítico para aprovação do Facebook)
      return new NextResponse(challenge, { 
        status: 200,
        headers: { "Content-Type": "text/plain" }
      });
    }

    console.log("❌ FALHA: Tokens não batem ou requisição inválida.");
    return new NextResponse("Forbidden", { status: 403 });
  } catch (error) {
    console.error("Erro fatal no GET:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}

// ----------------------------------------------------------------------
// POST: Recebimento de Eventos (Mensagens, Status, etc)
// ----------------------------------------------------------------------
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Verifica se é um evento do WhatsApp Business
    if (body.object === "whatsapp_business_account") {
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      
      // A. Tratamento de Status (Entregue, Lido, Enviado)
      // O WhatsApp manda eventos de status separadamente das mensagens.
      // Precisamos retornar 200 rápido para não travar a fila.
      if (value?.statuses) {
        // Futuramente: Podemos atualizar o status do pedido no banco aqui (Ex: 'msg lida')
        return new NextResponse("STATUS_RECEIVED", { status: 200 });
      }

      // B. Tratamento de Mensagens Recebidas
      const messages = value?.messages;
      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from; // Telefone do Cliente
        
        // ---------------------------------------------------------
        // 1. MENSAGENS DE TEXTO (Deep Link ou Busca)
        // ---------------------------------------------------------
        if (message.type === "text") {
            const incomingText = message.text.body.trim();
            console.log(`📩 Texto de ${from}: "${incomingText}"`);

            // Regex para Deep Link: "pedido: slug", "ir para slug" ou "#slug"
            const slugRegex = /(?:pedido:|ir para|#)\s*([\w-]+)/i;
            const match = incomingText.match(slugRegex);

            let restaurant = null;

            if (match && match[1]) {
                // Busca Exata (Deep Link)
                const { rows } = await query(
                    `SELECT id, name, slug FROM restaurants WHERE slug = $1 LIMIT 1`, 
                    [match[1].toLowerCase()]
                );
                if (rows.length > 0) restaurant = rows[0];
            } else if (incomingText.length >= 3) {
                // Busca Fuzzy (Nome do Restaurante)
                const { rows } = await query(
                    `SELECT id, name, slug FROM restaurants WHERE slug = $1 OR name ILIKE $2 LIMIT 1`,
                    [incomingText.toLowerCase(), `%${incomingText}%`]
                );
                if (rows.length > 0) restaurant = rows[0];
            }

            if (restaurant) {
                // 1.1 Inicia/Atualiza Sessão
                await getOrCreateSession(from, restaurant.id);
                // Atualiza o passo para garantir que o bot sabe que estamos no menu
                await updateSession(from, { step: 'VIEW_MENU', restaurant_id: restaurant.id });

                // 1.2 Responde com as Categorias (Menu Principal)
                await sendCategoriesMenu(from, restaurant.id, restaurant.name);
                
            } else {
                // Se não achou nada, manda mensagem genérica
                await sendWhatsAppMessage(from, `Olá! Não encontrei o restaurante. Tente usar o link oficial ou digite o nome corretamente.`);
            }
        }

        // ---------------------------------------------------------
        // 2. INTERAÇÕES (Cliques em Listas/Botões)
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

            // Recupera sessão para saber o contexto (Restaurante ID)
            const session = await getOrCreateSession(from);
            
            if (!session || !session.restaurant_id) {
                await sendWhatsAppMessage(from, "Sua sessão expirou. Por favor, digite o nome do restaurante novamente para recomeçar.");
                return new NextResponse("SESSION_EXPIRED", { status: 200 });
            }

            // 2.1 CLIQUE EM CATEGORIA (ID começa com "cat_")
            if (buttonId.startsWith("cat_")) {
                const categoryId = buttonId.replace("cat_", "");
                
                await updateSession(from, { step: 'VIEW_CATEGORY', metadata: { category_id: categoryId } });
                await sendItemsMenu(from, categoryId);
            }

            // 2.2 CLIQUE EM ITEM (ID começa com "itm_")
            else if (buttonId.startsWith("itm_")) {
                const itemId = buttonId.replace("itm_", "");
                
                await updateSession(from, { step: 'VIEW_ITEM', metadata: { item_id: itemId } });
                
                // TODO: Futuramente, verificar complementos aqui.
                await sendWhatsAppMessage(from, `✅ Item selecionado (ID: ${itemId}). Em breve você poderá adicionar ao carrinho!`);
            }
        }
      }
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("❌ Erro no webhook POST:", error);
    // Retornamos 200 para o WhatsApp não ficar tentando reenviar a mensagem bugada infinitamente
    return new NextResponse("Internal Server Error", { status: 200 });
  }
}