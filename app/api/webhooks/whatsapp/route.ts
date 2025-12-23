import { NextRequest, NextResponse } from "next/server";
import { sendWhatsAppMessage } from "@/lib/api/whatsapp";

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

      // Se houver mensagens (pode ser status update, lido, digitando... ignoramos esses por enquanto)
      if (messages && messages.length > 0) {
        const message = messages[0];
        const from = message.from; // Número do cliente (ex: 5511999999999)
        const msgBody = message.text?.body; // Conteúdo da mensagem de texto
        const name = value.contacts?.[0]?.profile?.name || "Cliente"; // Nome do perfil (nem sempre vem)

        console.log(`Mensagem de ${name} (${from}): ${msgBody}`);

        // 2. Lógica do Bot (MVP)
        // Aqui definimos o que responder. Por enquanto, hardcoded.
        // Futuramente pegaremos o link do restaurante baseado no número de destino (se tivermos vários números)
        // ou faremos um fluxo de conversa.
        
        const welcomeMessage = `Olá, ${name}! 👋\n\nBem-vindo ao *Imenu*.\n\nPara fazer seu pedido, acesse nosso cardápio digital:\n👉 https://imenuapp.com.br/demo\n\nQualquer dúvida, chame o garçom!`;

        // 3. Enviar a resposta (Não usamos await para não travar a resposta 200 OK para a Meta)
        // A Meta exige resposta em poucos segundos ou considera falha.
        sendWhatsAppMessage(from, welcomeMessage);
      }
    }

    // Sempre retorne 200 OK para a Meta saber que recebemos
    return new NextResponse("EVENT_RECEIVED", { status: 200 });

  } catch (error) {
    console.error("Erro no webhook:", error);
    // Mesmo com erro, retornamos 200 para não travar a fila de mensagens do WhatsApp
    return new NextResponse("Internal Server Error", { status: 200 });
  }
}