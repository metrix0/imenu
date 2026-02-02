// lib/api/instagram.ts

const GRAPH_API_URL = "https://graph.facebook.com/v19.0";
const ACCESS_TOKEN = process.env.INSTAGRAM_PAGE_ACCESS_TOKEN;

// Interface para os Elementos do Carrossel (Cardápio)
interface CarouselElement {
  title: string;
  subtitle?: string;
  image_url: string;
  buttons: {
    type: "postback" | "web_url";
    title: string;
    payload?: string; // Para postback (ID do item)
    url?: string;     // Para web_url
  }[];
}

// Enviar Mensagem de Texto Simples
export async function sendInstagramMessage(recipientId: string, text: string) {
  if (!ACCESS_TOKEN) return;

  try {
    const res = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${ACCESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: { text: text },
      }),
    });

    if (!res.ok) {
        const error = await res.json();
        console.error("❌ Erro Instagram Text:", JSON.stringify(error, null, 2));
    }
  } catch (error) {
    console.error("Erro requisição Instagram:", error);
  }
}

// Enviar Carrossel (Generic Template) - Ideal para Cardápio
export async function sendInstagramCarousel(recipientId: string, elements: CarouselElement[]) {
  if (!ACCESS_TOKEN) return;

  // Instagram permite no máximo 10 cards por carrossel
  const slicedElements = elements.slice(0, 10);

  try {
    const res = await fetch(`${GRAPH_API_URL}/me/messages?access_token=${ACCESS_TOKEN}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: recipientId },
        message: {
          attachment: {
            type: "template",
            payload: {
              template_type: "generic",
              elements: slicedElements.map(el => ({
                title: el.title,
                subtitle: el.subtitle,
                image_url: el.image_url,
                buttons: el.buttons.map(btn => ({
                  type: btn.type,
                  title: btn.title,
                  payload: btn.payload,
                  url: btn.url
                }))
              }))
            }
          }
        },
      }),
    });

    if (!res.ok) {
        const error = await res.json();
        console.error("❌ Erro Instagram Carousel:", JSON.stringify(error, null, 2));
    }
  } catch (error) {
    console.error("Erro requisição Instagram Carousel:", error);
  }
}