"use client";

import Button from "@/components/ui/Button";
import { SupportWhatsappBadge } from "@/components/common/SupportButton";

const IA_CAPACITY_SUPPORT_SUFFIX =
  "Caso precise de mais limite ou ajuda, entre em contato com o suporte.";

export function AssistantQuotaReply({ message, onBuyCredits, onSubscribe }: {
  message: string;
  onBuyCredits: () => void;
  onSubscribe?: () => void;
}) {
  const monthly = message.startsWith("Limite mensal de IA atingido.");
  const title = monthly ? "Limite mensal atingido" : "Limite gratuito atingido";
  const detail = message.replace(
    monthly ? /^Limite mensal de IA atingido\.\s*/ : /^Seu limite gratuito foi atingido\.\s*/,
    "",
  );
  return (
    <section aria-label={title} className="max-w-lg rounded-[10px] border border-[var(--panel-border)] bg-[var(--panel-surface)] p-4">
      <p className="text-sm font-semibold text-[var(--panel-text,#1d1d1d)]">{title}</p>
      {detail && <p className="mt-1 text-sm leading-5 text-[var(--panel-muted,#626973)]">{detail}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button type="button" onClick={onBuyCredits} className="!min-h-9 !px-3 !py-1.5">Comprar mais créditos</Button>
        {onSubscribe && <Button type="button" variant="secondary" onClick={onSubscribe} className="!min-h-9 !px-3 !py-1.5">Assinar iMenu Plus</Button>}
        <SupportWhatsappBadge compact />
      </div>
    </section>
  );
}

export default function ErrorNoticeContent({ message, onBuyCredits }: {
  message: string;
  onBuyCredits: () => void;
}) {
  if (message.startsWith("Limite mensal de IA atingido.")) {
    return <AssistantQuotaReply message={message} onBuyCredits={onBuyCredits} />;
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
