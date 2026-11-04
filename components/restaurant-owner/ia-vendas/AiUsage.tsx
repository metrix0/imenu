"use client";
import LoadingBar from "@/components/ui/LoadingBar";
import type { aiAccess } from "@/lib/ia-vendas/access";

type Access = Awaited<ReturnType<typeof aiAccess>>;
export default function AiUsage({ access, compact = false }: { access?: Access | null; compact?: boolean }) {
  const usage = access?.usage;
  if (!access?.plus || !usage || Math.max(usage.tokens.percent, usage.images.percent) < 70) return null;
  const format = (n: number) => n.toLocaleString("pt-BR");
  const rows = [
    { label: "Tokens", short: "T", percent: usage.tokens.percent,
      detail: `Entrada: ${format(usage.tokens.input)} / ${format(usage.tokens.input_limit)}. Saída: ${format(usage.tokens.output)} / ${format(usage.tokens.output_limit)}. Inclui reservas em andamento.` },
    { label: "Imagens", short: "I", percent: usage.images.percent,
      detail: `${format(usage.images.used)} / ${format(usage.images.limit)} imagens` },
  ];
  return <div aria-label="Uso mensal de IA" className={`space-y-2 ${compact ? "px-2 py-3" : "px-4 pb-3 pt-2"}`}>
    {rows.map(row => <div key={row.label} title={row.detail}>
      <div className={`mb-1 flex items-center justify-between gap-1 text-gray-600 ${compact ? "text-[10px]" : "text-xs"}`}>
        <span aria-label={row.label}>{compact ? row.short : row.label}</span>
        <span>{Math.floor(Math.min(100, row.percent))}%</span>
      </div>
      <LoadingBar progress={row.percent} size="sm" label={`${row.label}: ${row.detail}`} colorClass={row.percent >= 100 ? "bg-red-500" : "bg-brand"} />
    </div>)}
  </div>;
}
