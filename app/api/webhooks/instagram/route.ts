import { NextRequest, NextResponse } from "next/server";
import { sendInstagramMessage, sendInstagramCarousel } from "@/lib/api/instagram";
import { query } from "@/lib/database/sql";

const VERIFY_TOKEN = process.env.INSTAGRAM_VERIFY_TOKEN || "imenu_instagram_secret";

// GET: Verificação da Meta (Igual ao WhatsApp)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return new NextResponse(challenge, { status: 200 });
  }
  return new NextResponse(null, { status: 403 });
}

// POST: Recebe Mensagens
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Validação específica do Instagram
    if (body.object === "instagram") {
      const entry = body.entry?.[0];
      const messaging = entry?.messaging?.[0]; // Diferença: aqui chama 'messaging'

      if (messaging) {
        const senderId = messaging.sender.id; // ID do cliente (Scoped ID do Instagram)
        
        // 1. Recebendo Texto
        if (messaging.message && messaging.message.text) {
          const incomingText = messaging.message.text.trim();
          console.log(`📸 Instagram msg de ${senderId}: ${incomingText}`);

          // --- LÓGICA DE IDENTIFICAÇÃO (Rápida para Teste) ---
          // Vamos procurar restaurante pelo nome digitado
          
          if (incomingText.length > 3) {
             const { rows } = await query(
                `SELECT id, name, slug, banner_url FROM restaurants WHERE name ILIKE $1 LIMIT 1`,
                [`%${incomingText}%`]
             );

             if (rows.length > 0) {
                 const restaurant = rows[0];
                 
                 // Exemplo: Enviar Carrossel com 1 Card Principal do Restaurante
                 await sendInstagramCarousel(senderId, [
                    {
                        title: restaurant.name,
                        subtitle: "Toque abaixo para ver o cardápio completo",
                        image_url: restaurant.banner_url || "https://via.placeholder.com/500", // Fallback image
                        buttons: [
                            {
                                type: "web_url",
                                title: "Ver Cardápio Web",
                                url: `https://imenuapp.com.br/${restaurant.slug}`
                            },
                            {
                                type: "postback", // Botão para continuar no chat
                                title: "Pedir por aqui",
                                payload: `START_ORDER_${restaurant.id}`
                            }
                        ]
                    }
                 ]);
             } else {
                 await sendInstagramMessage(senderId, "Não encontrei esse restaurante. Tente digitar o nome novamente.");
             }
          } else {
              await sendInstagramMessage(senderId, "Olá! Digite o nome do restaurante para ver o cardápio.");
          }
        }

        // 2. Recebendo Postback (Clique no Botão "Pedir por aqui")
        else if (messaging.postback) {
            const payload = messaging.postback.payload;
            console.log(`point_up Botão clicado: ${payload}`);
            
            if (payload.startsWith("START_ORDER_")) {
                await sendInstagramMessage(senderId, "Funcionalidade de pedido no chat em desenvolvimento! 🚧");
            }
        }
      }
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("❌ Erro Webhook Instagram:", error);
    return new NextResponse("Internal Server Error", { status: 200 });
  }
}