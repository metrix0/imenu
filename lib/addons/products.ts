export const ADDON_PRODUCTS = {
  qr_code_mesa: { key: "qr_code_mesa", name: "iMenu QR Code Mesa", priceCents: 0, referencePrefix: "qr-table" },
  ia_plus: { key: "ia_plus", name: "iMenu Plus", priceCents: 4999, referencePrefix: "ia-plus" },
} as const;
export type AddonProduct = (typeof ADDON_PRODUCTS)[keyof typeof ADDON_PRODUCTS];
export const IA_PLUS = ADDON_PRODUCTS.ia_plus;
export const IA_PLUS_FEATURE_MESSAGE = "Essa é uma função do plano iMenu Plus";
export const IA_PLUS_BENEFITS = [
  { title: "Automações de Marketing WhatsApp", description: "Recupere carrinhos, reative clientes e incentive novos pedidos com mensagens automáticas pelo WhatsApp." },
  { title: "Assistente IA", description: "Converse com mais capacidade, gere imagens e revise e aplique melhorias no seu cardápio." },
  { title: "Vendas IA", description: "Veja a análise completa, converse sobre oportunidades e revise e aplique as mudanças sugeridas." },
] as const;
export const IA_PLUS_BONUSES = [
  { title: "Atendimento exclusivo", description: "Solicite integrações e novas funcionalidades para serem adicionadas em até 3 dias úteis durante a assinatura." },
  { title: "Upsells automáticos", description: "Ofereça produtos adicionais para aumentar o valor dos pedidos." },
  { title: "Modo vitrine", description: "Compartilhe seu cardápio para consulta, sem receber pedidos por esse link." },
  { title: "Atualizações de pedidos pelo WhatsApp", description: "Avise clientes sobre pedidos prontos ou saindo para entrega, respeitando a interação recente com o WhatsApp e a deduplicação." },
  { title: "Scan de cardápio com IA", description: "Importe fotos, PDFs ou links e revise produtos e categorias; a partir de 2 produtos cadastrados, o scan exige iMenu Plus." },
  { title: "Download Cardápio em PDF", description: "Baixe uma versão do seu cardápio em PDF para compartilhar ou imprimir." },
] as const;
export const IA_PLUS_PRICE_LABEL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(IA_PLUS.priceCents / 100);
