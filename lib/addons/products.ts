export const ADDON_PRODUCTS = {
  qr_code_mesa: { key: "qr_code_mesa", name: "iMenu QR Code Mesa", priceCents: 0, referencePrefix: "qr-table" },
  ia_plus: { key: "ia_plus", name: "iMenu Plus", priceCents: 4999, referencePrefix: "ia-plus" },
} as const;
export type AddonProduct = (typeof ADDON_PRODUCTS)[keyof typeof ADDON_PRODUCTS];
export const IA_PLUS = ADDON_PRODUCTS.ia_plus;
export const IA_PLUS_FEATURE_MESSAGE = "Essa é uma função do plano iMenu Plus";
export const IA_PLUS_BENEFITS = [
  { title: "Automações de Marketing WhatsApp", description: "Recupere carrinhos, reative clientes e incentive novos pedidos com mensagens automáticas no WhatsApp." },
  { title: "Assistente IA", description: "Converse com a IA, gere imagens e melhore seu cardápio com sugestões que você revisa antes de aplicar." },
  { title: "Vendas IA", description: "Analise suas vendas, descubra oportunidades e aplique melhorias depois de revisar cada sugestão." },
] as const;
export const IA_PLUS_BONUSES = [
  { title: "Robô WhatsApp com IA", description: "Seu robô do WhatsApp mais inteligente, respondendo qualquer tipo de pergunta!" },
  { title: "Atendimento exclusivo", description: "Solicite integrações e novas funcionalidades com atendimento exclusivo e entrega em até 3 dias úteis." },
  { title: "Upsells automáticos", description: "Sugira automaticamente produtos que combinam com o pedido para aumentar o ticket médio." },
  { title: "Atualizações de pedidos pelo WhatsApp", description: "Notifique clientes pelo WhatsApp quando o pedido estiver pronto ou sair para entrega." },
  { title: "Download Cardápio em PDF", description: "Baixe seu cardápio em PDF para imprimir ou compartilhar." },
] as const;
export const IA_PLUS_PRICE_LABEL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(IA_PLUS.priceCents / 100);
