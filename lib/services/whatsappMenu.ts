import { query } from "@/lib/database/sql";
import { sendWhatsAppList, sendWhatsAppMessage } from "@/lib/api/whatsapp";

// Busca categorias e envia como Lista
export async function sendCategoriesMenu(phone: string, restaurantId: string, restaurantName: string) {
  try {
    // Busca categorias ativas do restaurante
    // Ajuste "position" ou "created_at" conforme sua ordenação desejada
    const { rows: categories } = await query(
      `SELECT id, name FROM categories WHERE restaurant_id = $1 ORDER BY name ASC LIMIT 10`, 
      [restaurantId]
    );

    if (categories.length === 0) {
      await sendWhatsAppMessage(phone, `O restaurante ${restaurantName} ainda não cadastrou categorias.`);
      return;
    }

    // Formata para o WhatsApp (Max 10 itens numa Section)
    const sections = [
      {
        title: "Categorias",
        rows: categories.map((cat: any) => ({
          id: `cat_${cat.id}`, // Prefixo para identificar que é um clique em Categoria
          title: cat.name,
          description: "Ver itens"
        }))
      }
    ];

    await sendWhatsAppList(
      phone,
      `Cardápio Digital: *${restaurantName}*\n\nEscolha uma categoria para ver os itens:`,
      "Ver Categorias",
      sections
    );

  } catch (error) {
    console.error("Erro ao buscar categorias:", error);
    await sendWhatsAppMessage(phone, "Erro ao carregar cardápio. Tente novamente.");
  }
}

// Busca itens de uma categoria e envia como Lista
export async function sendItemsMenu(phone: string, categoryId: string) {
  try {
    // Busca itens da categoria
    const { rows: items } = await query(
      `SELECT id, name, description, price_cents 
       FROM items 
       WHERE category_id = $1 AND is_available = true 
       LIMIT 10`,
      [categoryId]
    );

    if (items.length === 0) {
      await sendWhatsAppMessage(phone, "Essa categoria não possui itens disponíveis no momento.");
      return;
    }

    // Formata para o WhatsApp
    const sections = [
      {
        title: "Produtos",
        rows: items.map((item: any) => {
          const price = (item.price_cents / 100).toFixed(2).replace('.', ',');
          return {
            id: `itm_${item.id}`, // Prefixo para identificar que é um clique em Item
            title: item.name,
            description: `R$ ${price} - ${item.description ? item.description.substring(0, 30) + '...' : ''}`
          };
        })
      }
    ];

    await sendWhatsAppList(
      phone,
      "Aqui estão as opções disponíveis:",
      "Ver Produtos",
      sections
    );

  } catch (error) {
    console.error("Erro ao buscar itens:", error);
  }
}