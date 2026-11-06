"use client";

import Button from "@/components/ui/Button";
import { Coins } from "lucide-react";
import LoadingBar from "@/components/ui/LoadingBar";
import type { aiAccess } from "@/lib/ia-vendas/access";
import { SupportWhatsappBadge } from "@/components/common/SupportButton";

const IA_CAPACITY_SUPPORT_SUFFIX =
  "Caso precise de mais limite ou ajuda, entre em contato com o suporte.";

type AssistantAccess = Awaited<ReturnType<typeof aiAccess>>;
const formatCount = (value: number) => value.toLocaleString("pt-BR");

export function AssistantQuotaReply({ message, onBuyCredits, onSubscribe, access }: {
  message: string;
  onBuyCredits: () => void;
  onSubscribe?: () => void;
  access?: AssistantAccess | null;
}) {
  const monthly = message.startsWith("Limite mensal de IA atingido.");
  const title = monthly ? "Limite mensal atingido" : "Limite gratuito atingido";
  const detail = message.replace(
    monthly ? /^Limite mensal de IA atingido\.\s*/ : /^Seu limite gratuito foi atingido\.\s*/,
    "",
  );
  const monthlyUsage = monthly && access?.plus ? access.usage : null;
  return (
    <section aria-label={title} className="max-w-lg rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--panel-text,#1d1d1d)]">{title}</p>
      {detail && <p className="mt-1 text-sm leading-5 text-[var(--panel-muted,#626973)]">{detail}</p>}
      {monthlyUsage && monthlyUsage.tokens.percent < 100 && (
        <p className="mt-1 text-sm text-[var(--panel-muted,#626973)]">O saldo restante não é suficiente para iniciar outra mensagem.</p>
      )}
      {monthlyUsage && (
        <div className="mt-3 text-sm text-[var(--panel-muted,#626973)]">
          <p>Seu plano inclui estes limites mensais. Uso atual:</p>
          <dl className="mt-2 space-y-2.5">
            <div>
              <div className="flex justify-between gap-3">
                <dt>Tokens de entrada</dt>
                <dd className="tabular-nums text-[var(--panel-text,#1d1d1d)]">{formatCount(monthlyUsage.tokens.input)} / {formatCount(monthlyUsage.tokens.input_limit)}</dd>
              </div>
              <LoadingBar
                progress={monthlyUsage.tokens.input / monthlyUsage.tokens.input_limit * 100}
                size="sm"
                className="mt-1.5"
                label="Uso de tokens de entrada"
                colorClass={monthlyUsage.tokens.input >= monthlyUsage.tokens.input_limit ? "bg-red-500" : "bg-brand"}
              />
            </div>
            <div>
              <div className="flex justify-between gap-3">
                <dt>Imagens</dt>
                <dd className="tabular-nums text-[var(--panel-text,#1d1d1d)]">{formatCount(monthlyUsage.images.used)} / {formatCount(monthlyUsage.images.limit)}</dd>
              </div>
              <LoadingBar
                progress={monthlyUsage.images.percent}
                size="sm"
                className="mt-1.5"
                label="Uso de imagens"
                colorClass={monthlyUsage.images.percent >= 100 ? "bg-red-500" : "bg-brand"}
              />
            </div>
          </dl>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onBuyCredits} leftIcon={<Coins size={16} aria-hidden="true" />} className="!min-h-9 !px-3 !py-1.5">Recarregar créditos</Button>
        {onSubscribe && <Button type="button" variant="secondary" onClick={onSubscribe} className="!min-h-9 !px-3 !py-1.5">Assinar iMenu Plus</Button>}
        <SupportWhatsappBadge compact />
      </div>
    </section>
  );
}

export default function ErrorNoticeContent({ message, onBuyCredits, access }: {
  message: string;
  onBuyCredits: () => void;
  access?: AssistantAccess | null;
}) {
  if (message.startsWith("Limite mensal de IA atingido.")) {
    return <AssistantQuotaReply message={message} onBuyCredits={onBuyCredits} access={access} />;
  }
  if (!message.endsWith(IA_CAPACITY_SUPPORT_SUFFIX)) return <>{message}</>;
  const main = message.slice(0, -IA_CAPACITY_SUPPORT_SUFFIX.length).trim();
  return (
    <div className="flex flex-col items-start gap-2">
      <span>{main} {IA_CAPACITY_SUPPORT_SUFFIX}</span>
      <SupportWhatsappBadge />
    </div>
  );
}
