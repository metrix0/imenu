"use client";

import {
  faBox,
  faChair,
  faChartLine,
  faClock,
  faGear,
  faGift,
  faHome,
  faMoneyBillWave,
  faMobileScreenButton,
  faPercent,
  faPrint,
  faPuzzlePiece,
  faRobot,
  faRocket,
  faStore,
  faTruck,
  faUtensils,
  faWandMagicSparkles,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

import PageBadge from "@/components/ui/PageBadge";
import { PANEL_TABS, type PanelTabKey } from "@/lib/ia-vendas/panelTabs";

const PANEL_TAB_ICONS: Record<PanelTabKey, IconDefinition> = {
  pedidos: faHome,
  historico: faBox,
  cardapio: faUtensils,
  "assistente-ia": faWandMagicSparkles,
  mesas: faChair,
  repasses: faMoneyBillWave,
  analytics: faChartLine,
  loja: faStore,
  "vendas-ia": faRocket,
  promocoes: faPercent,
  horarios: faClock,
  "taxa-e-tempo": faTruck,
  fidelidade: faGift,
  aplicativo: faMobileScreenButton,
  "robo-whatsapp": faRobot,
  impressora: faPrint,
  integracoes: faPuzzlePiece,
  configuracoes: faGear,
};

export default function PanelTabCard({
  tab,
  inline = false,
}: {
  tab: PanelTabKey;
  inline?: boolean;
}) {
  const item = PANEL_TABS[tab];

  return (
    <PageBadge
      href={item.href}
      icon={PANEL_TAB_ICONS[tab]}
      size={inline ? "inline" : "button"}
      newTab
      aria-label={`Abrir aba ${item.label}`}
    >
      {item.label}
    </PageBadge>
  );
}
