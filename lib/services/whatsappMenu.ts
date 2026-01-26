import { query } from "@/lib/database/sql";
import { sendWhatsAppList, sendWhatsAppMessage } from "@/lib/api/whatsapp";

// Helper para cortar textos longos (Limites estritos do WhatsApp)
function safeStr(str: string, max: number) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.substring(0, max - 3) + "...";
}

export async function sendCategoriesMenu(phone: string, restaurantId: string, restaurantName: string) {
  console.log(`🔍 [DEBUG Menu] Buscando categorias para Restaurante ID: ${restaurantId}`);
  
  try {
    const { rows: categories } = await query(
      `SELECT id, name FROM categories WHERE restaurant_id = $1 ORDER BY position ASC, created_at DESC LIMIT 10`, 
      [restaurantId]
    );

    console.log(`🔍 [DEBUG Menu] Categorias encontradas: ${categories.length}`);

    if (categories.length === 0) {
      console.log(`⚠️ [DEBUG Menu] Zero categorias. Enviando msg de erro.`);
      await sendWhatsAppMessage(phone, `O restaurante *${restaurantName}* está configurando o cardápio. Tente novamente mais tarde.`);
      return;
    }

    const sections = [
      {
        title: "Categorias", // Max 24 chars
        rows: categories.map((cat: any) => ({
          id: `cat_${cat.id}`, 
          title: safeStr(cat.name, 24), // TRUNCANDO PARA 24 CHARS
          description: "Ver opções"
        }))
      }
    ];

    console.log(`🔍 [DEBUG Menu] Enviando lista para API...`);
    
    await sendWhatsAppList(
      phone,
      `Cardápio: *${safeStr(restaurantName, 60)}*\nEscolha uma categoria:`,
      "Ver Cardápio",
      sections
    );

  } catch (error) {
    console.error("❌ [ERROR Menu] Falha em sendCategoriesMenu:", error);
    await sendWhatsAppMessage(phone, "Erro ao carregar cardápio. Tente novamente.");
  }
}

export async function sendItemsMenu(phone: string, categoryId: string) {
  console.log(`🔍 [DEBUG Menu] Buscando itens para Categoria ID: ${categoryId}`);

  try {
    const { rows: items } = await query(
      `SELECT id, name, description, price_cents 
       FROM items 
       WHERE category_id = $1 AND is_available = true 
       LIMIT 10`,
      [categoryId]
    );

    console.log(`🔍 [DEBUG Menu] Itens encontrados: ${items.length}`);

    if (items.length === 0) {
      await sendWhatsAppMessage(phone, "Essa categoria não possui itens disponíveis no momento.");
      return;
    }

    const sections = [
      {
        title: "Produtos",
        rows: items.map((item: any) => {
          const price = (item.price_cents / 100).toFixed(2).replace('.', ',');
          return {
            id: `itm_${item.id}`,
            title: safeStr(item.name, 24), // Título MAX 24 chars
            description: safeStr(`R$ ${price} - ${item.description || ''}`, 72) // Descrição MAX 72 chars
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
    console.error("❌ [ERROR Menu] Falha em sendItemsMenu:", error);
  }
}