"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import {
  ArrowRight,
  Sparkles,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import ModalFlowStep from "@/components/ui/ModalFlowStep";
import Button from "@/components/ui/Button";
import QrCodeMesaCheckoutModal from "@/components/restaurant-owner/mesas/QrCodeMesaCheckoutModal";
import { IA_PLUS_BENEFITS, IA_PLUS_BONUSES, IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";
import { PROMO_QR_CODE, PROMO_QR_PRICE_LABEL } from "@/lib/addons/promoQr";
import { PLUS_BONUS_ICONS, PLUS_FEATURE_ICONS } from "@/components/restaurant-owner/mesas/MenuProductCard";

const SUPPORT_URL =
  "https://wa.me/5519997235394?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20iMenu%20Plus.";

export function IaPlusDetails() {
  return <>
    <h2 className="text-xl font-bold text-gray-900">iMenu Plus</h2>
    <p className="mt-2 text-sm text-gray-600">Marketing, inteligência artificial e atendimento nas mesas em um só plano.</p>
    <ul className="mt-5 space-y-4">{IA_PLUS_BENEFITS.map(benefit => {
      const Icon = PLUS_FEATURE_ICONS[benefit.title] ?? Sparkles;
      return <li key={benefit.title} className="flex gap-3">
        <Icon size={20} strokeWidth={1.9} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
        <div><h3 className="text-sm font-semibold text-gray-900">{benefit.title}</h3><p className="mt-1 text-sm leading-6 text-gray-600">{benefit.description}</p></div>
      </li>;
    })}</ul>
    <h3 className="mt-5 text-sm font-semibold text-gray-900">Bônus</h3>
    <ul className="mt-3 space-y-3 text-sm text-gray-600">{IA_PLUS_BONUSES.map(bonus => {
      const Icon = PLUS_BONUS_ICONS[bonus.title] ?? Sparkles;
      return <li key={bonus.title} className="flex items-center gap-2">
        <Icon size={18} strokeWidth={1.85} className="shrink-0 text-brand" aria-hidden="true" />
        {bonus.title}
      </li>;
    })}</ul>
    <p className="mt-5 text-sm text-gray-600"><strong className="text-2xl text-gray-900">{IA_PLUS_PRICE_LABEL}</strong> /mês · Cartão ou Pix</p>
    <p className="mt-2 text-xs text-gray-500">Cartão com renovação mensal; Pix libera um mês de acesso. Cancele quando quiser. Você revisa cada mudança antes de aplicar.</p>
  </>;
}
export function IaPlusLimitMessage({ onCheckout }: { onCheckout: () => void }) {
  return <article aria-label="Limite gratuito do Assistente IA" className="mx-auto my-5 max-w-2xl rounded-xl border border-brand/20 bg-white p-5">
    <div className="mb-4 flex items-center gap-2 text-sm font-medium text-brand"><Sparkles size={18} />Seu limite gratuito foi atingido. Seus limites são reiniciados em 7 dias.</div>
    <IaPlusDetails />
    <Button className="mt-5" onClick={onCheckout}>Assinar iMenu Plus</Button>
  </article>;
}
export default function IaPlusSalesModal({ open, onClose, restaurantId, checkout = false, active = false, onPaid, contextMessage, coupon }: {
  open: boolean; onClose: () => void; restaurantId: string; checkout?: boolean; active?: boolean; onPaid?: () => void | Promise<void>; contextMessage?: string; coupon?: string;
}) {
  const [step, setStep] = useState(checkout);
  const [navigated, setNavigated] = useState(false);

  useEffect(() => {
    if (open) {
      setStep(checkout);
      setNavigated(false);
    }
  }, [open, checkout]);

  return <Modal
    open={open}
    onClose={onClose}
    fixedHeight
    height={step ? 760 : 720}
    className="max-w-4xl !border-0 [&>[data-ui=modal-close]]:!rounded-full"
    bodyClassName="flex flex-1 flex-col !overflow-hidden"
    showCloseButton
  >
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {step ? <ModalFlowStep key="checkout" animate>
        <QrCodeMesaCheckoutModal
          open
          embedded
          restaurantId={restaurantId}
          source="settings"
          productKey="ia_plus"
          coupon={coupon}
          onClose={onClose}
          onBack={() => setStep(false)}
          onPaid={onPaid}
        />
      </ModalFlowStep> : <ModalFlowStep key="sales" reverse animate={navigated}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <header className="bg-gradient-to-br from-white to-orange-50/60 px-5 pb-6 pt-7 sm:px-8 sm:pb-7 sm:pt-8">
            <div className="relative h-10 w-44 max-w-[70%]">
              <Image src="/logos/IAPlusCombinationMarkLogo_Brand.png" alt="iMenu Plus" fill sizes="176px" className="object-contain object-left" />
            </div>
            <div className="mt-6 grid gap-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end sm:gap-8">
              <div className="min-w-0">
                <h2 className="text-2xl font-bold leading-tight tracking-tight text-gray-900 sm:text-3xl">
                  Venda mais com iMenu Plus
                </h2>
                <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600">
                  Marketing, Assistente IA e Vendas IA para o seu restaurante.
                </p>
              </div>
              <div className="shrink-0 pt-4 sm:pl-7 sm:pt-0">
                <div className="flex items-baseline gap-1.5">
                  {coupon === PROMO_QR_CODE && <span className="text-base text-gray-400 line-through">{IA_PLUS_PRICE_LABEL}</span>}
                  <span className="text-3xl font-bold tracking-tight text-gray-900">{coupon === PROMO_QR_CODE ? PROMO_QR_PRICE_LABEL : IA_PLUS_PRICE_LABEL}</span>
                  <span className="text-sm text-gray-500">/mês</span>
                </div>
                <p className="mt-1.5 text-xs text-gray-500">{coupon === PROMO_QR_CODE ? "Primeiro mês via Pix · sem renovação automática" : "Cancele quando quiser"}</p>
              </div>
            </div>
            {contextMessage?.trim() && (
              <div role="note" className="mt-5 flex items-start gap-3">
                <Sparkles size={17} strokeWidth={1.9} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                <p className="text-sm leading-6 text-gray-700">{contextMessage.trim()}</p>
              </div>
            )}
          </header>

          <div className="px-5 py-6 sm:px-8">
            <div className="grid gap-5 sm:grid-cols-3">
              {IA_PLUS_BENEFITS.map(benefit => {
                const Icon = PLUS_FEATURE_ICONS[benefit.title] ?? Sparkles;
                return <section key={benefit.title} className="min-w-0">
                  <div className="flex flex-col items-start gap-3 text-brand">
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-brand/5">
                      <Icon size={21} strokeWidth={1.9} aria-hidden="true" />
                    </span>
                    <h3 className="text-sm font-semibold leading-5 text-gray-900">{benefit.title}</h3>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-gray-600">{benefit.description}</p>
                </section>;
              })}
              <section className="mt-1 pt-5 sm:col-span-3">
                <h3 className="text-sm font-semibold text-gray-900">Também incluído no seu plano</h3>
                <ul className="mt-4 grid gap-x-6 gap-y-4 sm:grid-cols-2">{IA_PLUS_BONUSES.map(bonus => {
                  const Icon = PLUS_BONUS_ICONS[bonus.title] ?? Sparkles;
                  return <li key={bonus.title} className="flex gap-3 text-sm text-gray-600">
                    <Icon size={21} strokeWidth={1.85} className="mt-0.5 shrink-0 text-brand" aria-hidden="true" />
                    <div><h4 className="font-semibold text-gray-900">{bonus.title}</h4><p className="mt-1 text-xs leading-5 text-gray-500">{bonus.description}</p></div>
                  </li>;
                })}</ul>
              </section>
            </div>

            {!active && (
              <p className="mt-5 pt-4 text-xs leading-5 text-gray-500">
                Ao continuar, você concorda com os{" "}
                <Link
                  href="/restaurante/dados/termos/ia-plus"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-2"
                >
                  Termos do iMenu Plus
                </Link>{" "}
                e a cobrança recorrente só é ativada se você escolher cartão.
              </p>
            )}
          </div>
        </div>

        <div className="z-20 flex shrink-0 flex-col gap-3 bg-white px-5 py-4 sm:flex-row sm:items-center sm:px-8">
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center gap-2 text-sm text-gray-500 transition hover:text-brand sm:mr-auto sm:inline-flex"
          >
            <FontAwesomeIcon icon={faWhatsapp} className="text-lg text-green-600" />
            <span>Fale conosco</span>
          </a>
          <Button type="button" variant="secondary" onClick={onClose}>
            Agora não
          </Button>
          <Button
            type="button"
            className="w-full gap-2 sm:w-auto sm:min-w-64"
            disabled={active}
            onClick={() => {
              setNavigated(true);
              setStep(true);
            }}
          >
            {active ? "Seu iMenu Plus está ativo" : <>Assinar iMenu Plus <ArrowRight size={16} aria-hidden="true" /></>}
          </Button>
        </div>
      </ModalFlowStep>}
    </div>
  </Modal>;
}
