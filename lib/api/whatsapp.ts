const GRAPH_API_URL = "https://graph.facebook.com/v17.0";

export async function sendWhatsAppMessage(to: string, message: string) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = process.env.WHATSAPP_PHONE_ID;

  if (!token || !phoneId) {
    console.error("ERRO: Credenciais do WhatsApp não configuradas no .env");
    return;
  }

  // Limpeza básica do número
  const cleanPhone = to.replace(/\D/g, "");

  try {
    // TENTATIVA VIA TEMPLATE (Para driblar restrições de texto livre)
    const body = JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "template",
      template: {
        name: "hello_world", // Template padrão que já vem aprovado
        language: {
          code: "en_US" // O template padrão costuma ser em inglês
        }
      }
    });

    // Se quiser voltar para texto livre depois, descomente isso e comente o bloco acima:
    /*
    const body = JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "text",
      text: { body: message },
    });
    */

    const res = await fetch(`${GRAPH_API_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: body,
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Erro ao enviar mensagem WhatsApp:", JSON.stringify(data, null, 2));
    } else {
      console.log("Mensagem (Template) enviada com sucesso para", cleanPhone);
    }
  } catch (error) {
    console.error("Erro na requisição WhatsApp:", error);
  }
}