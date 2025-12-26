const GRAPH_API_URL = "https://graph.facebook.com/v17.0";


/**
 * Envia uma mensagem via Template do WhatsApp Cloud API
 * @param to Telefone do destinatário (ex: 551999999999)
 * @param templateName Nome do template criado no painel da Meta (ex: order_status_update)
 * @param variables Array com as strings que substituem {{1}}, {{2}}, etc.
 */

function getCleanPhone(phone: string | null | undefined) {
    if (!phone) return "";

    // 1. Remove tudo que não é número: (19) 99... -> 1999...
    let clean = phone.replace(/\D/g, "");

    // 2. Se o número tiver 10 ou 11 dígitos (ex: 19999253315), assume que é BR e adiciona 55
    if (clean.length >= 10 && clean.length <= 11) {
        clean = "55" + clean;
    }

    return clean;
}

function getHeaders() {
    const token = process.env.WHATSAPP_API_TOKEN;
    if (!token) {
        // Log de Debug para ver o que está acontecendo
        console.error("❌ ERRO FATAL: WHATSAPP_API_TOKEN está vazio ou indefinido.");
    }
    return {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
    };
}

const phoneId = process.env.WHATSAPP_PHONE_ID;

// --- FUNÇÃO 1: ENVIO DE TEXTO LIVRE (Para Respostas do Bot) ---
export async function sendWhatsAppMessage(to: string, message: string) {
  if (!phoneId) {
      console.error("❌ ERRO: WHATSAPP_PHONE_ID não definido.");
      return;
  }
  const cleanPhone = getCleanPhone(to);
  if (!cleanPhone) return;

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
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!phoneId) {
      console.error("❌ ERRO: WHATSAPP_PHONE_ID não definido.");
      return;
  }
  const cleanPhone = getCleanPhone(to);

  if (!cleanPhone) {
      console.error(`[WhatsApp] Erro: Telefone inválido: ${to}`);
      return;
  }



  try {
    const parameters = variables.map(variable => ({
        type: "text",
        text: variable
    }));

    const res = await fetch(`${GRAPH_API_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "template",
        template: {
          name: templateName,
          language: { code: "en_US" },
          components: [{ type: "body", parameters }]
        }
      }),
    });

    const data = await res.json();
    if (!res.ok) {
        console.error("Erro Template:", JSON.stringify(data, null, 2));
    } else {
        console.log(`✅ Template '${templateName}' enviado para ${cleanPhone}`);
    }
  } catch (error) {
    console.error("Erro requisição WhatsApp:", error);
  }
}

// --- FUNÇÃO 3: ENVIO DE MENU INTERATIVO (Dinâmico) ---
export async function sendWhatsAppInteractiveMenu(to: string, restaurantName: string, menuUrl: string, bannerUrl: string | null) {
  const phoneId = process.env.WHATSAPP_PHONE_ID; // Lendo dentro da função
    if (!phoneId) return;
  const cleanPhone = getCleanPhone(to);
    if (!cleanPhone) return;

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