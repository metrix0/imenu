export const PANEL_TABS = {
  pedidos: { label: "Pedidos", href: "/painel" },
  historico: { label: "Histórico", href: "/painel/historico" },
  cardapio: { label: "Cardápio", href: "/painel/cardapio" },
  "assistente-ia": { label: "Assistente IA", href: "/painel/assistente-ia" },
  mesas: { label: "Mesas", href: "/painel/mesas" },
  repasses: { label: "Repasses", href: "/painel/repasses" },
  analytics: { label: "Analytics", href: "/painel/analytics" },
  loja: { label: "Loja", href: "/painel/loja" },
  "vendas-ia": { label: "Vendas IA", href: "/painel/vendas-ia" },
  promocoes: { label: "Promoções", href: "/painel/promocoes" },
  horarios: { label: "Horários", href: "/painel/disponibilidade" },
  "taxa-e-tempo": { label: "Taxa e Tempo", href: "/painel/tempo-e-taxa" },
  fidelidade: { label: "Fidelidade", href: "/painel/fidelidade" },
  aplicativo: { label: "Aplicativo", href: "/painel/aplicativo" },
  "robo-whatsapp": { label: "Robô WhatsApp", href: "/painel/robo-whatsapp" },
  impressora: { label: "Impressora", href: "/painel/impressora" },
  integracoes: { label: "Integrações", href: "/painel/integracoes" },
  configuracoes: { label: "Configurações", href: "/painel/configuracoes" },
} as const;

export type PanelTabKey = keyof typeof PANEL_TABS;

export const PANEL_TAB_KEYS = Object.keys(PANEL_TABS) as PanelTabKey[];

export function isPanelTabKey(value: unknown): value is PanelTabKey {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(PANEL_TABS, value)
  );
}
