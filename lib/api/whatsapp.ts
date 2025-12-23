const GRAPH_API_URL = "https://graph.facebook.com/v17.0";


/**
 * Envia uma mensagem via Template do WhatsApp Cloud API
 * @param to Telefone do destinatário (ex: 551999999999)
 * @param templateName Nome do template criado no painel da Meta (ex: order_status_update)
 * @param variables Array com as strings que substituem {{1}}, {{2}}, etc.
 */

function getCleanPhone(phone: string) {
    return phone.replace(/\D/g, "");
}

function getHeaders() {
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!token) console.error("ERRO: WHATSAPP_API_TOKEN ausente.");
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}

const phoneId = process.env.WHATSAPP_PHONE_ID;

// --- FUNÇÃO 1: ENVIO DE TEXTO LIVRE (Para Respostas do Bot) ---
export async function sendWhatsAppMessage(to: string, message: string) {
  if (!phoneId) return;
  const cleanPhone = getCleanPhone(to);

  try {
    const res = await fetch(`${GRAPH_API_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: getHeaders(),
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
        console.error("Erro ao enviar msg de texto:", JSON.stringify(data, null, 2));
    } else {
        console.log("Msg de texto enviada para", cleanPhone);
    }
  } catch (error) {
    console.error("Erro requisição WhatsApp:", error);
  }
}



export async function sendWhatsAppTemplate(to: string, templateName: string, variables: string[]) {
  const token = process.env.WHATSAPP_API_TOKEN;
  const phoneId = getCleanPhone(to);

  if (!token || !phoneId) {
    console.error("ERRO: Credenciais do WhatsApp não configuradas no .env");
    return;
  }

  // Limpeza básica do número
  const cleanPhone = to.replace(/\D/g, "");

  try {
    // Monta o array de parametros no formato que a Meta exige
    // Ex: [{ type: "text", text: "João" }, { type: "text", text: "Pizzaria" }]
    const parameters = variables.map(variable => ({
        type: "text",
        text: variable
    }));

    const body = JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "template",
      template: {
        name: templateName,
        language: {
          code: "pt_BR" // Importante bater com o idioma criado no painel
        },
        components: [
          {
            type: "body",
            parameters: parameters
          }
        ]
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
      console.error("Erro ao enviar Template WhatsApp:", JSON.stringify(data, null, 2));
    } else {
      console.log(`Template '${templateName}' enviado para ${cleanPhone}`);
    }
  } catch (error) {
    console.error("Erro na requisição WhatsApp:", error);
  }
}

// --- FUNÇÃO 3: ENVIO DE MENU INTERATIVO (Dinâmico) ---
export async function sendWhatsAppInteractiveMenu(
    to: string, 
    restaurantName: string, 
    menuUrl: string, 
    bannerUrl: string | null
) {
  if (!phoneId) return;
  const cleanPhone = getCleanPhone(to);

  try {
    const body = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: cleanPhone,
      type: "interactive",
      interactive: {
        type: "cta_url",
        
        // Header: Usa o Banner do restaurante ou Texto se não tiver
        header: bannerUrl ? {
            type: "image",
            image: { link: bannerUrl }
        } : {
            type: "text",
            text: restaurantName.substring(0, 60) // Limite do Whats
        },

        body: {
          text: `Olá! 👋 Bem-vindo ao *${restaurantName}*.\n\nPara fazer seu pedido com fotos e descrição, acesse nosso cardápio digital:`
        },
        
        footer: {
          text: "Rápido, fácil e sem app."
        },

        action: {
          name: "cta_url",
          parameters: {
            display_text: "Ver Cardápio",
            url: menuUrl
          }
        }
      }
    };

    const res = await fetch(`${GRAPH_API_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
        console.error("Erro ao enviar Menu Interativo:", JSON.stringify(data, null, 2));
    } else {
        console.log(`Menu de '${restaurantName}' enviado para ${cleanPhone}`);
    }
  } catch (error) {
    console.error("Erro requisição WhatsApp:", error);
  }
}