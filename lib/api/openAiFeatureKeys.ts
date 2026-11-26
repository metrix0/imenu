// Server-side feature routing. Keep the shared key as a migration fallback.
export const OPENAI_FEATURES = {
    assistant: { env: "OPENAI_ASSISTANT_API_KEY", name: "imenu-assistant", label: "Assistente IA — Chat" },
    salesChat: { env: "OPENAI_SALES_CHAT_API_KEY", name: "imenu-sales-chat", label: "Vendas IA — Chat da análise" },
    images: { env: "OPENAI_IMAGES_API_KEY", name: "imenu-images", label: "Assistente IA — Gerar imagens" },
    menuScan: { env: "OPENAI_MENU_SCAN_API_KEY", name: "imenu-menu-scan", label: "Importação de Cardápio — Leitura IA" },
    support: { env: "OPENAI_SUPPORT_API_KEY", name: "imenu-support", label: "Suporte Chatbot IA — Chat e visão de imagens" },
    supportFollowup: { env: "OPENAI_SUPPORT_FOLLOWUP_API_KEY", name: "imenu-support-followup", label: "Suporte Chatbot IA — Acompanhamento" },
    supportAudio: { env: "OPENAI_SUPPORT_AUDIO_API_KEY", name: "imenu-support-audio", label: "Suporte Chatbot IA — Transcrever áudios" },
    whatsapp: { env: "OPENAI_WHATSAPP_API_KEY", name: "imenu-whatsapp", label: "Robô WhatsApp IA — Chat" },
} as const;

export type OpenAIFeature = keyof typeof OPENAI_FEATURES;

export function openAiFeatureKey(feature: OpenAIFeature): string | undefined {
    return process.env[OPENAI_FEATURES[feature].env]?.trim() || process.env.OPENAI_API_KEY?.trim() || undefined;
}
