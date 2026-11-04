"use client";
import LoadingBar from "@/components/ui/LoadingBar";
import Tooltip from "@/components/ui/Tooltip";
import Button from "@/components/ui/Button";
import { Info } from "lucide-react";
import type { aiAccess } from "@/lib/ia-vendas/access";
import { formatAiResetAt } from "@/lib/ia-vendas/usageReset";

type Access = Awaited<ReturnType<typeof aiAccess>>;
type UsageRow = { label: string; short: string; percent: number; values: string[]; resetAt: string | null };

export default function AiUsage({ access, compact = false, onBuyTokens }: {
  access?: Access | null;
  compact?: boolean;
  onBuyTokens?: () => void;
}) {
  if (!access) return null;
  const format = (n: number) => n.toLocaleString("pt-BR");
  let rows: UsageRow[];
  if (access.plus) {
    if (!access.usage) return null;
    const usage = access.usage;
    rows = [
      { label: "Limite", short: "L", percent: usage.tokens.percent, resetAt: access.tokens_reset_at,
        values: [
          `Entrada: ${format(usage.tokens.input)} / ${format(usage.tokens.input_limit)}`,
          `Saída: ${format(usage.tokens.output)} / ${format(usage.tokens.output_limit)}`,
        ] },
      { label: "Imagens", short: "I", percent: usage.images.percent, resetAt: access.images_reset_at,
        values: [`${format(usage.images.used)} / ${format(usage.images.limit)} imagens`] },
    ];
  } else {
    if (!access.free_tokens_limit || !access.free_images_limit) return null;
    const tokensUsed = Math.max(0, access.free_tokens_limit - Number(access.tokens_remaining ?? access.free_tokens_limit));
    const imagesUsed = Math.max(0, access.free_images_limit - Number(access.images_remaining ?? access.free_images_limit));
    rows = [
      { label: "Limite", short: "L", percent: tokensUsed / access.free_tokens_limit * 100, resetAt: access.tokens_reset_at,
        values: [`${format(tokensUsed)} / ${format(access.free_tokens_limit)} tokens em 7 dias`] },
      { label: "Imagens", short: "I", percent: imagesUsed / access.free_images_limit * 100, resetAt: access.images_reset_at,
        values: [`${format(imagesUsed)} / ${format(access.free_images_limit)} imagens em 7 dias`] },
    ];
  }
  if (Math.max(...rows.map((row) => row.percent)) < 70) return null;
  const reached = rows.some((row) => row.percent >= 100);
  const resetDates = rows
    .filter((row) => row.percent >= 100 && row.resetAt && formatAiResetAt(row.resetAt))
    .map((row) => new Date(row.resetAt!).getTime());
  const reset = resetDates.length ? formatAiResetAt(new Date(Math.max(...resetDates)).toISOString()) : null;
  return <div aria-label={access.plus ? "Uso mensal de IA" : "Uso gratuito de IA"} className={`space-y-3 ${compact ? "px-2 py-3" : "px-1 pb-2 pt-2"}`}>
    {reset && <p className="text-[11px] leading-4 text-gray-600">Limites serão reiniciados em {reset}.</p>}
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
    {reached && onBuyTokens && <Button variant="secondary" className="w-full !min-h-9 !px-2 !py-1.5" onClick={onBuyTokens}>Comprar mais tokens</Button>}
  </div>;
}
