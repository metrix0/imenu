"use client";

import Button from "@/components/ui/Button";
import { SupportWhatsappBadge } from "@/components/common/SupportButton";

const IA_CAPACITY_SUPPORT_SUFFIX =
  "Caso precise de mais limite ou ajuda, entre em contato com o suporte.";

export default function ErrorNoticeContent({ message, onBuyCredits }: {
  message: string;
  onBuyCredits: () => void;
}) {
  if (message.startsWith("Limite mensal de IA atingido.")) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p>{message}</p>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="secondary" onClick={onBuyCredits}>Comprar mais créditos</Button>
          <SupportWhatsappBadge />
        </div>
      </div>
    );
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
