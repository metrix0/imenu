"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import { PanelIcon as FontAwesomeIcon } from "@/components/ui/PanelIcon";
import { faWhatsapp } from "@fortawesome/free-brands-svg-icons";
import {
  ArrowRight,
  Check,
  CreditCard,
  Image as ImageIcon,
  MessageSquare,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import Modal from "@/components/ui/Modal";
import ModalFlowStep from "@/components/ui/ModalFlowStep";
import Button from "@/components/ui/Button";
import QrCodeMesaCheckoutModal from "@/components/restaurant-owner/mesas/QrCodeMesaCheckoutModal";
import { IA_PLUS_BENEFITS, IA_PLUS_PRICE_LABEL } from "@/lib/addons/products";

const BENEFIT_ICONS = [MessageSquare, ImageIcon, WandSparkles] as const;
const SUPPORT_URL =
  "https://wa.me/5519997235394?text=Ol%C3%A1%2C%20tenho%20uma%20d%C3%BAvida%20sobre%20o%20iMenu%20IA%20Plus.";

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
    className="max-w-4xl"
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
          onClose={onClose}
          onBack={() => setStep(false)}
          onPaid={onPaid}
        />
      </ModalFlowStep> : <ModalFlowStep key="sales" reverse animate={navigated}>
        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="grid overflow-hidden md:grid-cols-[minmax(0,1fr)_320px]">
            <div className="px-6 pb-5 pt-6 sm:px-8 sm:pb-7 sm:pt-8">
              <div className="relative h-12 w-56 max-w-full">
                <Image
                  src="/logos/IAPlusCombinationMarkLogo_Brand.png"
                  alt="iMenu IA Plus"
                  fill
                  sizes="224px"
                  className="object-contain object-left"
                />
              </div>

              <div className="mt-7 inline-flex items-center gap-2 rounded-full border border-brand/15 bg-brand/5 px-3 py-1.5 text-xs font-semibold text-brand">
                <Sparkles size={14} aria-hidden="true" />
                Mais capacidade para executar
              </div>

              <h2 className="mt-4 max-w-xl text-2xl font-bold leading-tight text-gray-900 sm:text-[30px]">
                Transforme análise em mudanças que vendem mais.
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-6 text-gray-600 sm:text-base">
                Use o Assistente IA com mais capacidade, gere imagens e coloque em prática as oportunidades da sua Análise de Vendas com IA.
              </p>

              <div className="mt-6 rounded-xl border border-brand/20 bg-brand/5 p-4">
                <div className="flex flex-wrap items-end gap-x-3 gap-y-2">
                  <span className="text-3xl font-bold tracking-tight text-gray-900">{IA_PLUS_PRICE_LABEL}</span>
                  <span className="pb-1 text-sm text-gray-600">/mês</span>
                  <div className="ml-auto flex flex-col items-end gap-1 pb-1">
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-600">
                      <CreditCard size={14} aria-hidden="true" />
                      Cartão ou Pix
                    </span>
                    <span className="inline-flex items-center gap-2 text-xs font-medium text-gray-500">
                      <RefreshCw size={14} aria-hidden="true" />
                      Cancele quando quiser
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div className="relative hidden overflow-hidden border-l border-orange-100 bg-gradient-to-br from-orange-50 via-white to-orange-100/70 p-7 md:flex md:items-center">
              <div className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-brand/10 blur-2xl" />
              <div className="absolute -bottom-20 -left-12 h-52 w-52 rounded-full bg-orange-200/40 blur-3xl" />

              <div className="relative z-10 w-full">
                <div className="mb-5 flex items-center justify-between">
                  <span className="text-xs font-bold uppercase tracking-[0.14em] text-brand">IA em ação</span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand text-white shadow-sm">
                    <Sparkles size={17} aria-hidden="true" />
                  </span>
                </div>

                <div className="space-y-3">
                  <div className="rounded-xl border border-orange-100 bg-white/95 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
                        <WandSparkles size={17} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Oportunidade encontrada</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">A IA identifica onde seu cardápio pode melhorar.</p>
                      </div>
                    </div>
                  </div>

                  <div className="ml-5 rounded-xl border border-orange-100 bg-white/95 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-orange-100 text-brand">
                        <ImageIcon size={17} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Imagem pronta para revisar</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">Gere novos visuais sem publicar nada automaticamente.</p>
                      </div>
                    </div>
                  </div>

                  <div className="rounded-xl border border-orange-100 bg-white/95 p-4 shadow-sm">
                    <div className="flex items-start gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-green-50 text-green-700">
                        <Check size={17} aria-hidden="true" />
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">Você decide o que aplicar</p>
                        <p className="mt-1 text-xs leading-5 text-gray-500">Revise cada sugestão antes de mudar seu restaurante.</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex items-center gap-2 text-xs font-medium text-gray-600">
                  <ShieldCheck size={15} className="text-brand" aria-hidden="true" />
                  Nada muda sem sua aprovação
                </div>
              </div>
            </div>
          </div>

          <div className="px-6 py-6 sm:px-8">
            <div className="grid gap-3 md:grid-cols-3">
              {IA_PLUS_BENEFITS.map((benefit, index) => {
                const BenefitIcon = BENEFIT_ICONS[index] || Sparkles;
                return <div key={benefit.title} className="rounded-xl border border-orange-100 bg-gradient-to-br from-white to-orange-50/70 p-4">
                  <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-brand/10 text-brand">
                    <BenefitIcon size={17} aria-hidden="true" />
                  </span>
                  <p className="mt-3 text-sm font-semibold text-gray-900">{benefit.title}</p>
                  <p className="mt-1 text-sm leading-6 text-gray-500">{benefit.description}</p>
                </div>;
              })}
            </div>
          </div>
        </div>

        <div className="z-20 flex shrink-0 flex-col gap-3 border-t border-gray-100 bg-white px-6 py-4 sm:flex-row sm:items-center sm:px-8 sm:py-5">
          <a
            href={SUPPORT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden items-center justify-center gap-3 rounded-full border border-gray-200 bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700 transition hover:border-green-200 hover:bg-green-50 hover:text-green-700 sm:mr-auto sm:inline-flex"
          >
            <FontAwesomeIcon icon={faWhatsapp} className="text-lg text-green-600" />
            <span>Está em dúvida? Fale conosco</span>
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
            {active ? "Seu iMenu IA Plus está ativo" : <>Assinar iMenu IA Plus <ArrowRight size={16} aria-hidden="true" /></>}
          </Button>
        </div>
      </ModalFlowStep>}
    </div>
  </Modal>;
}
