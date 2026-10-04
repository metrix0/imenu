"use client";

import { ArrowUpRight } from "lucide-react";
import { useRouter } from "next/navigation";

import Button from "@/components/ui/Button";
import { PANEL_TABS, type PanelTabKey } from "@/lib/ia-vendas/panelTabs";

export default function PanelTabCard({ tab }: { tab: PanelTabKey }) {
  const router = useRouter();
  const item = PANEL_TABS[tab];

  return (
    <Button
      type="button"
      variant="secondary"
      className="mt-3 gap-2"
      aria-label={`Abrir aba ${item.label}`}
      onClick={() => router.push(item.href)}
    >
      {item.label}
      <ArrowUpRight size={14} aria-hidden="true" />
    </Button>
  );
}
