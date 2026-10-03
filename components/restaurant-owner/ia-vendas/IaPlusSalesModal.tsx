"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { Check, Sparkles } from "lucide-react";
import Modal from "@/components/ui/Modal";
import ModalFlowStep from "@/components/ui/ModalFlowStep";
import Button from "@/components/ui/Button";
import QrCodeMesaCheckoutModal from "@/components/restaurant-owner/mesas/QrCodeMesaCheckoutModal";
import { IA_PLUS_BENEFITS, IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";

export function IaPlusDetails() {
  return <>
    <h2 className="text-xl font-bold text-gray-900">iMenu IA Plus</h2>
    <p className="mt-2 text-sm text-gray-600">Transforme as oportunidades da IA em melhorias no seu restaurante.</p>
    <ul className="mt-5 space-y-4">{IA_PLUS_BENEFITS.map(benefit => <li key={benefit.title} className="flex gap-3">
      <Check size={18} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
      <div><h3 className="text-sm font-semibold text-gray-900">{benefit.title}</h3><p className="mt-1 text-sm leading-6 text-gray-600">{benefit.description}</p></div>
    </li>)}</ul>
    <p className="mt-5 text-sm text-gray-600"><strong className="text-2xl text-gray-900">{IA_PLUS_PRICE_LABEL}</strong> /mês · Cartão ou Pix</p>
    <p className="mt-2 text-xs text-gray-500">Cartão com renovação mensal; Pix libera um mês de acesso. Cancele quando quiser. Você revisa cada mudança antes de aplicar.</p>
  </>;
}
export function IaPlusLimitMessage({ onCheckout }: { onCheckout: () => void }) {
  return <article aria-label="Limite gratuito do Assistente IA" className="mx-auto my-5 max-w-2xl rounded-xl border border-brand/20 bg-white p-5">
    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-brand"><Sparkles size={18} />Seu limite gratuito foi atingido</div>
    <IaPlusDetails />
    <Button className="mt-5" onClick={onCheckout}>Assinar iMenu IA Plus</Button>
  </article>;
}
export default function IaPlusSalesModal({ open, onClose, restaurantId, checkout = false, active = false, onPaid }: {
  open: boolean; onClose: () => void; restaurantId: string; checkout?: boolean; active?: boolean; onPaid?: () => void | Promise<void>;
}) {
  const [step, setStep] = useState(checkout);
  const [navigated, setNavigated] = useState(false);
  useEffect(() => { if (open) { setStep(checkout); setNavigated(false); } }, [open, checkout]);
  return <Modal open={open} onClose={onClose} fixedHeight height={step ? 760 : 650} className="max-w-3xl" bodyClassName="flex flex-1 flex-col !overflow-hidden" showCloseButton>
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {step ? <ModalFlowStep key="checkout" animate>
        <QrCodeMesaCheckoutModal open embedded restaurantId={restaurantId} source="settings" productKey="ia_plus" onClose={onClose} onBack={() => setStep(false)} onPaid={onPaid} />
      </ModalFlowStep> : <ModalFlowStep key="sales" reverse animate={navigated}>
        <div className="min-h-0 flex-1 overflow-y-auto p-6 sm:p-8">
          <div className="relative mb-7 h-12 w-56"><Image src="/logos/IAPlusCombinationMarkLogo_Brand.png" alt="iMenu IA Plus" fill sizes="224px" className="object-contain object-left" /></div>
          <IaPlusDetails />
        </div>
        <div className="shrink-0 border-t border-gray-100 p-5"><Button className="w-full" disabled={active} onClick={() => { setNavigated(true); setStep(true); }}>{active ? "Seu iMenu IA Plus está ativo" : "Assinar iMenu IA Plus"}</Button></div>
      </ModalFlowStep>}
    </div>
  </Modal>;
}
