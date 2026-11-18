"use client";

import type { ReactNode } from "react";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { Coins } from "lucide-react";
import LoadingBar from "@/components/ui/LoadingBar";
import type { aiAccess } from "@/lib/ia-vendas/access";
import { SupportWhatsappBadge } from "@/components/common/SupportButton";

const IA_CAPACITY_SUPPORT_SUFFIX =
  "Caso precise de mais limite ou ajuda, entre em contato com o suporte.";

type AssistantAccess = Awaited<ReturnType<typeof aiAccess>>;
const formatCount = (value: number) => value.toLocaleString("pt-BR");

function AssistantNotice({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section aria-label={title} className="max-w-lg rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--panel-text,#1d1d1d)]">{title}</p>
      {children}
    </section>
  );
}

export function AssistantConversationLimitReply({ message, onNewConversation }: {
  message: string;
  onNewConversation: () => void;
}) {
  return (
    <AssistantNotice title="Limite da conversa atingido">
      <p className="mt-1 text-sm leading-5 text-[var(--panel-muted,#626973)]">{message}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onNewConversation} className="!min-h-9 !px-3 !py-1.5">Criar novo chat</Button>
      </div>
    </AssistantNotice>
  );
}

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
  const monthlyUsage = monthly && access?.plus ? access.credit_usage ?? access.usage : null;
  const inputLimitReached = monthlyUsage !== null &&
    monthlyUsage.tokens.input >= monthlyUsage.tokens.input_limit &&
    (access?.purchased_credits.input ?? 0) <= 0;
  const imageLimitReached = (access?.images_remaining ?? 0) <= 0;
  return (
    <AssistantNotice title={title}>
      {detail && <p className="mt-1 text-sm leading-5 text-[var(--panel-muted,#626973)]">{detail}</p>}
      {monthlyUsage && monthlyUsage.tokens.percent < 100 && (
        <p className="mt-1 text-sm text-[var(--panel-muted,#626973)]">O saldo restante não é suficiente para iniciar outra mensagem.</p>
      )}
      {monthlyUsage && (
        <div className="mt-3 text-sm text-[var(--panel-muted,#626973)]">
          <p>{access?.credit_usage ? "Uso atual e limites após a recarga" : "Seu plano inclui estes limites mensais. Uso atual:"}</p>
          <dl className="mt-2 space-y-2.5">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <dt>Tokens de entrada</dt>
                <dd className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1 tabular-nums text-[var(--panel-text,#1d1d1d)]">
                  <Badge mode="pill" variant={inputLimitReached ? "danger" : "success"} uppercase={false} className="whitespace-nowrap">
                    {inputLimitReached ? "Limite atingido" : "Saldo disponível"}
                  </Badge>
                  <span className="whitespace-nowrap">{formatCount(monthlyUsage.tokens.input)} / {formatCount(monthlyUsage.tokens.input_limit)}</span>
                </dd>
              </div>
              <LoadingBar
                progress={monthlyUsage.tokens.input_limit > 0 ? monthlyUsage.tokens.input / monthlyUsage.tokens.input_limit * 100 : 100}
                size="sm"
                className="mt-1.5"
                label="Uso de tokens de entrada"
                colorClass={monthlyUsage.tokens.input >= monthlyUsage.tokens.input_limit ? "bg-red-500" : "bg-brand"}
              />
            </div>
            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1">
                <dt>Imagens</dt>
                <dd className="ml-auto flex flex-wrap items-center justify-end gap-x-2 gap-y-1 tabular-nums text-[var(--panel-text,#1d1d1d)]">
                  <Badge mode="pill" variant={imageLimitReached ? "danger" : "success"} uppercase={false} className="whitespace-nowrap">
                    {imageLimitReached ? "Limite atingido" : "Saldo disponível"}
                  </Badge>
                  <span className="whitespace-nowrap">{formatCount(monthlyUsage.images.used)} / {formatCount(monthlyUsage.images.limit)}</span>
                </dd>
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
        {access?.plus !== false && <Button type="button" onClick={onBuyCredits} leftIcon={<Coins size={16} aria-hidden="true" />} className="!min-h-9 !px-3 !py-1.5">Recarregar créditos</Button>}
        {onSubscribe && <Button type="button" variant="secondary" onClick={onSubscribe} className="!min-h-9 !px-3 !py-1.5">Assinar iMenu Plus</Button>}
        <SupportWhatsappBadge compact />
      </div>
    </AssistantNotice>
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
