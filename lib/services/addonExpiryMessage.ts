import { IA_PLUS, getIMenuPlusExpiryFeatures } from "@/lib/addons/products";

export type ReminderProducts = { pix: string[]; card: string[] };

export function buildExpiryMessage(products: ReminderProducts): string {
    const pix = products.pix.includes(IA_PLUS.key);
    const card = products.card.includes(IA_PLUS.key);
    if (!pix && !card) return "";

    const { benefits, bonuses } = getIMenuPlusExpiryFeatures();
    const paymentNotice = pix && card
        ? "A renovação via Pix ou cartão cancelado não será automática."
        : pix
            ? "A renovação via Pix não é automática."
            : "Sua assinatura no cartão foi cancelada e não será renovada automaticamente.";

    return [
        "Olá! 👋",
        "",
        `Seu *${IA_PLUS.name}* vence amanhã.`,
        paymentNotice,
        "",
        "Se não renovar, você perderá estes benefícios do Plus:",
        "",
        "*Recursos principais:*",
        ...benefits.map(({ title }) => `• ${title}`),
        "",
        "*Bônus:*",
        ...bonuses.map(({ title }) => `• ${title}`),
        "",
        "Renove na aba Configurações do iMenu para continuar usando esses recursos:",
        "imenuapp.com.br/painel/configuracoes",
        "",
        "Fico à disposição caso precise de ajuda!",
    ].join("\n");
}
