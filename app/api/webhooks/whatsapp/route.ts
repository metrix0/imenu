import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppInteractiveMenu, sendWhatsAppMessage } from "@/lib/api/whatsapp";
import { query } from "@/lib/database/sql";

const VERIFY_TOKEN = "imenu_secret_verify_token";

// GET: Verificação da Meta (Mantido igual)
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

// POST: Recebe mensagens e Responde
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // 1. Validar se é uma mensagem do WhatsApp Business API
    if (body.object === "whatsapp_business_account") {
      
      // Navega pelo JSON gigante do WhatsApp
      const entry = body.entry?.[0];
      const changes = entry?.changes?.[0];
      const value = changes?.value;
      const messages = value?.messages;
      
      // --- ADICIONE ESTE BLOCO ABAIXO ---
      const statuses = value?.statuses;
      if (statuses && statuses.length > 0) {
        const status = statuses[0];
        console.log(`⚡ STATUS ATUALIZADO: ${status.status}`);
        if (status.errors) {
          console.error("❌ ERRO NA ENTREGA:", JSON.stringify(status.errors, null, 2));
        }
        return new NextResponse("STATUS_RECEIVED", { status: 200 });
      }
      // ----------------------------------

      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from;
        
        // Ignora status updates e mensagens vazias
        if (!message.text) return new NextResponse("OK", { status: 200 });

        console.log(`Mensagem de ${from}: ${message.text.body}`);

        // --- LÓGICA DO BOT DINÂMICA ---
        
        // 1. Buscar dados do Restaurante no Banco
        // NOTA: No futuro, filtraremos pelo ID do WhatsApp. Por enquanto, pegamos o primeiro.
        const { rows } = await query(
            `SELECT id, name, slug, banner_url FROM restaurants LIMIT 1`
        );
        
        if (rows.length > 0) {
            const restaurant = rows[0];
            
            // 2. Montar URLs reais
            // Supondo que sua URL base seja essa. Ajuste se necessário.
            const baseUrl = "https://imenuapp.com.br"; 
            const menuUrl = `${baseUrl}/${restaurant.slug}`; // Ex: imenuapp.com.br/burguer-king
            
            // Fallback de imagem se o restaurante não tiver banner
            const bannerUrl = restaurant.banner_url || "https://images.unsplash.com/photo-1544025162-d76690b6d01d?q=80&w=1000&auto=format&fit=crop";

            // 3. Enviar Menu Dinâmico
            await sendWhatsAppInteractiveMenu(from, restaurant.name, menuUrl, bannerUrl);
        } else {
            console.error("Nenhum restaurante encontrado no banco para responder.");
            // Fallback opcional: manda mensagem de erro ou demo
            await sendWhatsAppMessage(from, "Desculpe, sistema em manutenção.");
        }
      }
    }

    return new NextResponse("EVENT_RECEIVED", { status: 200 });

  } catch (error) {
    console.error("Erro no webhook:", error);
    return new NextResponse("Internal Server Error", { status: 200 });
  }
}