"use client";

import { Sparkles } from "lucide-react";

import PanelTabCard from "@/components/restaurant-owner/ia-vendas/PanelTabCard";

export default function SalesAnalysisSuggestionCard() {
  return (
    <aside
      aria-label="Análise completa do cardápio"
      className="mt-4 max-w-xl rounded-xl border border-brand/20 bg-brand/5 p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white text-brand shadow-sm">
          <Sparkles size={17} aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-gray-900">
            Análise completa do seu cardápio
          </h3>
          <p className="mt-1 text-sm leading-6 text-gray-600">
            O Vendas IA cruza seu cardápio com pedidos e procura oportunidades em preços, imagens, combos, produtos e muito mais.
          </p>
        </div>
      </div>
      <PanelTabCard tab="vendas-ia" />
    </aside>
  );
}
