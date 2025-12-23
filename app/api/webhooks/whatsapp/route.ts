import { NextRequest, NextResponse } from "next/server";

// TOKEN DE VERIFICAÇÃO (Você inventa. Tem que ser igual no painel da Meta)
const VERIFY_TOKEN = "imenu_secret_verify_token";

// GET: Usado pela Meta para verificar se o Webhook é válido (Handshake)
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;

  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Se a Meta estiver tentando verificar o webhook
  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      console.log("WEBHOOK_VERIFIED");
      // Retorna o "challenge" para confirmar que somos nós
      return new NextResponse(challenge, { status: 200 });
    } else {
      // Senha errada
      return new NextResponse(null, { status: 403 });
    }
  }

  return new NextResponse(null, { status: 400 });
}

// POST: Usado para receber as mensagens reais do WhatsApp
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Log para vermos a estrutura da mensagem chegando (útil para debug)
    console.log("Mensagem recebida do WhatsApp:", JSON.stringify(body, null, 2));

    // A Meta exige que retornemos 200 OK imediatamente, senão eles ficam tentando reenviar
    // Logica de processar a mensagem virá depois aqui...
    
    return new NextResponse("EVENT_RECEIVED", { status: 200 });
  } catch (error) {
    console.error("Erro no webhook:", error);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}