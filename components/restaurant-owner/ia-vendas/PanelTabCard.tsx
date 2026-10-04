"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/Button";
import { PANEL_TABS, type PanelTabKey } from "@/lib/ia-vendas/panelTabs";

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
      {item.label}
      <ArrowUpRight size={inline ? 12 : 14} aria-hidden="true" />
    </Button>
  );
}
