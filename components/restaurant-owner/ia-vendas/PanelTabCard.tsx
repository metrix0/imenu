"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  faArrowTrendUp,
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
  faStore,
  faTruck,
  faUtensils,
  faWandMagicSparkles,
  type IconDefinition,
} from "@fortawesome/free-solid-svg-icons";

import Button from "@/components/ui/Button";
import { PanelIcon } from "@/components/ui/PanelIcon";
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
  "vendas-ia": faArrowTrendUp,
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
  const router = useRouter();
  const item = PANEL_TABS[tab];

  return (
    <Button
      type="button"
      variant="secondary"
      className={
        inline
          ? "!min-h-0 gap-1 !rounded-[6px] !border-brand/20 !bg-brand/5 !px-2 !py-0.5 align-baseline !text-xs !leading-5 !text-brand hover:!bg-brand/10"
          : "mt-3 gap-2"
      }
      aria-label={`Abrir aba ${item.label}`}
      onClick={() => router.push(item.href)}
    >
      <PanelIcon icon={PANEL_TAB_ICONS[tab]} aria-hidden="true" />
      {item.label}
      <ArrowUpRight size={inline ? 12 : 14} aria-hidden="true" />
    </Button>
  );
}
