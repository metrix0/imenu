const GRAPH_API_URL = "https://graph.facebook.com/v17.0"; // Versão da API

export async function sendWhatsAppMessage(to: string, message: string) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.error("ERRO: Credenciais do WhatsApp não configuradas no .env");
    return;
  }

  // A API do WhatsApp pede o código do país sem o "+" e sem caracteres especiais.
  // O webhook geralmente já manda limpo, mas é bom garantir.
  const cleanPhone = to.replace(/\D/g, "");

  try {
    const res = await fetch(`${GRAPH_API_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: { body: message },
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Erro ao enviar mensagem WhatsApp:", JSON.stringify(data, null, 2));
    } else {
      console.log("Mensagem enviada com sucesso para", cleanPhone);
    }
  } catch (error) {
    console.error("Erro na requisição WhatsApp:", error);
  }
}