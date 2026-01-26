// lib/api/whatsapp.ts

const GRAPH_API_URL = "https://graph.facebook.com/v19.0";

/**
 * Helper: Limpa e formata o telefone para o padrão E.164 (sem +)
 * Ex: (19) 99999-9999 -> 5519999999999
 */
function getCleanPhone(phone: string | null | undefined) {
  if (!phone) return "";

  // 1. Remove tudo que não é número
  let clean = phone.replace(/\D/g, "");

  // 2. Tratamento para número de teste da Meta (EUA - começa com 1555...)
  if (clean.startsWith("1555")) {
    return clean;
  }

  // 3. Lógica Brasil
  // Se já começar com 55 e tiver mais de 10 digitos, CONFIA no que veio do Webhook
  if (clean.startsWith("55") && clean.length >= 12) {
      return clean; 
  }

  // Só adiciona 55 se parecer que está faltando
  if (clean.length >= 10 && clean.length <= 11) {
    clean = "55" + clean;
  }

  return clean;
}

/**
 * Helper: Gera os headers de autenticação
 */
function getHeaders() {
  const token = process.env.WHATSAPP_API_TOKEN;
  if (!token) {
    console.error("❌ [FATAL] WHATSAPP_API_TOKEN está vazio ou indefinido no .env");
  }
  return {
    "Authorization": `Bearer ${token}`,
    "Content-Type": "application/json",
  };
}

// --- FUNÇÃO 1: ENVIO DE TEXTO SIMPLES ---
export async function sendWhatsAppMessage(to: string, message: string) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!phoneId) {
    console.error("❌ [CONFIG ERROR] WHATSAPP_PHONE_ID não definido.");
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

    if (!res.ok) {
        const errorData = await res.json();
        console.error("❌ [API ERROR] Falha ao enviar texto:", JSON.stringify(errorData, null, 2));
    } else {
        // console.log(`✅ Texto enviado para ${cleanPhone}`);
    }
  } catch (error) {
    console.error("❌ [FETCH ERROR] sendWhatsAppMessage:", error);
  }
}

// --- FUNÇÃO 2: ENVIO DE TEMPLATE (Notificações) ---
export async function sendWhatsAppTemplate(to: string, templateName: string, variables: string[]) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!phoneId) return;

  const cleanPhone = getCleanPhone(to);
  if (!cleanPhone) return;

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
          language: { code: "pt_BR" }, // Ajustado para Português
          components: [{ type: "body", parameters }]
        }
      }),
    });

    if (!res.ok) {
        const errorData = await res.json();
        console.error(`❌ [API ERROR] Falha no Template '${templateName}':`, JSON.stringify(errorData, null, 2));
    } else {
        console.log(`✅ Template '${templateName}' enviado para ${cleanPhone}`);
    }
  } catch (error) {
    console.error("❌ [FETCH ERROR] sendWhatsAppTemplate:", error);
  }
}

// --- FUNÇÃO 3: MENU INTERATIVO (Link Externo / CTA) ---
// Útil se quisermos enviar o cliente para o site finalizar o pagamento
export async function sendWhatsAppInteractiveMenu(to: string, restaurantName: string, menuUrl: string, bannerUrl: string | null) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
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
        
        // Header: Imagem ou Texto
        header: bannerUrl ? {
            type: "image",
            image: { link: bannerUrl }
        } : {
            type: "text",
            text: restaurantName.substring(0, 60)
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

    if (!res.ok) {
        const errorData = await res.json();
        console.error("❌ [API ERROR] CTA Menu:", JSON.stringify(errorData, null, 2));
    } else {
        console.log(`✅ CTA Menu enviado para ${cleanPhone}`);
    }
  } catch (error) {
    console.error("❌ [FETCH ERROR] sendWhatsAppInteractiveMenu:", error);
  }
}

// --- FUNÇÃO 4: LISTA DE OPÇÕES (Categorias e Itens) ---
// Essencial para o fluxo de carrinho dentro do WhatsApp

export interface ListSection {
  title: string;
  rows: { id: string; title: string; description?: string }[];
}

export async function sendWhatsAppList(
  to: string, 
  bodyText: string, 
  buttonText: string, 
  sections: ListSection[]
) {
  const phoneId = process.env.WHATSAPP_PHONE_ID;
  if (!phoneId) {
      console.error("❌ WHATSAPP_PHONE_ID ausente.");
      return;
  }

  const cleanPhone = getCleanPhone(to);
  if (!cleanPhone) return;

  const body = {
    messaging_product: "whatsapp",
    recipient_type: "individual",
    to: cleanPhone,
    type: "interactive",
    interactive: {
      type: "list",
      header: { type: "text", text: "Cardápio Digital" },
      body: { text: bodyText.substring(0, 1024) },
      footer: { text: "Selecione uma opção" },
      action: {
        button: buttonText.substring(0, 20), // Max 20 chars
        sections: sections
      }
    }
  };

  try {
    const res = await fetch(`${GRAPH_API_URL}/${phoneId}/messages`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(body),
    });

    if (!res.ok) {
        const errorData = await res.json();
        // LOG CRÍTICO PARA DEBUG
        console.error("❌ [API ERROR] WhatsApp List Response:", JSON.stringify(errorData, null, 2));
        console.error("❌ [DEBUG] Payload enviado:", JSON.stringify(body, null, 2));
    } else {
        console.log("✅ [API SUCCESS] Lista enviada com sucesso!");
    }
  } catch (err) {
      console.error("❌ [FETCH ERROR] sendWhatsAppList:", err);
  }
}