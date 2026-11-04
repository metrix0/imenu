"use client";
import LoadingBar from "@/components/ui/LoadingBar";
import Tooltip from "@/components/ui/Tooltip";
import { Info } from "lucide-react";
import type { aiAccess } from "@/lib/ia-vendas/access";

type Access = Awaited<ReturnType<typeof aiAccess>>;
export default function AiUsage({ access, compact = false }: { access?: Access | null; compact?: boolean }) {
  const usage = access?.usage;
  if (!access?.plus || !usage || Math.max(usage.tokens.percent, usage.images.percent) < 70) return null;
  const format = (n: number) => n.toLocaleString("pt-BR");
  const rows = [
    { label: "Tokens", short: "T", percent: usage.tokens.percent,
      values: [
        `Entrada: ${format(usage.tokens.input)} / ${format(usage.tokens.input_limit)}`,
        `Saída: ${format(usage.tokens.output)} / ${format(usage.tokens.output_limit)}`,
      ] },
    { label: "Imagens", short: "I", percent: usage.images.percent,
      values: [`${format(usage.images.used)} / ${format(usage.images.limit)} imagens`] },
  ];
  return <div aria-label="Uso mensal de IA" className={`space-y-3 ${compact ? "px-2 py-3" : "px-1 pb-2 pt-2"}`}>
    {rows.map(row => <div key={row.label}>
      <div className={`mb-1 flex items-center gap-1 text-gray-600 ${compact ? "text-[10px]" : "text-xs"}`}>
        <span aria-label={row.label}>{compact ? row.short : row.label}</span>
        <span className="ml-auto">{Math.floor(Math.min(100, row.percent))}%</span>
        <Tooltip text={row.values.join(" · ")} showOnClick position="top" tooltipClassName="!w-max !max-w-[min(14rem,calc(100vw-1rem))]">
          <button type="button" aria-label={`Informações de uso de ${row.label}`} className="flex size-5 cursor-help items-center justify-center rounded text-gray-500 hover:text-gray-800">
            <Info size={13} />
          </button>
        </Tooltip>
      </div>
      <LoadingBar progress={row.percent} size="sm" label={`${row.label}: ${row.values.join(". ")}`} colorClass={row.percent >= 100 ? "bg-red-500" : "bg-brand"} />
    </div>)}
  </div>;
}
