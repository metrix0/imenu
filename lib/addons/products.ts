export const ADDON_PRODUCTS = {
  qr_code_mesa: { key: "qr_code_mesa", name: "iMenu QR Code Mesa", priceCents: 500, referencePrefix: "qr-table" },
  ia_plus: { key: "ia_plus", name: "iMenu Plus", priceCents: 4999, referencePrefix: "ia-plus" },
} as const;
export type AddonProduct = (typeof ADDON_PRODUCTS)[keyof typeof ADDON_PRODUCTS];
export const IA_PLUS = ADDON_PRODUCTS.ia_plus;
export const IA_PLUS_FEATURE_MESSAGE = "Essa é uma função do plano iMenu Plus";
export const IA_PLUS_BENEFITS = [
  { title: "Automações de Marketing WhatsApp", description: "Recupere carrinhos, reative clientes e incentive novos pedidos com mensagens automáticas pelo WhatsApp." },
  { title: "Assistente IA", description: "Converse com mais capacidade, gere imagens e revise e aplique melhorias no seu cardápio." },
  { title: "Vendas IA", description: "Veja a análise completa, converse sobre oportunidades e revise e aplique as mudanças sugeridas." },
  { title: "iMenu QR Code (Incluso)", description: "Receba pedidos pelas mesas com QR Codes individuais ou um QR Code universal, sem contratar outro plano." },
] as const;
export const IA_PLUS_BONUSES = [
  { title: "Atendimento exclusivo", description: "Solicite integrações e novas funcionalidades para serem adicionadas em até 3 dias úteis durante a assinatura." },
  { title: "Upsells automáticos", description: "Ofereça produtos adicionais para aumentar o valor dos pedidos." },
  { title: "Modo vitrine", description: "Compartilhe seu cardápio para consulta, sem receber pedidos por esse link." },
  { title: "Painel Garçom", description: "Organize o atendimento e os pedidos das mesas pelo painel do garçom." },
  { title: "Download Cardápio em PDF", description: "Baixe uma versão do seu cardápio em PDF para compartilhar ou imprimir." },
] as const;
export const IA_PLUS_PRICE_LABEL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(IA_PLUS.priceCents / 100);
