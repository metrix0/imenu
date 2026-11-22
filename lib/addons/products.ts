export const ADDON_PRODUCTS = {
  qr_code_mesa: { key: "qr_code_mesa", name: "iMenu QR Code Mesa", priceCents: 0, referencePrefix: "qr-table" },
  ia_plus: { key: "ia_plus", name: "iMenu Plus", priceCents: 4999, referencePrefix: "ia-plus" },
} as const;
export type AddonProduct = (typeof ADDON_PRODUCTS)[keyof typeof ADDON_PRODUCTS];
export const IA_PLUS = ADDON_PRODUCTS.ia_plus;
export const IA_PLUS_FEATURE_MESSAGE = "Essa é uma função do plano iMenu Plus";
import { Bot, FileDown, Film, Headset, Megaphone, MessageCircle, Moon, ShoppingCart, TrendingUp } from "lucide-react";

export const IA_PLUS_BENEFITS = [
  { id: "marketing", title: "Automações de Marketing WhatsApp", landingTitle: "Automações de Marketing WhatsApp", milestoneLabel: "as automações de marketing", description: "Recupere carrinhos, reative clientes e incentive novos pedidos com mensagens automáticas no WhatsApp.", icon: Megaphone },
  { id: "assistant", title: "Assistente IA", landingTitle: "Assistente IA: para Melhorar o Cardápio", milestoneLabel: "o Assistente IA", description: "Converse com a IA, gere imagens e melhore seu cardápio com sugestões que você revisa antes de aplicar.", icon: Bot },
  { id: "sales", title: "Vendas IA", landingTitle: "Vendas IA", milestoneLabel: "o Vendas IA", description: "Analise suas vendas, descubra oportunidades e aplique melhorias depois de revisar cada sugestão.", icon: TrendingUp },
] as const;
export const IA_PLUS_BONUSES = [
  { id: "menu_media", title: "Múltiplas fotos e vídeo no cardápio", description: "Mostre cada produto com até três mídias no total, com múltiplas fotos e até um vídeo.", icon: Film },
  { id: "whatsapp_ai", title: "Robô WhatsApp com IA", description: "Seu robô do WhatsApp mais inteligente, respondendo qualquer tipo de pergunta!", icon: Bot },
  { id: "exclusive_support", title: "Atendimento exclusivo", description: "Solicite integrações e novas funcionalidades com atendimento exclusivo e entrega em até 3 dias úteis.", icon: Headset },
  { id: "automatic_upsell", title: "Upsells automáticos", description: "Sugira automaticamente produtos que combinam com o pedido para aumentar o ticket médio.", icon: ShoppingCart },
  { id: "order_notifications", title: "Atualizações de pedidos pelo WhatsApp", description: "Notifique clientes pelo WhatsApp quando o pedido estiver pronto ou sair para entrega.", icon: MessageCircle },
  { id: "menu_pdf", title: "Download Cardápio em PDF", description: "Baixe seu cardápio em PDF para imprimir ou compartilhar.", icon: FileDown },
  { id: "dark_menu", title: "Cardápio Tema Escuro", description: "Personalize seu cardápio com uma aparência escura.", icon: Moon },
] as const;
export const IA_PLUS_PRICE_LABEL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(IA_PLUS.priceCents / 100);

// The support bot reads this derived entry instead of maintaining a duplicate Plus list.
export function getIMenuPlusProductKnowledge(includePrice = false) {
  const benefits = IA_PLUS_BENEFITS.map(({ title, description }) => `${title}: ${description}`).join("; ");
  const bonuses = IA_PLUS_BONUSES.map(({ title, description }) => `${title}: ${description}`).join("; ");
  return {
    id: "product:imenu-plus",
    title: "iMenu Plus — benefícios e bônus atuais",
    content: `O iMenu Plus tem ${IA_PLUS_BENEFITS.length} recursos principais: ${benefits}. Inclui ${IA_PLUS_BONUSES.length} bônus: ${bonuses}. Scanear cardápio com IA, QR Code Mesa e Modo Vitrine também estão disponíveis gratuitamente; não são bônus exclusivos do Plus.${includePrice ? ` O iMenu Plus custa ${IA_PLUS_PRICE_LABEL} por mês.` : ""}`,
  };
}
