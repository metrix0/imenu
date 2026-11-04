"use client";
import LoadingBar from "@/components/ui/LoadingBar";
import type { aiAccess } from "@/lib/ia-vendas/access";

type Access = Awaited<ReturnType<typeof aiAccess>>;
export default function AiUsage({ access, compact = false, previewDemo = false }: { access?: Access | null; compact?: boolean; previewDemo?: boolean }) {
  const liveUsage = access?.usage;
  const usage = previewDemo && liveUsage ? {
    tokens: { ...liveUsage.tokens, input: Math.floor(liveUsage.tokens.input_limit * 0.95), output: 0, percent: 95 },
    images: { ...liveUsage.images, used: Math.floor(liveUsage.images.limit * 0.95), percent: Math.floor(liveUsage.images.limit * 0.95) / liveUsage.images.limit * 100 },
  } : liveUsage;
  if (!access?.plus || !usage || Math.max(usage.tokens.percent, usage.images.percent) < 70) return null;
  const format = (n: number) => n.toLocaleString("pt-BR");
  const rows = [
    { label: "Tokens", short: "T", percent: usage.tokens.percent,
      detail: `Entrada: ${format(usage.tokens.input)} / ${format(usage.tokens.input_limit)}. Saída: ${format(usage.tokens.output)} / ${format(usage.tokens.output_limit)}. Inclui reservas em andamento.` },
    { label: "Imagens", short: "I", percent: usage.images.percent,
      detail: `${format(usage.images.used)} / ${format(usage.images.limit)} imagens` },
  ];
  return <div aria-label={previewDemo ? "Simulação de uso mensal de IA" : "Uso mensal de IA"} className={`space-y-2 ${compact ? "px-2 py-3" : "px-4 pb-3 pt-2"}`}>
    {previewDemo && !compact && <div className="text-xs text-gray-500">Simulação de uso</div>}
    {rows.map(row => <div key={row.label} title={`${previewDemo ? "Simulação: " : ""}${row.detail}`}>
      <div className={`mb-1 flex items-center justify-between gap-1 text-gray-600 ${compact ? "text-[10px]" : "text-xs"}`}>
        <span aria-label={row.label}>{compact ? row.short : row.label}</span>
        <span>{Math.floor(Math.min(100, row.percent))}%</span>
      </div>
      <LoadingBar progress={row.percent} size="sm" label={`${row.label}: ${row.detail}`} colorClass={row.percent >= 100 ? "bg-red-500" : "bg-brand"} />
    </div>)}
  </div>;
}
