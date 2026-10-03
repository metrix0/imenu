export const ADDON_PRODUCTS = {
  qr_code_mesa: { key: "qr_code_mesa", name: "iMenu QR Code Mesa", priceCents: 500, referencePrefix: "qr-table" },
  ia_plus: { key: "ia_plus", name: "iMenu IA Plus", priceCents: 4999, referencePrefix: "ia-plus" },
} as const;
export type AddonProduct = (typeof ADDON_PRODUCTS)[keyof typeof ADDON_PRODUCTS];
export const IA_PLUS = ADDON_PRODUCTS.ia_plus;
export const IA_PLUS_FEATURE_MESSAGE = "Essa é uma função do plano iMenu IA Plus";
export const IA_PLUS_BENEFITS = [
  { title: "Mais ajuda do Assistente IA", description: "Converse com a IA para melhorar seu cardápio, descrições, preços e configurações, com uma capacidade maior de uso." },
  { title: "Imagens para seus produtos", description: "Gere e revise novas imagens de produtos, logo e banner antes de publicar." },
  { title: "Coloque sua análise em prática", description: "Veja a análise completa, converse sobre as oportunidades e revise e aplique as mudanças sugeridas." },
] as const;
export const IA_PLUS_PRICE_LABEL = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(IA_PLUS.priceCents / 100);
